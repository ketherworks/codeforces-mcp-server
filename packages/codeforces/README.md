# Codeforces MCP Server

[简体中文](README.zh-CN.md)

Search official Codeforces problem metadata through a small MCP server.

## Quick Start

Add the hosted server to your MCP configuration:

```json
{
  "servers": {
    "codeforces": {
      "type": "http",
      "url": "https://codeforces-mcp.ksrnyx.top/mcp"
    }
  }
}
```

The endpoint accepts anonymous read requests. It does not need an API key, Cookie, or judge account.

Then ask:

```text
Find five beginner Codeforces problems tagged implementation.
```

## What It Can Do

| Tool | Purpose |
| --- | --- |
| `oj_capabilities` | Report the available Codeforces read operations and transport. |
| `oj_health` | Report service health and the latest official API observation. |
| `oj_search_problems` | Search the official problemset by title, id, rating, or tag. |
| `codeforces_get_problem_metadata` | Fetch official metadata by id, such as `158/A`, `158A`, or `158-A`. |

## Run Locally

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

Tagged GitHub releases attach a standalone npm tarball.

## Availability

- Hosted MCP: `https://codeforces-mcp.ksrnyx.top/mcp`
- Official MCP Registry: `io.github.ketherworks/codeforces`, described by [`server.json`](../../server.json)
- Health status: see the repository homepage or call `oj_health`

## Source and Safety

This standalone release is generated from the reviewed
[Competitive Programming MCP source](https://github.com/ketherworks/competitive-programming-mcp/tree/a63a43780d866804c88a938849f92558f08fe403/packages/codeforces).
The release package bundles the shared OJ contract implementation, so its runtime does not depend
on unpublished workspace packages.

## Platform Rules

This project is unofficial and is not affiliated with or endorsed by Codeforces.

The server exposes no run or submit tool. It accepts no judge account credentials. See
[SECURITY.md](../../SECURITY.md) for the security boundary and [PROVENANCE.md](../../PROVENANCE.md) for the
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

[简体中文](README.zh-CN.md)

Search official Codeforces problem metadata from an MCP client. It is useful for finding practice problems by title, id, or tag.

## Quick Start

```json
{
  "servers": {
    "codeforces": {
      "type": "http",
      "url": "https://codeforces-mcp.ksrnyx.top/mcp"
    }
  }
}
```

Then ask:

```text
Find five beginner Codeforces problems tagged implementation.
Get the metadata for Codeforces problem 71/A.
```

## What It Can Do

| Tool | Purpose |
| --- | --- |
| `oj_capabilities` | Report the available Codeforces read operations and transport. |
| `oj_health` | Report service health and the latest official API observation. |
| `oj_search_problems` | Search the official problemset by title, id, rating, or tag. |
| `codeforces_get_problem_metadata` | Fetch official metadata by id, such as `158/A`, `158A`, or `158-A`. |

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
