import { it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

it("MCP memory survives a real server restart", { timeout: 20_000 }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "effectum-mcp-"));
  const env = Object.fromEntries(Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  ));
  env.EFFECTUM_MEMORY_FILE = join(dir, "memory.json");
  async function session(write: boolean) {
    const client = new Client({ name: "persistence-test", version: "1.0.0" });
    try {
      await client.connect(new StdioClientTransport({
        command: process.execPath,
        args: [fileURLToPath(new URL("./mcp.js", import.meta.url))],
        env,
        stderr: "ignore",
      }));
      if (write) {
        const response = await client.callTool({ name: "memory_write", arguments: { id: "restart", content: "still here" } });
        assert.notEqual(response.isError, true);
        const invalid = await client.callTool({ name: "memory_write", arguments: { id: "invalid", content: "bad", importance: "not-a-number" } });
        assert.equal(invalid.isError, true);
      }
      const response = await client.callTool({ name: "memory_read", arguments: { id: "restart" } });
      const content = response.content;
      assert.ok(Array.isArray(content));
      assert.equal(JSON.parse(content[0].text).content, "still here");
    } finally { await client.close(); }
  }
  try { await session(true); await session(false); }
  finally { rmSync(dir, { recursive: true, force: true }); }
});
