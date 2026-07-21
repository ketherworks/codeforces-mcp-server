# Codeforces MCP Server

Search official Codeforces problem metadata through a small MCP server.

## Hosted Endpoint

The public anonymous read-only endpoint is:

```json
{
  "servers": {
    "codeforces": {
      "type": "http",
      "url": "https://codeforces-oj-mcp.lantangtang54.workers.dev/mcp"
    }
  }
}
```

No end-user API key, cookie, or account credential is accepted.

Try it with:

```text
Find five beginner Codeforces problems tagged implementation.
```

## Tools

- `oj_capabilities`
- `oj_health`
- `oj_search_problems`
- `codeforces_get_problem_metadata`

## Local Stdio

Requires Node.js 22 or newer.

```bash
npm ci
npm run check
npm run build
node packages/codeforces/dist/index.js
```

MCP client configuration from a source checkout:

```json
{
  "servers": {
    "codeforces": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/packages/codeforces/dist/index.js"]
    }
  }
}
```

Tagged GitHub releases attach a standalone npm tarball. npm Registry and official MCP Registry
publication are intentionally separate steps and are not claimed until their ownership checks pass.

## Source

This standalone release is generated from the reviewed
[Competitive Programming MCP source](https://github.com/ketherworks/competitive-programming-mcp/tree/7f636969f183b1fe09d2c2111a095b1b80fb8a16/packages/codeforces).
The release package bundles the shared OJ contract implementation, so its runtime does not depend
on unpublished workspace packages.

## Policy

This project is unofficial and is not affiliated with or endorsed by Codeforces.

The server exposes no run or submit tool. It accepts no judge account credentials. See
[SECURITY.md](SECURITY.md) for the security boundary and [PROVENANCE.md](PROVENANCE.md) for the
canonical source revision.

## Development

```bash
npm ci
npm run check
npm run pack:check
npm run deploy:dry
```

## License

Adapter source code is MIT licensed. Judge problem content and trademarks are not relicensed by
this repository.


## Provider Implementation Details

Search official Codeforces problem metadata from an MCP client. It is useful for finding practice problems by title, id, or tag.

## Quick Start

```json
{
  "servers": {
    "codeforces": {
      "type": "http",
      "url": "https://codeforces-oj-mcp.lantangtang54.workers.dev/mcp"
    }
  }
}
```

Then ask:

```text
Find five beginner Codeforces problems tagged implementation.
Get the metadata for Codeforces problem 71/A.
```

## Tools

- `oj_capabilities`
- `oj_health`
- `oj_search_problems`
- `codeforces_get_problem_metadata`

The adapter exposes official problem metadata only. It does not authenticate, fetch problem statements, run code, or submit solutions. Search accepts the shared `oj.search-request/v1` fields `requestId`, `platform: "codeforces"`, `query`, and `limit`; cursors and locale selection are not supported by this full-problemset API.

Problems use `contestId/index` as their native identity when a contest id is present, and `problemsetName/index` for official custom problemsets. Official API payloads are validated before normalization or caching, including the documented `PROGRAMMING` and `QUESTION` problem types.

The Cloudflare Worker serves stateless Streamable HTTP at `/mcp`. `/healthz` is liveness-only, while `oj_health` reads the last persisted upstream observation from the Durable Object. The Worker rejects request bodies above 256 KiB and rejects every JSON-RPC batch because MCP 2025-11-25 Streamable HTTP accepts one message per POST. Worker and Durable Object queues are bounded and return HTTP 429 on saturation. Browser origins are denied unless listed in `CODEFORCES_MCP_ALLOWED_ORIGINS`; `*` explicitly enables wildcard CORS.

Validated problemset responses are published as generation-scoped Durable Object chunks. Metadata is written only after every bounded chunk succeeds, then chunks from prior or interrupted generations are deleted. API `FAILED` responses, invalid JSON, and schema drift are never cached.

## Commands

```text
npm run build
npm test
npm run typecheck
npm run test:pack
npm run deploy:cf:dry-run
npm start
```

Build, prepack, deploy, and dry-run use the compiled `dist/worker.js` entrypoint. The package requires Node.js 22 or newer.

Release packages are published only from Linux CI so the CLI executable mode is preserved in the npm tarball. Windows remains supported for local build, test, and pack smoke workflows, but `npm publish` is rejected there by `prepublishOnly`.
