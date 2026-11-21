import type { OjErrorCode } from "@kaiserunix/oj-mcp-contracts";
import {
  assertPositiveSafeInteger,
  cancelResponseBody,
  isTimeoutError,
  readBodyTextBounded,
  throwIfAborted,
  withDeadlineSignal
} from "@kaiserunix/oj-mcp-server-common";
import { z } from "zod";
import { CodeforcesRateLimiter } from "./rateLimiter.js";
import { CodeforcesQueueFullError } from "./admission.js";

const codeforcesProblemSchema = z
  .object({
    contestId: z.number().int().optional(),
    problemsetName: z.string().min(1).optional(),
    index: z.string().min(1),
    name: z.string().min(1),
    type: z.enum(["PROGRAMMING", "QUESTION"]),
    points: z.number().optional(),
    rating: z.number().int().optional(),
    tags: z.array(z.string())
  })
  .passthrough()
  .refine((problem) => problem.contestId !== undefined || problem.problemsetName !== undefined, {
    message: "A Codeforces problem must have contestId or problemsetName."
  });

const codeforcesProblemStatisticsSchema = z
  .object({
    contestId: z.number().int().optional(),
    index: z.string().min(1),
    solvedCount: z.number().int().nonnegative()
  })
  .passthrough();

export const codeforcesProblemsetResponseSchema = z
  .object({
    status: z.literal("OK"),
    result: z
      .object({
        problems: z.array(codeforcesProblemSchema),
        problemStatistics: z.array(codeforcesProblemStatisticsSchema)
      })
      .passthrough()
  })
  .passthrough();

export type CodeforcesProblemsetResponse = z.infer<typeof codeforcesProblemsetResponseSchema>;

export interface CodeforcesApiClientOptions {
  fetchImpl?: typeof fetch;
  limiter?: CodeforcesRateLimiter;
  baseUrl?: string;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export interface CodeforcesRequestOptions {
  signal?: AbortSignal;
}

export class CodeforcesApiError extends Error {
  constructor(
    readonly code: OjErrorCode,
    message: string,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "CodeforcesApiError";
  }
}

export class CodeforcesRequestCancelledError extends Error {
  constructor(message = "Codeforces request was cancelled.", options?: ErrorOptions) {
    super(message, options);
    this.name = "CodeforcesRequestCancelledError";
  }
}

export class CodeforcesApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly limiter: CodeforcesRateLimiter;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(options: CodeforcesApiClientOptions = {}) {
    const fetchImpl = options.fetchImpl ?? fetch;
    this.fetchImpl = (input, init) => fetchImpl(input, init);
    this.limiter = options.limiter ?? new CodeforcesRateLimiter();
    this.baseUrl = options.baseUrl ?? "https://codeforces.com/api";
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 64 * 1024 * 1024;
    assertPositiveSafeInteger(this.timeoutMs, "timeoutMs");
    assertPositiveSafeInteger(this.maxResponseBytes, "maxResponseBytes");
  }

  getProblemset(options: CodeforcesRequestOptions = {}): Promise<CodeforcesProblemsetResponse> {
    const scheduled = this.limiter.schedule(async () => {
      throwIfAborted(options.signal);
      return withDeadlineSignal(
        this.timeoutMs,
        options.signal,
        async ({ signal, didTimeout }) => {
          let response: Response;
          try {
            response = await this.fetchImpl(`${this.baseUrl}/problemset.problems`, {
              headers: { Accept: "application/json", "User-Agent": "oj-mcp-codeforces/0.1.0" },
              redirect: "manual",
              signal
            });
          } catch (error) {
            if (options.signal?.aborted) {
              throw new CodeforcesRequestCancelledError("Codeforces request was cancelled by the caller.", { cause: error });
            }
            throw new CodeforcesApiError(
              didTimeout() || isTimeoutError(error) ? "network.timeout" : "upstream.unavailable",
              error instanceof Error ? error.message : String(error)
            );
          }

          if (response.status === 429) {
            cancelResponseBody(response);
            throw new CodeforcesApiError("rate_limited", "Codeforces API rate limit exceeded.", retryAfterMilliseconds(response));
          }
          if (!response.ok) {
            cancelResponseBody(response);
            throw new CodeforcesApiError(
              response.status === 504 ? "network.timeout" : "upstream.unavailable",
              `Codeforces API returned HTTP ${response.status}.`
            );
          }

          let payload: unknown;
          try {
            const text = await readBodyTextBounded(response, {
              maxBytes: this.maxResponseBytes,
              signal,
              checkContentLength: true,
              sizeLimitMessage: "Codeforces response exceeded the configured byte limit."
            });
            payload = JSON.parse(text) as unknown;
          } catch (error) {
            if (options.signal?.aborted) {
              throw new CodeforcesRequestCancelledError("Codeforces response read was cancelled by the caller.", { cause: error });
            }
            if (didTimeout() || isTimeoutError(error)) {
              throw new CodeforcesApiError("network.timeout", "Codeforces API response timed out.");
            }
            throw new CodeforcesApiError("upstream.schema_changed", "Codeforces API returned invalid JSON.");
          }
          if (isFailedResponse(payload)) {
            const rateLimited = /call limit exceeded/i.test(payload.comment ?? "");
            throw new CodeforcesApiError(
              rateLimited ? "rate_limited" : "upstream.unavailable",
              payload.comment || "Codeforces API returned status FAILED.",
              rateLimited ? 2_000 : undefined
            );
          }

          const parsed = codeforcesProblemsetResponseSchema.safeParse(payload);
          if (!parsed.success) {
            throw new CodeforcesApiError("upstream.schema_changed", "Codeforces problemset response no longer matches the audited schema.");
          }
          return parsed.data;
        },
        {
          timeoutMessage: "Codeforces API request timed out.",
          cancelMessage: "Codeforces request was cancelled by the caller."
        }
      );
    }, options.signal);
    return scheduled.catch((error: unknown) => {
      if (error instanceof CodeforcesRequestCancelledError || error instanceof CodeforcesApiError) throw error;
      if (options.signal?.aborted) {
        throw new CodeforcesRequestCancelledError("Codeforces request was cancelled by the caller.", { cause: error });
      }
      if (error instanceof CodeforcesQueueFullError) {
        throw new CodeforcesApiError("rate_limited", error.message, 2_000);
      }
      throw error;
    });
  }
}

function isFailedResponse(value: unknown): value is { status: "FAILED"; comment?: string } {
  return Boolean(value && typeof value === "object" && "status" in value && value.status === "FAILED");
}

function retryAfterMilliseconds(response: Response): number | undefined {
  const value = response.headers.get("retry-after");
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds * 1_000 : undefined;
}
