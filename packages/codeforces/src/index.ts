#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createCodeforcesMcpServer } from "./server.js";

serveStdio(() => createCodeforcesMcpServer({ transport: "local_stdio" }));
