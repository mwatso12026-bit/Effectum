# Local memory storage

Local persistence is free, requires no account, and makes no network or AI calls. It is optional: `interpretMemory()` and the default MCP server still store memory only in RAM.

## Windows MCP setup

Each user runs their own local server and chooses their own data folder. All paths below are placeholders to replace on that user's computer; they do not point to a shared server or another person's PC.

After `npm.cmd ci` and `npm.cmd run build`, add an explicit memory file to your MCP client configuration. Replace both example paths with paths on your PC:

```json
{
  "mcpServers": {
    "effectum": {
      "command": "node",
      "args": ["C:\\path\\to\\your\\Effectum\\dist\\mcp.js"],
      "env": {
        "EFFECTUM_MEMORY_FILE": "C:\\path\\to\\your\\EffectumData\\memory.json"
      }
    }
  }
}
```

The parent folder is created on the first write. To launch manually in PowerShell:

```powershell
$env:EFFECTUM_MEMORY_FILE = Join-Path $env:LOCALAPPDATA 'Effectum\memory.json'
node .\dist\mcp.js
```

The server waits for MCP messages; connect an MCP client to use its tools. Do not put npm build commands in the MCP client's launch arguments.

## Test restart persistence

1. Call `memory_write` with `id: "restart-check"` and `content: "ReIfy remembers"`.
2. Restart the MCP server/client so it starts a new process with the same environment setting.
3. Call `memory_read` with `id: "restart-check"`. The content should still be present.
4. Call `memory_search` with `query: "ReIfy"` to check search after reopening.

`npm.cmd test` includes an automated test that starts two separate MCP server processes against one file.

Only memory nodes persist. The step counter and recent logs still reset on restart.

## Library usage

```js
import { interpretFileMemory, run, writeMemory, readMemory } from 'effectum';

const memory = interpretFileMemory('C:/path/to/your/EffectumData/memory.json');
await run(writeMemory({
  id: 'welcome', content: 'ReIfy remembers', importance: 1, timestamp: Date.now()
}), memory);
console.log(await run(readMemory('welcome'), memory));
```

Choose an absolute path. Relative paths are resolved against the process's working directory. Use a local disk; network shares, cloud-sync folders, and multi-user hosting are not supported by this adapter.

## Backups and recovery

Files contain versioned JSON (`version: 1`, `nodes: [...]`). Each successful replacement retains the previous valid snapshot in `memory.json.bak`. The first write has no earlier snapshot to back up. Writes use a temporary file and rename so readers see a complete snapshot. This is not a guarantee against every filesystem failure or power loss.

To export, stop the server and copy `memory.json` to a safe location. To import or restore, stop all servers using the file, preserve a copy of the current file, and copy a valid exported snapshot or `.bak` file over `memory.json`. Restart and verify the contents. Restoring `.bak` discards the changes from the most recent successful write.

Corrupt files and unsupported versions cause an error; they are not automatically reset or restored. A previous backup may be older, so restoration is explicit.

Writes are queued within one interpreter. Overlapping writers from separate interpreters/processes are rejected by a `.lock` file. Use one server per memory file. After a crash, a stale lock may remain: stop every process using that file before manually removing `memory.json.lock`. Never remove a lock while a writer is running.

Snapshots and backups are plaintext. Store them in a folder protected by your Windows account permissions. Large collections rewrite the entire snapshot on each write; a database adapter is future work.
