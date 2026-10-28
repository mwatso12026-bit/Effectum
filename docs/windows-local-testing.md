# Windows local testing

Install Node.js 22 LTS or newer. GitHub Desktop and VS Code are sufficient; Docker and an npm account are not required.

## Open the project

In GitHub Desktop, select Effectum and fetch the latest changes. Select the branch containing the changes you want to test, then choose **Repository → Open in Visual Studio Code**. Open a PowerShell terminal in VS Code. The terminal should be in the folder containing `package.json`.

```powershell
node --version
npm.cmd --version
npm.cmd ci
npm.cmd test
npm.cmd run example
npm.cmd pack
```

Using `npm.cmd` avoids PowerShell script execution-policy issues. Tests and the example use mock AI responses, without API keys or paid AI calls. Dependency installation requires internet access. Tests build the TypeScript before executing it.

Expected results: all tests pass, the example prints a final mock answer, and packaging creates `effectum-0.1.0.tgz` for the current version.

## Test the packaged installation separately

Copy the generated `.tgz` into a new, empty folder outside the repository. Open a terminal in that folder:

```powershell
npm.cmd init -y
npm.cmd install .\effectum-0.1.0.tgz
node --input-type=module -e "import { Pure, run } from 'effectum'; console.log(await run(Pure('Package works'), () => { throw new Error('Unexpected effect'); }));"
```

The output should be `Package works`. Adjust the archive filename if the version changes. This installs your locally built package without publishing or signing into npm.

## Connect an MCP client

Build the source first with `npm.cmd run build`. In your MCP client's configuration, use the absolute path to the compiled server, replacing the example path with your real checkout path:

```json
{
  "mcpServers": {
    "effectum": {
      "command": "node",
      "args": ["C:\\Users\\Heather\\Downloads\\Effectum\\dist\\mcp.js"]
    }
  }
}
```

Restart the client after changing its configuration. It should list eight tools, including `memory_write`, `memory_read`, and `memory_search`. Write a memory and read it back in the same server session. By default memory is held in RAM and lost when the server restarts. Follow [local memory storage](local-memory.md) to enable and test persistence across restarts.

For a package installed in another project, the server path is `<project>\\node_modules\\effectum\\dist\\mcp.js`. The installed command is also available as `effectum-mcp` from npm scripts or `npx.cmd --no-install effectum-mcp` within that project. Direct Node launch is recommended in MCP client configurations.

No Windows installer or desktop interface is included in this repository. These instructions test the Node.js package and MCP server on Windows.
