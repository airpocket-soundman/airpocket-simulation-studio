# Development plan and acceptance

[日本語](../roadmap.md)

Updated 2026-10-14. Product intent is defined in [product direction](product-direction.md), [agent operations](agent-operation.md) and [viewer direction](result-viewer-direction.md). This document defines implementation order and completion gates; proposals are not shipped capabilities.

## Highest-priority product principle (confirmed 2026-10-14)

The primary differentiator is that the user's own LLM can freely compose all application functions through a specialist SKILL to perform analysis and design iteration. The product does not assume a proprietary AI or an AI subscription operated by this application. Users choose their LLM, contract and execution environment; the application supplies shared APIs, MCP, specialist skills, validation and traceable results.

Full API/MCP coverage, continuous specialist-SKILL development and a pipeline delivering intermediate results to the LLM have highest priority. Expose preparation, mesh quality, iterations/residuals, completed time steps and provisional measurements with job IDs/input revisions, compact summaries and detailed artifact references. Declare solver limitations when intermediate fields are unavailable. Observation and preparation of subsequent settings must not mutate a running snapshot.

New GUI features include semantic APIs, MCP operations, observable state/diagnostics, SKILL guidance and verification scenarios in the same work item. Skills teach supported scope, units, physical assumptions, repair and provisional/final distinctions without silently changing models or engines. Acceptance measures API coverage, MCP-only task completion, intermediate observation/reconfiguration and reproducible SKILL-driven examples.

Start with P0/P1, then prioritize P3 intermediate-result/shared-job pipelines and API/MCP coverage of existing functions in P4. Include specialist-SKILL updates and scenario verification in every stage. P2 supports this path as necessary. Additional visualizations, physics models and printing extensions follow; separate new P4 visuals from API/MCP coverage of existing features.

## Baseline and tracking

The published baseline is v0.43. Its recorded verification is 242 tests, 26 runtime checks and 42 browser checks; these were not rerun for this documentation review. Reuse STEP/regions, shared APIs, volume meshes, Airpocket structural/thermal/limited-flow/acoustic/modal analysis, MFEM linear-structural WASM, cases, PNG/WebM and saved-JSON MCP. Scope restrictions remain in the analysis guide and discipline documents.

`src/progress.json` tracks existing tasks and release evidence. Early task descriptions retain historical scope and are not a complete current capability list. P0–P6 below are registered planning identifiers in progress JSON. Register implementation tasks with dependencies, acceptance criteria and evidence when work starts; a plan alone does not justify released status.

Keep REG2 and PRINT2 in progress. Reuse unresolved-region rejection in P1. Finish a bounded save/refusal/regression checkpoint for the orthotropic foundation; prioritize P0–P2 over further printing extensions. Orthotropic infrastructure does not complete printed-part analysis.

## Priorities and dependencies

| Plan | Deliverable | Dependencies | Acceptance |
|---|---|---|---|
| P0 Capabilities and contracts | GUI/shared API/MCP operation matrix, target-specific capabilities, units, diagnostic codes and schema versions | Existing API/MCP | List implemented and missing operations; expose actual Airpocket/MFEM/CPU/WebGPU combinations and stable unsupported-input diagnostics, without claiming entire library capabilities |
| P1 Inputs and provenance | STEP import, semantic regions, materials/conditions, sources/assumptions/confirmation and preflight | P0 | Create a single-part linear-structural input without screen coordinates. Detect invalid units, unconfirmed required values, insufficient constraints and unresolved regions. Label provisional runs; preserve state on failure |
| P2 Preparation and performance | On-demand modules, hashes/versions/cache, Worker reuse, staged progress and resource estimates | P0; independent parts may proceed alongside P1 | Link PERF1; record transfer, preparation, meshing, solve, repeat time and peak memory for specified geometry/device/browser/network/cold-warm cache. Check download/storage failure, cancellation and cleanup; set model limits after measurement |
| P3 Jobs and live connection | Job IDs, frozen input revisions, atomic patches, idempotency, progress/cancel/reconnect and browser session transport | P0/P1; integrate P2 acquisition state | GUI/MCP agree. Test stale changes, duplicate requests, disconnect/browser close and late responses after cancellation. Define permission, sharing and expiry; never mutate running snapshots |
| P4 Viewer and export | Layers, fixed ranges, camera/view persistence, probes, time controls, shared API/MCP and fixed-frame export | P0; live operations/export jobs require P3 | Restore views against the same result revision. Separate deformation demonstrations from physical time. Regress PNG/WebM, detect MP4/GIF support and alternatives, restore state after cancelled export; follow viewer specification |
| P5 Integrated design iteration | SolidCraft STEP exchange and three bracket thickness alternatives with design/input revision tracking | P1–P4 | Complete questioning, setup, solve, repair, CAD changes, remeshing, comparison and video export through MCP. Never silently remap missing/split/ambiguous regions; record common conditions/ranges and per-case convergence |
| P6 Shared core and native proof | Modular validation/units/diagnostics and WASM/native machine-code linear-structural contract proof | P0/P1; not required to complete P5 | Match supported input/diagnostic/result schemas and compare references, tolerances and balances. Node-hosted WASM does not count as a native machine-code build |

Start with the P0 operation matrix, capability schema and diagnostic contract, then apply them to P1 single-part linear structure before expanding to every feature. Dates, owners and performance thresholds are unset.

## Decision gates

- Before P1: settle API/save schema compatibility, migration and unsupported-version rejection against existing projects, cases and six MCP tools.
- Before P3: compare local-companion and relay transports for setup, authorization, information sharing, disconnection and installation-free reach. Local computation does not imply no external data transmission.
- After P2 measurements: decide module boundaries, resource limits, cache/Worker policy and performance targets.
- After the P6 small proof: decide Rust scope based on interoperability, size, startup, performance and maintenance. A wholesale rewrite remains undecided.
- Before P5: validate real STEP exchange, design IDs/revisions/hashes, named regions and failed matching/reselection. The external SolidCraft API has not been verified in this review.

## Existing backlog and later extensions

MESH1/REG2/CFDPORT1 retain unfinished general-surface and arbitrary-port work beyond existing planar/cylindrical support; prioritize the scope P1/P5 need. CFD1/CFDMESH1/CFD2/CFD3 must distinguish channel/Stokes support from general Navier–Stokes, turbulence, compressible and multiphase models, each requiring references, balances, convergence and resource measurements.

Keep existing limited coupling/material/fatigue/fracture support separate from COUPLE1/COUPLE3/COUPLE4B/COUPLE5, CONTACT1 and FAIL1 extensions. PRINT2 separates import/preview from layer/infill structural analysis and requires measured calibration; further printing extensions remain optional after standard analysis and agent iteration work.

CalculiX, Elmer, Code_Aster and OpenFOAM remain candidates; their ports are not prerequisites for P0–P5. Add streamlines, particles and isosurfaces in viewer-specification order; visualization does not add a physical solver model.

## Parallel development by module

Prioritize LLM integration while developing independent modules against shared contracts. Track module evidence and missing integration separately from completion of an entire plan.

- AGENTEDIT1: atomic saved-input edits and revision checks, preceding full P1 STEP/provenance support.
- AGENTJOBS1: Node CPU jobs and intermediate-result pipelines, preceding P3 live-browser MCP and restart recovery.
- CFDINTERNAL1: internal creeping-flow velocity-boundary adapter and P1/P2 references; general flow and UI/Worker integration remain unfinished.
- NATIVEPROOF1: Linux CI verified real host MFEM against the same C++ compiled to WASM, using five fixed-bar fixtures and eight invalid inputs. Arbitrary saved projects and a production native backend remain unsupported.

Solver work owns adapters/reference cases, fluid work owns independent domain/boundary/numerical/mesh modules, and integration work owns shared API/MCP/diagnostic/result contracts. Separate edits, then verify save compatibility, shared APIs and browser execution together. Preliminary research must not delay prioritized LLM functionality.

## Follow-up: CAE interface research and improvement

Prioritize LLM functionality: P0/P1, the P3 intermediate-result pipeline, API/MCP coverage of existing features in P4, and specialist-SKILL development throughout. Track interface work after these tasks.

- **UIRESEARCH1**: Study import, model/study trees, region selection, materials/conditions, job monitoring, diagnostics, comparison and export. Candidate references include FreeCAD FEM, PrePoMax, SALOME/ParaView and public commercial-CAE documentation. Record chosen products, versions, source URLs, review dates and observed versus inferred behavior. Use a common scenario to compare beginner effort, recovery and LLM collaboration; deliver ranked improvements and screen proposals. Depends on P0/P1/P3/P4.
- **UIIMPROVE1**: Implement ranked findings incrementally. Compare completion, interactions and recovery before/after on the same scenario. Pair new user functions with semantic APIs, MCP and SKILL guidance; check JP/EN, narrow screens, keyboard operation, persistence and published UI regressions. Depends on UIRESEARCH1.

Research and improvement have not started; no product ranking or interface approach has been selected.

## Completion gates

1. Complete bounded input creation, validation, run, results and save/restore. Record input validity, numerical convergence and physical accuracy separately.
2. Save references, justified tolerances, measured error, mesh, engine/module versions and frozen input.
3. Verify shared API/MCP and check browser-targeted features on Pages, including UI. Node runtime checks do not replace rendering or real-GPU checks. Verify native-only features in their declared environment.
4. Check state preservation after invalid input/failure/cancellation, resource cleanup, Japanese/English text and links; attach evidence to progress tasks.

See the [documentation consistency review](development-review.md) for findings and remaining decisions.
