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

## 2026-10-15: Publication priority revision

The 2026-10-14 review above is historical: statements such as six MCP tools are not current capability inventories. Follow the [roadmap](roadmap.md) publication order. First recover deployment and match candidate/artifact/progress revisions, then complete existing input/observation/saved-result comparison/view-export/distributed-Skill workflows through MCP. P2/P6 support necessary stability/compatibility; new CFD/coupling/printing/SolidCraft remain later work. Do not expand this publication gate to completion of the entire P0–P6 vision.

CFD1's initial laminar-only wording now matches ordinary-speed external Navier–Stokes, evaluating existing OSS/native reference problems and unsteady/turbulence needs at target Reynolds numbers. Neither Stokes setting changes nor unverified laminar assumptions substitute for cow-like external flow. This order applies among solver additions, after publication infrastructure and existing LLM workflows.

Progress JSON adds publicationMilestone schema1, referencing existing task IDs through publication gates, futureTaskIds and supportOnlyTaskIds. Deployment recovery/HTTPS/saved comparison/export alternatives/Skill end-to-end remain independent pending gates, avoiding duplicate tasks. A referenced released task cannot close a gate without matching publication evidence. Existing task statuses and historical releases are unchanged.

Deployment run 38647110282's missing public/gmsh/gmsh.mjs and main-protection API 404 (Branch not protected) are recorded as unresolved observations. Working branches/PRs/required CI/main protection remain verification requirements, not claims of existing protection or successful publication. Deployment CI recovery and evidence matching are next.

Subsequently configured main protection and read it back through the API: PRs, an up-to-date branch and GitHub Actions verify are required, including administrators. Mandatory human approvals are zero; this is not a claim of independent human review. See [protection evidence](../evidence/2026-10-15-main-protection.json). Deployment and the remaining publication gates still require evidence.

Published progress now adopts only snapshots verified through manifest → progress → manifest against stable revision, byte count and SHA-256. The newer raw-main timestamp fallback is removed; historical release.version is separated from the currently published candidate. Fetch failures, mismatches and missing development manifests preserve the previous display. The publicationMilestone runtime validator also checks references, scope, order, limits and matching candidate/manifest evidence for completed gates. This validates declaration consistency; it does not independently authenticate remote CI outcomes.
