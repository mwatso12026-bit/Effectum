#!/usr/bin/env node
/**
 * Local single-user MCP server for Effectum.
 * Uses yield (not yield*) so the generator algebra works.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { gen } from "./effect.js";
import { run } from "./interpreter.js";
import {
  writeMemory,
  readMemory,
  listMemory,
  searchMemory,
  interpretMemory,
} from "./effects/memory.js";

const memoryInterpreter = interpretMemory();
let agentStep = 0;
const logs: string[] = [];

const server = new Server(
  {
    name: "effectum",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "memory_write",
        description: "Write a memory node (local single-user)",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
            content: { type: "string" },
            importance: { type: "number" },
          },
          required: ["id", "content"],
        },
      },
      {
        name: "memory_read",
        description: "Read a memory node by id",
        inputSchema: {
          type: "object",
          properties: { id: { type: "string" } },
          required: ["id"],
        },
      },
      {
        name: "memory_list",
        description: "List all memory nodes",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "memory_search",
        description: "Search memory by substring",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
      {
        name: "state_get",
        description: "Get agent step",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "state_set",
        description: "Set agent step",
        inputSchema: {
          type: "object",
          properties: { value: { type: "number" } },
          required: ["value"],
        },
      },
      {
        name: "log",
        description: "Append a log message",
        inputSchema: {
          type: "object",
          properties: {
            level: { type: "string" },
            message: { type: "string" },
          },
          required: ["message"],
        },
      },
      {
        name: "get_logs",
        description: "Get recent logs",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments ?? {};

  try {
    if (name === "memory_write") {
      const id = String(args.id ?? "");
      const content = String(args.content ?? "");
      if (!id || !content) {
        return { content: [{ type: "text", text: "id and content required" }] };
      }
      const program = gen(function* () {
        yield writeMemory({
          id,
          content,
          importance: Number(args.importance ?? 1),
          timestamp: Date.now(),
        });
        return "ok";
      });
      await run(program, memoryInterpreter);
      return { content: [{ type: "text", text: "Memory written" }] };
    }

    if (name === "memory_read") {
      const id = String(args.id ?? "");
      const program = gen(function* () {
        return yield readMemory(id);
      });
      const result = await run(program, memoryInterpreter);
      return {
        content: [
          {
            type: "text",
            text: result ? JSON.stringify(result) : "not found",
          },
        ],
      };
    }

    if (name === "memory_list") {
      const program = gen(function* () {
        return yield listMemory();
      });
      const result = await run(program, memoryInterpreter);
      return {
        content: [{ type: "text", text: JSON.stringify(result ?? [], null, 2) }],
      };
    }

    if (name === "memory_search") {
      const query = String(args.query ?? "");
      const program = gen(function* () {
        return yield searchMemory(query);
      });
      const result = await run(program, memoryInterpreter);
      return {
        content: [{ type: "text", text: JSON.stringify(result ?? [], null, 2) }],
      };
    }

    if (name === "state_get") {
      return { content: [{ type: "text", text: String(agentStep) }] };
    }

    if (name === "state_set") {
      agentStep = Number(args.value ?? 0);
      return { content: [{ type: "text", text: `Step set to ${agentStep}` }] };
    }

    if (name === "log") {
      const message = String(args.message ?? "");
      const level = String(args.level ?? "info");
      logs.push(`[${level}] ${message}`);
      if (logs.length > 100) logs.shift();
      return { content: [{ type: "text", text: "Logged" }] };
    }

    if (name === "get_logs") {
      return {
        content: [{ type: "text", text: logs.length ? logs.join("\n") : "(no logs)" }],
      };
    }

    return { content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { content: [{ type: "text", text: `Error: ${msg}` }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Effectum MCP server running");

