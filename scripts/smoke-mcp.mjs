import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const client = new Client({ name: "effectum-release-smoke", version: "0.1.1" });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ["dist/mcp.js"],
  stderr: "pipe",
});
try {
  await client.connect(transport);
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 8, "Expected eight MCP tools");
  for (const name of ["memory_write", "memory_read", "memory_search"]) {
    assert.ok(tools.tools.some((tool) => tool.name === name), `Missing MCP tool: ${name}`);
  }
  const id = "release-smoke";
  const written = await client.callTool({ name: "memory_write", arguments: { id, content: "v0.1.1 smoke test" } });
  assert.equal(written.isError, undefined, "Memory write returned MCP error");
  const read = await client.callTool({ name: "memory_read", arguments: { id } });
  assert.equal(read.isError, undefined, "Memory read returned MCP error");
  assert.match(JSON.stringify(read.content), /v0\.1\.1 smoke test/, "Memory round-trip failed");
  console.log("MCP handshake, tool listing and memory round-trip passed");
} finally {
  await client.close();
}
