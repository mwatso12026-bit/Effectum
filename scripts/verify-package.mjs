import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
assert.equal(pkg.name, "@effectumcore/effectum");
assert.equal(pkg.bin?.["effectum-mcp"], "dist/mcp.js");
assert.equal(pkg.scripts?.prepack, "npm run build");
const pack = JSON.parse(execFileSync(process.platform === "win32" ? "npm.cmd" : "npm", ["pack", "--dry-run", "--json"], { encoding: "utf8", shell: process.platform === "win32" }))[0];
const files = new Set(pack.files.map((file) => file.path));
for (const path of ["dist/index.js", "dist/index.d.ts", "dist/mcp.js"]) {
  assert.ok(files.has(path), `Missing packaged file: ${path}`);
}
assert.ok(readFileSync("dist/mcp.js", "utf8").startsWith("#!/usr/bin/env node"), "MCP executable needs a Node shebang");
console.log("Scoped package and MCP executable packaging verified");
