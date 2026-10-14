# Development documentation consistency review

Reviewed 2026-10-14. [日本語](../development-review.md)

Reviewed local product, agent, viewer, roadmap, architecture, browser-runtime, solver, testing, automation, README, discipline documents and progress records, cross-checked against package.json, main.js and studio-mcp.mjs. External product APIs and the deployed application were not revalidated.

| Finding | Resolution or remaining work |
|---|---|
| Roadmap still prioritized STEP/Worker feasibility despite v0.43 analysis and export support | Replace obsolete phases with baseline and P0–P6 dependencies |
| CalculiX/Elmer/OpenFOAM appeared mandatory, while current engines are Airpocket/MFEM | Keep additional ports as candidates outside integrated-example prerequisites |
| Japanese architecture/runtime named TypeScript/React while current UI is vanilla JavaScript/Vite/Three.js | Correct current stack; no mandatory framework migration |
| Native product target conflicted with optional-extension wording; MFEM engine is WASM | Browser first, separately installed native build as a later product target, verified in P6; Node/WASM is distinct |
| Full agent-control goal exceeds six saved-JSON MCP tools | Schedule operation inventory, input APIs, live transport and viewer controls in P0/P1/P3/P4 |
| Historical REG1/BC1 descriptions can appear to deny later functionality | Preserve release history; explain interpretation and plan a current capability matrix in P0, including later-task references or description updates |
| PRINT2 is already in progress despite final optional printing policy | Preserve existing foundation and regression checkpoint, prioritize common APIs over additional printing extensions |
| Current no-upload behavior and proposed relay sharing need separate contracts | Decide permissions, sharing scope and expiry before P3; transport remains undecided |
| English/Japanese roadmaps differed in printing scope and retained obsolete phases | Align P0–P6, decision gates, backlog and completion criteria |

The central direction—local computation, browser entry, shared APIs and design iteration—is consistent. The gaps concern obsolete scheduling and confusing candidates, current implementation and future targets. Transport, compatibility, performance targets, Rust scope and SolidCraft exchange remain open decisions with explicit gates in the [plan](roadmap.md).

This change only edits documentation. Existing uncommitted product/agent/viewer and board changes are preserved; release statuses and historical verification counts are unchanged. It does not newly certify solver accuracy or deployed behavior.
