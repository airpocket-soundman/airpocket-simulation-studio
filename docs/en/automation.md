# MCP and dedicated skill

[日本語](../automation.md)

`npm run mcp` starts a local stdio MCP server implementing the [2025-11-25 tools specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/server/tools.mdx), with no new library dependency. Run `npm ci` and `npm run build` first to prepare WASM assets.

Eight tools: `studio_progress`, `studio_inspect_project`, `studio_analyze`, `studio_probe`, `studio_validate_cases`. Use absolute local JSON paths. Analysis writes the complete result to a new `outputPath` and returns metrics. Input and existing outputs are not overwritten. The same browser CPU Worker runs in an isolated Node worker with a 120-second limit. Airpocket CPU and MFEM are supported; WebGPU is excluded.

Call `studio_analyze` with `{"path":"D:/work/project.json","outputPath":"D:/work/result.json","size":5,"method":"wasm-pcg"}`. Probe `point` coordinates are mm; fields carry physical units. Use UI-saved projects and documented material properties within their valid scope.

Register with Codex (adjust location):

```powershell
codex mcp add airpocket-studio -- node D:/github/airpocket-soundman/airpocket-simulation-studio/scripts/studio-mcp.mjs
```

See [official MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli). Copy `skills/airpocket-studio` into personal `.codex/skills/airpocket-studio` to install the skill.

MCP works with local saved JSON without changing an open browser. Use the UI for image/video exports. CPU execution does not verify browser rendering, GPU behavior or physical accuracy for arbitrary geometry.

`studio_material_catalog` retrieves installed polymer references; see [polymer library](polymer-library.md).

`studio_capabilities` returns Node execution capabilities and candidate engines. `studio_diagnose_execution` accepts a saved-project `path` and optional `method`/`adaptive` and returns execution-combination diagnostics with codes, severity, targets, evidence and suggestions. This is not complete unit/constraint/material/mesh preflight. Browser callers use `window.studioApi.getCapabilities()` and `diagnoseExecution(options)`.
