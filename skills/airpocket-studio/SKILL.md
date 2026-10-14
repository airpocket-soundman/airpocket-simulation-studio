---
name: airpocket-studio
description: Analyze saved Airpocket Simulation Studio projects, inspect validated cases and point measurements, and export model/result images or animations. Use for this application, not general CAD editing or unrelated FEM software.
---

Specialize the user's own LLM as a CAE agent; this application does not supply a proprietary AI subscription. Use the local `airpocket-studio` MCP server for saved JSON projects. The checkout normally lives at `D:/github/airpocket-soundman/airpocket-simulation-studio`; reuse its actual location if different.

- `studio_capabilities`: discover actual Node engine methods, candidate status, units and unsupported live-browser/export operations before choosing an execution path. Browser capability metadata does not prove a GPU adapter is available.
- `studio_diagnose_execution`: inspect a saved project for unsupported method/study/material combinations before solving. Stable codes and suggestions support repair, but `completePreflight:false` means units, physical inputs, constraints and mesh still need validation. Do not interpret an empty list as a safe or accurate model.
- `studio_progress`: implemented scope and outstanding tasks. Released features still have limits; consult corresponding `docs/*.md` when changing physics or constitutive models.
- `studio_inspect_project`: validate saved inputs and inspect study/conditions. Prefer the user's project; do not silently substitute a demo or invent material properties.
- `studio_analyze`: same CPU Worker as the browser. Supply absolute `path` and a new `outputPath`, mesh `size` in mm and optional CPU `method`. Existing outputs are refused. The response contains metrics; the file contains mesh, input, result and calculation settings. Node execution does not verify browser/GPU behavior.
- `studio_probe`: measure a saved analysis at `point:[x,y,z]` in mm. Fields carry physical units; outside points are refused. Specify the element to disambiguate multiple bodies. Saved results are validated first.
- `studio_validate_cases`: validate case archives and return comparison metrics.

If MCP tools have not loaded in the current chat, import `callStudioTool` from `scripts/studio-mcp.mjs` using a short Node script or the persistent Node tool. `npm run mcp` starts a protocol server, not an interactive shell. A fresh clone needs `npm ci` and `npm run build` to prepare WASM assets.

Use documented browser tools for live visual operations. MCP operates on saved local files and does not mutate an open browser. In **Save images and animations / 画像・アニメーションを保存**, choose surface, surface triangles, internal mesh and clipping before PNG/WebM export. Types: orbit, deformation cycle, stored transient acoustic frames, moving section. Check saved artifacts. Deformation cycles are visualization, not a loading/unloading solve; video time may differ from physical time.

Read `docs/automation.md` and `docs/visual-export.md` in the checkout for setup and limits. Preserve material provenance. Do not infer measured S-N curves or strengths from names. Distinguish solver residuals from physical accuracy and finite-box Stokes drag from infinite-domain sphere references.

- `studio_material_catalog`: search 91 preinstalled polymer references by family/filler/content or retrieve by id. Read `docs/polymer-library.md`; distinguish published tensile modulus from flexural modulus, user-assumed Poisson ratio, missing data and experimental formulations. Do not present the displayed 0.35 as a published measurement.

For iterative work, explain which inputs came from the user or measured sources and which remain assumptions. Confirm missing physical support/load/material information instead of making the model solvable by changing the intended physics. Preserve the input/result version and compare like-for-like cases.

Current MCP analysis returns a final response and saved artifact; it does not yet expose a live intermediate-result pipeline. Do not claim to monitor solver iterations through MCP or modify a running job. When that pipeline is implemented, consume revision-tagged summaries and artifact references, distinguish unconverged snapshots from final results, and prepare changes for the next run. Use capability discovery to determine what is available in the installed version.
