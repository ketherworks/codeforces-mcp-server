import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import {
  abortable,
  formatSchemaValidationError,
  isTimeoutError,
  readBodyTextBounded,
  withDeadlineSignal
} from "@kaiserunix/oj-mcp-server-common";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { CodeforcesApiClient } from "../src/client.js";
import { normalizeCodeforcesProblemset, searchCodeforcesProblems } from "../src/normalizers.js";
import { CodeforcesProvider } from "../src/provider.js";
import { CodeforcesRateLimiter } from "../src/rateLimiter.js";
import { CODEFORCES_MCP_TOOL_NAMES, createCodeforcesMcpServer } from "../src/server.js";
import { createCodeforcesWorker } from "../src/worker.js";
import { loadFixture } from "./fixtureLoader.js";

describe("Codeforces standalone polish & hardening", () => {
  test("returns actionable per-field schema validation microcopy without echoing raw secret values", async () => {
    const server = createCodeforcesMcpServer({
      provider: new CodeforcesProvider({ nowIso: () => "2026-07-10T12:00:00.000Z" }),
      transport: "local_stdio"
    });
    const client = new Client({ name: "codeforces-validation-test", version: "0.1.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    try {
      const badSearch = await client.callTool({
        name: "oj_search_problems",
        arguments: {
          schemaVersion: "oj.search-request/v1",
          requestId: "req-1",
          platform: "codeforces",
          query: "dp",
          limit: 10,
          cursor: "page-2"
        }
      });
      const badSearchError = badSearch.structuredContent as { code: string; message: string };
      expect(badSearch.isError).toBe(true);
      expect(badSearchError.code).toBe("request.invalid");
      expect(badSearchError.message).toContain("oj_search_problems");
      expect(badSearchError.message).toContain("cursor");
      expect(badSearchError.message).toContain("oj.search-request/v1");
      expect(badSearchError.message).not.toContain("page-2");

      const badMeta = await client.callTool({
        name: "codeforces_get_problem_metadata",
        arguments: { nativeId: "4" }
      });
      const badMetaError = badMeta.structuredContent as { code: string; message: string };
      expect(badMetaError.code).toBe("request.invalid");
      expect(badMetaError.message).toContain("nativeId");
      expect(badMetaError.message).toContain("158/A");

      const unknownTool = await client.callTool({ name: "nonexistent_tool", arguments: {} });
      const unknownError = unknownTool.structuredContent as { code: string; message: string };
      expect(unknownError.code).toBe("request.invalid");
      for (const name of CODEFORCES_MCP_TOOL_NAMES) {
        expect(unknownError.message).toContain(name);
      }
    } finally {
      await client.close();
      await server.close();
    }
  });

  test("supports rating filters and multi-token search queries", async () => {
    const summaries = normalizeCodeforcesProblemset(await loadFixture("problemset-ok.json"), {
      fetchedAt: "2026-07-10T12:00:00.000Z",
      adapterVersion: "0.1.0"
    });

    expect(searchCodeforcesProblems(summaries, "800", 10).map((item) => item.ref.nativeId)).toContain("4/A");
    expect(searchCodeforcesProblems(summaries, "rating:800", 10).map((item) => item.ref.nativeId)).toContain("4/A");
    expect(searchCodeforcesProblems(summaries, "800-900", 10).map((item) => item.ref.nativeId)).toContain("4/A");
    expect(searchCodeforcesProblems(summaries, "strings 800", 10).map((item) => item.ref.nativeId)).toEqual(["71/A"]);
    expect(searchCodeforcesProblems(summaries, "math 2400", 10)).toEqual([]);
  });

  test("times out even when an upstream response body stream stalls and ignores init.signal", async () => {
    const client = new CodeforcesApiClient({
      limiter: new CodeforcesRateLimiter({ intervalMs: 0 }),
      timeoutMs: 25,
      fetchImpl: async () =>
        new Response(
          new ReadableStream({
            start() {
              // Intentionally never emits or closes to simulate a stalled socket.
            }
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    });

    await expect(client.getProblemset()).rejects.toMatchObject({
      code: "network.timeout"
    });
  });

  test("bounds stalled coordinator health reads by upstreamTimeoutMs in the Worker", async () => {
    const worker = createCodeforcesWorker({ upstreamTimeoutMs: 25 });
    const env = {
      CODEFORCES_COORDINATOR: {
        getByName: () => ({
          fetch: async () =>
            new Response(
              new ReadableStream({
                start() {
                  // Stalled coordinator health body ignoring request.signal.
                }
              }),
              { status: 200, headers: { "Content-Type": "application/json" } }
            )
        })
      }
    };

    const response = await worker.fetch(
      new Request("https://codeforces.example/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "mcp-protocol-version": "2025-11-25"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "oj_health", arguments: {} }
        })
      }),
      env
    );
    const body = (await response.json()) as {
      result?: { isError?: boolean; structuredContent?: { code?: string } };
    };
    expect(response.status).toBe(200);
    expect(body.result?.isError).toBe(true);
    expect(body.result?.structuredContent?.code).toBe("internal");
  });

  test("shared server-common helpers handle deadline signals, bounded streams, and validation summaries", async () => {
    const schema = z.object({ a: z.string(), b: z.number().int() }).strict();
    const parsed = schema.safeParse({ a: 123, extraSecretKey: "top-secret" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const msg = formatSchemaValidationError("sample_tool", parsed.error, { hint: "Pass { a, b }." });
      expect(msg).toContain("sample_tool");
      expect(msg).toContain("extraSecretKey");
      expect(msg).toContain("Pass { a, b }.");
      expect(msg).not.toContain("top-secret");
    }

    expect(isTimeoutError({ code: "UND_ERR_BODY_TIMEOUT" })).toBe(true);
    expect(isTimeoutError({ cause: { code: "ETIMEDOUT" } })).toBe(true);
    expect(isTimeoutError(new Error("generic"))).toBe(false);

    await expect(
      withDeadlineSignal(15, undefined, ({ signal }) => abortable(new Promise<void>(() => {}), signal))
    ).rejects.toThrow(/timed out/i);

    const stalled = new Response(new ReadableStream({ start() {} }));
    await expect(
      withDeadlineSignal(15, undefined, ({ signal }) => readBodyTextBounded(stalled, { maxBytes: 64, signal }))
    ).rejects.toThrow(/timed out/i);
  });
});
