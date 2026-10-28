/**
 * Local single-user MCP server for Effectum.
 * Tools: memory (list/search/write/read), state, log, richer agent, effect trace.
 * Zero multi-tenant. Zero external infrastructure.
 *
 * Run with: npm run mcp
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { gen } from "./effect.js";
import { run, compose } from "./interpreter.js";
import {
  writeMemory,
  readMemory,
  listMemory,
  searchMemory,
  interpretMemory,
} from "./effects/memory.js";
import { info, interpretLog } from "./effects/log.js";
import { LLM, mockLLM } from "./effects/llm.js";

// Shared local single-user store so writes persist across MCP calls
const memoryInterpreter = interpretMemory();
let agentStep = 0;
const logs: string[] = [];
const traces: unknown[] = [];

const logSink = (level: string, message: string) => {
  logs.push(`[${level}] ${message}`);
  if (logs.length > 100) logs.shift();
};

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
        description: "Write a memory node with active reconsolidation (local single-user, shared store)",
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
        name: "memory_list",
        description: "List all memory nodes (local single-user)",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "memory_search",
        description: "Search memory nodes by content or id substring",
        inputSchema: {
          type: "object",
          properties: { query: { type: "string" } },
          required: ["query"],
        },
      },
      {
        name: "state_get",
        description: "Get the current agent step counter",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "state_set",
        description: "Set the agent step counter",
        inputSchema: {
          type: "object",
          properties: { value: { type: "number" } },
          required: ["value"],
        },
      },
      {
        name: "log",
        description: "Append a log message (local single-user)",
        inputSchema: {
          type: "object",
          properties: {
            level: { type: "string", enum: ["info", "warn", "error"] },
            message: { type: "string" },
          },
          required: ["message"],
        },
      },
      {
        name: "get_logs",
        description: "Return recent log messages",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "run_mock_agent",
        description: "Run a richer offline agent that uses state + memory + mock LLM",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
          },
        },
      },
      {
        name: "effect_trace",
        description: "Run a small program and return a simple reified trace summary",
        inputSchema: {
          type: "object",
          properties: {
            prompt: { type: "string" },
          },
        },
      },
      {
        name: "get_traces",
        description: "Return recent effect traces",
        inputSchema: { type: "object", properties: {} },
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
    await run(program, memoryInterpreter);
    return { content: [{ type: "text", text: "Memory written" }] };
  }

  if (name === "memory_read") {
    const program = gen(function* () {
      return yield* readMemory(args.id as string);
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
      return yield* listMemory();
    });
    const result = await run(program, memoryInterpreter);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  if (name === "memory_search") {
    const program = gen(function* () {
      return yield* searchMemory(args.query as string);
    });
    const result = await run(program, memoryInterpreter);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  if (name === "state_get") {
    return { content: [{ type: "text", text: String(agentStep) }] };
  }

  if (name === "state_set") {
    agentStep = args.value as number;
    return { content: [{ type: "text", text: `Step set to ${agentStep}` }] };
  }

  if (name === "log") {
    const level = (args.level as string) ?? "info";
    const message = args.message as string;
    logSink(level, message);
    return { content: [{ type: "text", text: "Logged" }] };
  }

  if (name === "get_logs") {
    return {
      content: [{ type: "text", text: logs.length ? logs.join("\n") : "(no logs)" }],
    };
  }

  if (name === "run_mock_agent") {
    const prompt = (args.prompt as string) ?? "What is a sealed effect?";
    const program = gen(function* () {
      yield* info(`Agent step ${agentStep} starting`);
      const answer = yield* LLM({
        messages: [{ role: "user", content: prompt }],
      });
      yield* writeMemory({
        id: `step-${agentStep}`,
        content: answer,
        importance: 0.8,
        timestamp: Date.now(),
      });
      agentStep += 1;
      yield* info(`Agent finished, next step ${agentStep}`);
      return answer;
    });

    const interpreter = compose(
      compose(
        mockLLM([`Mock answer for: ${prompt}`]),
        interpretLog(logSink)
      ),
      memoryInterpreter
    );

    const result = await run(program, interpreter);
    return { content: [{ type: "text", text: String(result) }] };
  }

  if (name === "effect_trace") {
    const prompt = (args.prompt as string) ?? "trace me";
    const trace: string[] = [];
    const program = gen(function* () {
      trace.push("log: start");
      yield* info(`Trace start: ${prompt}`);
      const answer = yield* LLM({
        messages: [{ role: "user", content: prompt }],
      });
      trace.push(`llm: ${answer}`);
      yield* writeMemory({
        id: `trace-${Date.now()}`,
        content: answer,
        importance: 0.5,
        timestamp: Date.now(),
      });
      trace.push("memory: written");
      return answer;
    });

    const interpreter = compose(
      compose(
        mockLLM([`Traced mock for: ${prompt}`]),
        interpretLog(() => {})
      ),
      memoryInterpreter
    );

    const result = await run(program, interpreter);
    const summary = { prompt, result, steps: trace };
    traces.push(summary);
    if (traces.length > 20) traces.shift();
    return {
      content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
    };
  }

  if (name === "get_traces") {
    return {
      content: [{ type: "text", text: JSON.stringify(traces, null, 2) }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Effectum MCP server running (local single-user, advanced tools)");
