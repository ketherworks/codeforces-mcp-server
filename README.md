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
| `codeforces_get_problem_metadata` | Fetch one problem's official metadata by native id. |

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
- Official MCP Registry: `io.github.ketherworks/codeforces`, described by [`server.json`](server.json)
- Health status: see the repository homepage or call `oj_health`

## Source and Safety

This standalone release is generated from the reviewed
[Competitive Programming MCP source](https://github.com/ketherworks/competitive-programming-mcp/tree/a63a43780d866804c88a938849f92558f08fe403/packages/codeforces).
The release package bundles the shared OJ contract implementation, so its runtime does not depend
on unpublished workspace packages.

## Platform Rules

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
