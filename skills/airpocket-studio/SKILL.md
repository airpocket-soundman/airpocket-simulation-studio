---
name: airpocket-studio
description: Analyze saved Airpocket Simulation Studio projects, inspect validated cases and point measurements, and export model/result images or animations. Use for this application, not general CAD editing or unrelated FEM software.
---

Specialize the user's own LLM as a CAE agent; this application does not supply a proprietary AI subscription. Use the local `airpocket-studio` MCP server for saved JSON projects. The checkout normally lives at `D:/github/airpocket-soundman/airpocket-simulation-studio`; reuse its actual location if different.

- `studio_capabilities`: discover actual Node engine methods, candidate status, units and unsupported live-browser/export operations before choosing an execution path. Browser capability metadata does not prove a GPU adapter is available.
- `studio_diagnose_execution`: inspect a saved project for unsupported method/study/material combinations before solving. Stable codes and suggestions support repair, but `completePreflight:false` means units, physical inputs, constraints and mesh still need validation. Do not interpret an empty list as a safe or accurate model.
- `studio_progress`: implemented scope and outstanding tasks. Released features still have limits; consult corresponding `docs/*.md` when changing physics or constitutive models.
- `studio_inspect_project`: validate saved inputs and inspect study/conditions. Prefer the user's project; do not silently substitute a demo or invent material properties.
- `studio_edit_project`: atomically edit an existing saved project into a new `outputPath`. Use `revision` from `studio_inspect_project` as `expectedRevision`, with `operations:[{method,args}]` (1–100 commands). Supported selection, condition, material, study and mesh methods are listed in `docs/automation.md`; `args` uses each method's positional arguments. Stale revisions or failed commands reject the batch. Inputs and existing outputs remain intact. This does not import STEP or provide a complete provenance schema.
- `studio_analyze`: same CPU Worker as the browser. Supply absolute `path` and a new `outputPath`, mesh `size` in mm and optional CPU `method`. Existing outputs are refused. The response contains metrics; the file contains mesh, input, result and calculation settings. Node execution does not verify browser/GPU behavior.
- `studio_start_analysis`, `studio_job_status`, `studio_job_events`, `studio_cancel_job`, `studio_release_job`: asynchronous CPU jobs with frozen input, bounded observations and optional provisional field artifacts. Use these for monitoring rather than blocking `studio_analyze`. See the workflow below.
- `studio_probe`: measure a saved analysis at `point:[x,y,z]` in mm. Fields carry physical units; outside points are refused. Specify the element to disambiguate multiple bodies. Saved results are validated first.
- `studio_validate_cases`: validate case archives and return comparison metrics.

If MCP tools have not loaded in the current chat, import `callStudioTool` from `scripts/studio-mcp.mjs` using a short Node script or the persistent Node tool. `npm run mcp` starts a protocol server, not an interactive shell. A fresh clone needs `npm ci` and `npm run build` to prepare WASM assets.

Use documented browser tools for live visual operations. MCP operates on saved local files and does not mutate an open browser. In **Save images and animations / 画像・アニメーションを保存**, choose surface, surface triangles, internal mesh and clipping before PNG/WebM export. Types: orbit, deformation cycle, stored transient acoustic frames, moving section. Check saved artifacts. Deformation cycles are visualization, not a loading/unloading solve; video time may differ from physical time.

Read `docs/automation.md` and `docs/visual-export.md` in the checkout for setup and limits. Preserve material provenance. Do not infer measured S-N curves or strengths from names. Distinguish solver residuals from physical accuracy and finite-box Stokes drag from infinite-domain sphere references.

- `studio_material_catalog`: search 91 preinstalled polymer references by family/filler/content or retrieve by id. Read `docs/polymer-library.md`; distinguish published tensile modulus from flexural modulus, user-assumed Poisson ratio, missing data and experimental formulations. Do not present the displayed 0.35 as a published measurement.

For iterative work, explain which inputs came from the user or measured sources and which remain assumptions. Confirm missing physical support/load/material information instead of making the model solvable by changing the intended physics. Preserve the input/result version and compare like-for-like cases.

For iterative jobs:

1. Check capabilities and execution diagnostics for the installed version; inspect the saved input and missing physical assumptions.
2. Start with absolute `path`, new `outputPath`, and a unique `requestId`. Retain `jobId` and `inputRevision`. An identical retry returns the same retained job; changed input/settings/output require a new request ID.
3. Poll `studio_job_events` at a frequency useful for the computation, passing the returned `nextSequence` as `afterSequence`. Drain pages while `hasMore`; `truncated` means observations were dropped. Empty pages do not mean completion: check `studio_job_status`.
4. Review summaries and needed artifacts, matching job/input revision and verifying artifact hashes when reading files. `includeFields:true` writes provisional mesh/time fields under a new `outputPath + ".intermediate"` directory. Field files reference a saved corresponding mesh through `meshArtifact` when available. The default total is capped at 64 MB; an `observation-limit` event means summaries continue without further field storage.
5. Check terminal status and the final artifact before comparing results. Never treat provisional or unconverged observations as final validated physics. Inspect the next input's revision, use `studio_edit_project` to save intended setting changes to a new path, then start a new run with that path and a new request ID. Do not substitute a job's `inputRevision` for the inspected edit revision: normalization can make them differ. Do not modify a running job or silently change supports, loads, material or other physical intent to obtain convergence. Preserve the user's intended physics and request missing physical information when needed.

The server exposes 14 tools. Job metadata/events and request IDs live only in the same MCP/Node process (default 32 jobs, 256 events each); retain that process for direct Node calls. Release terminal jobs to free retention slots; saved files remain, and a released request ID can execute again. Cancellation stops `running` jobs, but final file publication in `saving` cannot be cancelled. Computation times out after 120 seconds by default; restart recovery is unsupported. Intermediate observations depend on the solver and do not cover every iteration or field. Browser job APIs provide summary events only and are not live-browser MCP access. See `docs/automation.md` for contracts and limits.
