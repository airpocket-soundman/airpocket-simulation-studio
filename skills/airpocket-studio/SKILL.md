---
name: airpocket-studio
description: Analyze saved airpocket Simulation Studio projects, inspect validated cases and point measurements, and export model/result images or animations. Use for this application, not general CAD editing or unrelated FEM software.
---

Specialize the user's own LLM as a CAE agent; this application does not supply a proprietary AI subscription. Work from the user's geometry, physical intent and material sources. The checkout normally lives at `D:/github/airpocket-soundman/airpocket-simulation-studio`; reuse its actual location if different.

## Discover the actual connection first

Inspect the tools registered in this conversation before choosing a workflow. A connected older server may expose 18 tools including `studio_progress`, while the full repository entry declares 36 default/38 paired tools and the minimal browser entry exposes three browser tools. Repository declarations do not install or activate missing tools. Do not claim that a listed tool exists in the current session without checking.

Choose the smallest task-relevant read. Use `studio_progress` only when asked about development, publication or outstanding-task status; it can return the full roadmap and is unnecessary for ordinary input inspection or edit preview. Read `studio_capabilities` when selecting or checking an execution engine/path, not for read-only input access. For an input-read/preview task, use the relevant exposed tool schema and input section/pointer; do not fetch the full operation catalog or roadmap. If a live method's arguments are unknown and `studio_browser_contracts` is exposed, request that one method to discover its envelope, required scope, revisions, units and effects. Schema declarations are not permissions or physical validation. For missing tools that the task needs, see [saved-inputs](references/saved-inputs.md) for the documented local `callStudioTool` fallback and prerequisites; use the repository implementation deliberately and report its execution environment rather than silently treating it as the older registered server.

## Load only the relevant workflow

- [Local MCP loop](references/skill-loop.md): a synthetic axial bar from input/provenance repair through two analyses, case comparison and verified PNG/archive output; revised-recipe evidence and remaining independent-reproduction limits.
- [Saved inputs and editing](references/saved-inputs.md): bounded section/pointer inspection of saved/live input, edit/preview transactions, selection-based local mesh refinement, catalog application, provenance/preflight and local MCP setup/fallback.
- [Browser session](references/browser-session.md): explicit pairing/scopes, GUI jobs, argument-contract discovery. Discovery alone grants no browser access.
- [Geometry and imports](references/geometry-imports.md): STEP/STL and built-ins, CAD updates, print transfers, fluid domains, coupling sources and surface defects.
- [Jobs and observations](references/jobs-observations.md): frozen input revisions, retained artifacts, bounded pages, body selectors, observation profiles, nonlinear fields, residual interpretation, and post-mesh boundary-transfer inspection.
- [Result views](references/result-views.md): selected field/frame/mode, point probes, camera/ranges, PNG/WebM jobs and portable named views.
- [Cases and measurements](references/case-archives-measurements.md): chunked case transfer, view/measurement bundles, saved history and independent reinterpolation checks.
- [Physics and provenance](references/physics-provenance.md): fatigue/fracture limits and thermal/acoustic/fluid/modal/orthotropic/nonlinear input contracts. Read the applicable section before evaluating physical assumptions.
- [Runtime and diagnostics](references/runtime-diagnostics.md): termination/recovery, optional process isolation, typed failures versus stage fallbacks, known Node/V8 risk and evidence limits.
- [Native SU2 flow](references/native-flow.md): optional native MCP startup/integration, approved-case execution, intermediate residuals, paged SI fields, warning interpretation and browser/API boundaries. These tools are absent unless explicitly configured.

- [Development progress](references/development-progress.md): opt-in status history and weighted product estimate; use only for development/planning questions, never as engineering validation.

## Preserve engineering intent

Do not invent missing material values, loads, supports or regions to make a model solve. Record measured sources versus explicit exploratory assumptions; LLM confidence is not evidence. Use requiredPointers from current preflight, preserve input/result revisions and provisional labels, and compare like-for-like cases. Successful preflight remains `completePreflight:false`; convergence does not establish physical accuracy.

Prefer available semantic APIs/MCP for supported operations. Before live mutation, respect the explicitly granted scope and revision guards. Never silently widen permissions or modify a running job's frozen snapshot. Observe terminal state and `executionSettled:true` before release; inspect state after an uncertain mutation timeout rather than blindly retrying. Save and verify requested artifacts, keeping units and physical time distinct from presentation animation.

## Saved independent increment curves

When `studio_increment_curve` is actually registered, pass an absolute path to a `{spec,steps}` bundle with explicit gauge/axis/area/support and per-step independent linear outputs. Read offset/limit pages (default 20, maximum 50), retain source SHA and curve revisions, and use an explicit new outputPath to obtain the same CSV/JSON/SVG strings in an artifact-bundle JSON. Existing files are never overwritten. Failed/provisional steps are not silently converted to measurements. This is force-controlled independent linear extraction, not plastic load/unload history or measured material validation. It grants no browser scope. If absent from the registered server, use the documented repository callStudioTool fallback deliberately; installing or reloading a server is a separate action.

For 2–4 curves, the same saved-file tool accepts `{bundles:[...]}` (combined raw UTF-8 input 2 MiB, each bundle 1 MiB). Read the `kind` discriminator: single responses keep `curve/page`; comparison responses return `comparison/requestedOffset/pages`, with per-curve metadata and independently clamped offsets. A shared offset beyond a short curve produces its empty final page; single-curve out-of-range offsets still refuse. Limit is per curve (max50) but the 64 KiB serialized tool data value bound is shared (MCP duplicates content.text/structuredContent.value and adds a separate JSON-RPC envelope), so reduce limit on a response-bound refusal. Explicit new outputPath retains the same comparison CSV/JSON/SVG strings in an exclusive artifact bundle. Distinct curve material/geometry/gauge identities are not averaged or assumed equal. Discover support on the actual registered server; no new browser scope or method is involved.
