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
