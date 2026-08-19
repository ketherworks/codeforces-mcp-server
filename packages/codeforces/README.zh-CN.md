# Codeforces MCP Server

[English](README.md)

通过 MCP 搜索 Codeforces 官方公开的题目元数据，可按题名、题号、难度和标签筛选。

## 快速开始

把公共服务加入 MCP 配置：

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

配置后可以直接说：

```text
在 Codeforces 找五道适合入门、标签为 implementation 的题。
```

该地址只处理匿名读取，不需要 API Key、Cookie 或 OJ 账号。

## 能做什么

| 工具 | 用途 |
| --- | --- |
| `oj_capabilities` | 报告当前可用的 Codeforces 读取能力和传输方式。 |
| `oj_health` | 报告服务状态和最近一次官方 API 读取结果。 |
| `oj_search_problems` | 按题名、题号、难度或标签搜索官方题库。 |
| `codeforces_get_problem_metadata` | 按平台题号读取一道题的官方元数据。 |

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm ci
npm run check
npm run build
node packages/codeforces/dist/index.js
```

从源码目录启动时的 MCP 配置：

```json
{
  "servers": {
    "codeforces": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/替换为实际路径/packages/codeforces/dist/index.js"]
    }
  }
}
```

带版本号的 GitHub Release 会附带独立 npm 压缩包。

## 服务地址

- 公共 MCP：`https://codeforces-mcp.ksrnyx.top/mcp`
- 官方 MCP Registry：`io.github.ketherworks/codeforces`，定义见 [`server.json`](../../server.json)
- 健康状态：查看仓库主页，或调用 `oj_health`

## 来源与安全

该独立仓库由经过审阅的
[Competitive Programming MCP 源码](https://github.com/ketherworks/competitive-programming-mcp/tree/a63a43780d866804c88a938849f92558f08fe403/packages/codeforces)
生成。发布包内含统一 OJ 契约的运行代码，不依赖未发布的工作区包。

服务不提供运行或提交工具，也不接收 OJ 登录凭据。安全边界见
[`SECURITY.md`](../../SECURITY.md)，对应的源代码版本见 [`PROVENANCE.md`](../../PROVENANCE.md)。

## 平台规则

本项目是社区实现，与 Codeforces 无隶属或背书关系。

## 开发

```bash
npm ci
npm run check
npm run pack:check
npm run deploy:dry
```

## 许可证

适配器源码使用 MIT 许可证。题目内容和平台商标不因本仓库重新授权。
