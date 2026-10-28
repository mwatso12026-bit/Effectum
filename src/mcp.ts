/**
 * Minimal local single-user MCP server for Effectum.
 * Exposes memory write/read and a simple offline agent run as tools.
 * Zero multi-tenant. Zero external infrastructure.
 *
 * Run with: npx tsx src/mcp.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { gen } from "./effect.js";
import { run, compose } from "./interpreter.js";
import { writeMemory, readMemory, interpretMemory } from "./effects/memory.js";
import { info, interpretLog } from "./effects/log.js";
import { Get, Put, interpretState } from "./effects/state.js";
import { LLM, mockLLM } from "./effects/llm.js";

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
        description: "Write a memory node with active reconsolidation (local single-user)",
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
        description: "Read a memory node by id (local single-user)",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
      {
        name: "run_mock_agent",
        description: "Run the example offline agent and return the result",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "memory_write") {
    const program = gen(function* () {
      yield* writeMemory({
        id: args.id as string,
        content: args.content as string,
        importance: (args.importance as number) ?? 1,
        timestamp: Date.now(),
      });
      return "ok";
    });
    const interpreter = interpretMemory();
    await run(program, interpreter);
    return { content: [{ type: "text", text: "Memory written" }] };
  }

  if (name === "memory_read") {
    const program = gen(function* () {
      return yield* readMemory(args.id as string);
    });
    const interpreter = interpretMemory();
    const result = await run(program, interpreter);
    return {
      content: [
        {
          type: "text",
          text: result ? JSON.stringify(result) : "not found",
        },
      ],
    };
  }

  if (name === "run_mock_agent") {
    const program = gen(function* () {
      yield* info("Effectum MCP agent starting");
      const step = yield* Get<number>();
      const answer = yield* LLM({
        messages: [{ role: "user", content: "What is a sealed effect?" }],
      });
      yield* Put(step + 1);
      return answer;
    });

    const interpreter = compose(
      compose(
        mockLLM(["A sealed effect is reified data that can only be interpreted."]),
        interpretLog(() => {})
      ),
      interpretState(0)
    );

    const result = await run(program, interpreter);
    return { content: [{ type: "text", text: String(result) }] };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Effectum MCP server running (local single-user)");
