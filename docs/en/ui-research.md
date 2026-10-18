# Existing CAE Interface Study and Improvement Proposals

[日本語](../ui-research.md)

Research date: 2026-10-15. Task: `UIRESEARCH1` (research). This is the input for `UIIMPROVE1` (implementation); this document itself changes no screens.

It follows the [product direction](product-direction.md), the [result viewer direction](result-viewer-direction.md) and the [competitive comparison](competitive-landscape.md). The goal is not to copy existing CAE layouts but to take only what helps beginners and users collaborating with their own LLM agent.

## Method and limits

- Only pages actually retrieved with `WebFetch` are treated as evidence. Pages that could not be retrieved are marked "not fetched" and rest on search-result summaries only.
- No product was operated hands-on. Versions, feel and real screens are unverified. "Observed" means what the documentation states; "inferred" is our interpretation.
- All retrieval dates are 2026-10-15. Versions are noted per row ("version unknown" where not stated).
- The common scenario is the bracket from the [product direction](product-direction.md) (single part, linear static and steady thermal). No measured comparison of interaction counts or time per product was done.

## Product x workflow comparison

Legend: o = documented, ~ = partial, - = not described in the source (not a statement of non-support), ? = unverified. "Fetched" means the page body was retrieved; "search only" means only a search summary was seen.

| Product (version) | Workflow stepping | Materials / constraints / loads | Pre-check / warnings | Jobs / progress | Results (legend, probe, animation) | How LLM / assistance attaches | Sources |
|---|---|---|---|---|---|---|---|
| Autodesk Fusion Simulation (version unknown) | Pick study type in the workspace; set up, solve, review | Materials inherited from design; constraint types such as fixed and pin (~) | A pre-check flags missing constraints, loads and materials (search only) | Background solves, Job Status (search only) | Results node is flagged out of date after input changes; animation capped at 100 steps (search only) | Not found in sources | [How it works](https://help.autodesk.com/cloudhelp/ENU/Fusion-Simulate/files/SIM-HOW-IT-WORKS.htm) (fetched), [Simulation results](https://help.autodesk.com/cloudhelp/ENU/Fusion-Simulate/files/GUID-99797676-4E9B-4257-AAB2-E83766121C9E.htm) (fetched), [Fusion Help animation](https://help.autodesk.com/view/fusion360/ENU/?guid=SIM-ANIMATE-CONCEPT) (page returned 404; search summary only) |
| SOLIDWORKS Simulation (2016-2018 help seen via search) | Study tree under the design tree (parts, connections, fixtures, external loads, mesh, results) | Each condition is an icon in a folder | Article says too few restraints prevent solving (search only) | ? | ? | ? | [Study Tree](https://help.solidworks.com/2018/English/SolidWorks/cworks/c_Simulation_Study_Tree_Interface.htm) (body not retrieved; search summary only) |
| Ansys Discovery (2021 review; 2025 R2 copilot) | Stage navigator Model, Explore, Refine (o) | Study type not chosen up front; inferred from added physics (o) | Info display shows readiness, missing items and a next-step prompt (o) | Live GPU re-solve; Refine uses higher-fidelity solvers (o) | Live displacement/stress/strain; toggle to pause (o) | Engineering Copilot (2025 R2) answers questions in a drop-down in the UI and points to resources; automatic setup execution not described (o) | [DEVELOP3D review](https://develop3d.com/reviews/review-ansys-discovery-2021/) (fetched, third party), [Ansys copilot blog](https://ansys.synopsys.com/blog/work-faster-smarter-with-ansys-engineering-copilot) (fetched) |
| FreeCAD FEM (version unknown) | Analysis container holding constraints, material, mesh, solver; advice to mesh last (search only) | Same | ? | Solver writes `.inp`, then runs | Choose a result type from a result object; purge results (search only) | ? | [FEM tutorial](https://wiki.freecad.org/FEM_tutorial), [FEM Workbench](https://wiki.freecad.org/FEM_Workbench): access denied (Anubis) on fetch. **Not fetched**; search summary only |
| Onshape Simulation (version unknown) | Study set up inside assemblies; linear static and modal (o) | Loads and constraints on parts or faces; remaining degrees of freedom shown (o) | No meshing step; constraint visualization (o) | Background runs (up to 50 at once), versioned results history (o) | Results update automatically when inputs change (o) | No AI described on the page (a separate "AI Advisor" product is only listed) | [Onshape Simulation](https://www.onshape.com/en/features/simulation) (fetched) |
| Abaqus/CAE (2017 docs) | Modules Part, Property, Assembly, Step, Interaction, Load, Mesh, Job, Visualization etc.; order is a guide, any module can be chosen (o) | Property and Load modules | Mesh verification; some ordering restrictions (~) | Job module submits and monitors (o) | Visualization module reads the output database (o) | ? | [What is a module?](https://abaqus-docs.mit.edu/2017/English/SIMACAEGSARefMap/simagsa-c-abswhatisamodule.htm) (fetched) |
| Siemens Simcenter 3D Pre/Post (version unknown; reseller help) | Simulation Navigator tree; create solution, boundary conditions, solve; results in Post Processing Navigator (o) | Drag objects into a solution's sets to activate (o) | ? | Right-click the solution to run (o) | Double-click a result type to display (o) | ? | [Simulation process](https://help.mayahtt.com/kb/topics/simulation_process_in_simcenter_3d_pre_post_thermal_flow.html) (fetched; reseller help, not official Siemens) |
| Autodesk CFD (2024 quick start; 2027 help) | Materials, boundary conditions, mesh (auto size), solve, results, copy and compare (o) | Same | ? | Iterates to convergence (o); a design is locked while scenarios run (o) | Application-specific extraction; comparison in Decision Center (o) | ? | [Quick Start](https://help.autodesk.com/cloudhelp/2024/ENU/SimCFD-QuickStart/files/GUID-193CE8EA-EA64-41E9-8D52-F5387CC928D3.htm) (fetched), [Design Study Bar](https://help.autodesk.com/cloudhelp/2027/ENU/SimCFD-Learning/files/GUID-02FBDA3D-E96F-4867-AF74-3507D9B12280.htm) (fetched) |
| SimScale Engineering AI (reference) | Natural-language setup, run, report | Agent assigns regions, materials, boundary conditions (o) | ? | Cloud runs continue after the browser closes (o) | Extracts requested quantities, makes cut planes and images (o) | Shows a running task list with reasoning; approval is optional, users may step in (o) | [Engineering AI explained](https://www.simscale.com/blog/engineering-ai-explained/) (fetched) |

### Observed (what the sources state)

- Autodesk CFD uses a Study / Design / Scenario hierarchy with cloning, comparison and notes built in; a design is locked while a scenario runs.
- Discovery does not force a study type first and keeps showing how ready the study is. Fusion marks stale results.
- Onshape hides meshing and emphasizes where the model is constrained and which freedoms remain.
- Abaqus module order is a guide, not enforced. Simcenter separates model operations and results into navigators.
- SimScale shows a task list with reasoning and does not require approval of each step.

### Inferred (our interpretation, unverified)

- Beginner confusion often comes from "what is still missing" not being visible; Discovery's readiness display and Fusion's pre-check appear to address that.
- A stale-result marker likely reduces mix-ups when conditions are edited repeatedly, by humans or LLMs.
- No effect is measured for this app yet; `UIIMPROVE1` must compare interaction count and recovery time on the same scenario.

## Current screen of this app (what was inspected)

`index.html` contains only `#app`; `src/main.js` builds the screen in `document.querySelector('#app').innerHTML`. `src/ui/*` holds only `status-ui.js`, `case-list-ui.js` and `fatigue-ui.js`; other UI lives in `src/browser-session-ui.js`, `src/named-view-ui.js`, `src/case-bundle-ui.js`, `src/cad-update-ui.js` and similar.

- Left column: `01 Model` (`#model`, samples), external fluid domain, `02 Select regions`, inspect interior, geometry defect check (`#region-report`), save/restore.
- Right column: `03 Analysis conditions` (`#physics` and many `details` groups), `Conditions set` (`#conditions`), `Compute engine` (`#mesh-run`, `#solve-run`, `#cancel-run`, `#setup-view`, `#status`, `#mesh-summary`), `Result display` (`#result-field`, `#result-legend`, `#color-*`, `#deform-scale`, `#probe-result`, `#result-export`), `Case comparison` (`#case-add`, `#case-list`).
- Found: status is a single line (`#status`). No pre-check button was found in the GUI; `preflight` exists only in `studio-api` / MCP (`src/studio-api.js`, `src/browser-operation-names.js`). No stale-result indicator was found in `src/main.js`. No `@media` in `src/main.js` (styles are elsewhere, so narrow-screen behavior is unverified).
- Not verified: real browser appearance, narrow screens, keyboard operation, JP/EN switching.

## Improvement proposals (ranked)

Common rule: GUI, API and MCP share one state (product rule). Any new operation gets its semantic API, MCP and Skill guidance in the same work. Effort: S = 1-2 days, M = 3-7 days, L = over 2 weeks (rough).

### 1. Readiness strip (always-visible progress)

- What: a top strip "model, regions, materials, conditions, mesh, run, results" showing each step as missing / needs check / ready; clicking a step jumps to its `section` / `details`.
- Why: Discovery's readiness display and Abaqus's guided-but-free step order. Helps beginners find what is missing.
- Effort: M. Risk: "ready" read as "physically valid". Keep the `completePreflight:false` rule and word the label as "passed checks", not "accurate".
- Parity: `preflight`, `inspect` (`requiredPointers`). Skill: `skills/airpocket-studio/references/saved-inputs.md`. No new API (display from existing reads).
- New id idea: `#readiness`.

### 2. Pre-run check panel

- What: a "Check before run" button beside `#solve-run` listing `preflight` output (stable code, severity, target, evidence, fix suggestion, whether user confirmation is needed); clicking a target highlights the region.
- Why: Fusion's pre-check, Discovery's missing-items display. Brings the structured diagnostics of the product direction to the GUI.
- Effort: M. Risk: auto-applied fixes (e.g. silently adding supports) would not represent real supports. Suggest and ask only; no auto-apply.
- Parity: `preflight`, `previewEdit` / `edit` (applying a fix uses the existing validated edit).
- New id ideas: `#preflight-run`, `#preflight-list`.

### 3. Persistent diagnostics list with live-region support

- What: extend the single-line `#status` (`STATUS_LABELS` in `src/ui/status-ui.js`) into a list that keeps recent diagnostics with severity and target, with `role="status"` / `aria-live`.
- Why: the line is overwritten and beginners lose the last error. Humans see what the LLM reads via `jobStatus`.
- Effort: S. Risk: consistency with the JP/EN label table; unknown strings keep falling back to `localizeStatus`.
- Parity: `jobStatus`, `jobEvents`, diagnostic codes.
- Existing id kept for compatibility: `#status`. New id idea: `#diagnostics`.

### 4. Conditions tree (supports, loads, materials, mesh with per-item warnings)

- What: reorganize `#conditions` into groups (materials / supports / loads / thermal / mesh) with warning icons, region highlight, edit and delete per row.
- Why: SOLIDWORKS Fixtures/External Loads folders, Simcenter Navigator and Abaqus trees share this structure.
- Effort: M-L (many existing condition `details` to connect). Risk: do not change the saved JSON; rearrange display only.
- Parity: `inspect`, `edit`, `previewEdit`.
- Existing ids: `#conditions`, `#region-report`.

### 5. "Results are stale" marker

- What: when conditions, mesh or design version differ from the result's input version, show a stale badge with a way back (`#setup-view`, `#solve-run`).
- Why: Fusion flags out-of-date results. Prevents mix-ups during iteration; matches the product rule of binding results to input versions.
- Effort: S. Risk: mismatch with `main.js` state could give false flags; compare using the input revision from `studio-api`, never recompute separately.
- Parity: `getResultView`, input revision in `jobStatus`, `caseView`.
- New id idea: `#result-freshness`.

### 6. Staged job progress with provisional labels

- What: show preparation (module fetch), mesh and solve progress separately near `#cancel-run`, plus iteration/residual info where available, labeling provisional values.
- Why: Fusion's Job Status, Autodesk CFD convergence. Exposes the intermediate-result pipeline to humans.
- Effort: M. Risk: when a solver cannot return information, state "not provided" rather than leaving blanks.
- Parity: `startJob`, `jobStatus`, `jobEvents`, `cancelJob`.
- Existing ids: `#solve-run`, `#cancel-run`, `#mesh-summary`.

### 7. Result viewer controls grouped around the legend

- What: put range lock, deformation scale, point probes (with units) and a playback bar together near the legend; label deformation cycling as "not an actual dynamic response".
- Why: Fusion's redesigned results experience (legend-adjacent settings and animation bar; search summary only, not fetched); aligns with step 1 of the [result viewer direction](result-viewer-direction.md).
- Effort: M. Risk: too many layers for beginners; show physics-based presets first and fold the rest.
- Parity: `getResultView` / `setResultView`, `probe`, `startExport`, `namedViewSave` / `namedViewApply`.
- Existing ids: `#result-legend`, `#color-fixed`, `#color-min`, `#color-max`, `#deform-scale`, `#probe-result`, `#result-export`.

### 8. Agent collaboration panel (review and approve proposals)

- What: surface the connection state from `browser-session-ui.js` and show an agent's `previewEdit` proposal as a diff that the user applies or rejects; list agent operations in progress.
- Why: SimScale shows a task list with reasoning. This app ships no AI of its own; it makes the user's own LLM's actions visible.
- Effort: L. Risk: connection/auth handling (no secrets in the UI or history), overwriting stale inputs (reject by expected revision). Do not display LLM confidence as evidence.
- Parity: `previewEdit`, `edit`, `jobEvents`. Connection design: [automation](automation.md), [agent operation](agent-operation.md). Skill: `skills/airpocket-studio`.
- Existing: `src/browser-session-ui.js`. New id idea: `#agent-proposals`.

### 9. Case comparison grouped by design version

- What: group `#case-list` by design version (geometry and condition lineage), compare side by side with a shared color range, and allow a note per case.
- Why: Autodesk CFD Study/Design/Scenario with notes; Onshape results history. Directly serves the three-bracket comparison scenario.
- Effort: M. Risk: never silently equate cases with different mesh, units or design version; show the differences as warnings.
- Parity: `caseList`, `caseCompare`, `caseSave`, `caseView`.
- Existing ids: `#case-add`, `#case-list`, `#case-export`.

### Screen sketch (rough)

```
[ Readiness: Model * Regions * Materials ~ Conditions o Mesh o Run o Results o ]   (1)
Left column                   Right column
01 Model                      03 Analysis conditions
02 Select regions             Conditions set (groups + warnings)                    (4)
                              Compute engine [Check][Mesh][Run][Cancel]            (2,6)
                              Diagnostics list                                      (3)
                              Results [stale] legend, range, probes, playback     (5,7)
                              Agent proposals (diff, apply/reject)                  (8)
                              Case comparison (design-version groups)               (9)
```

## Not proposed / out of scope

- A home-grown AI chat or steering users toward an AI subscription (product direction: the LLM is the user's). No self-built Q&A window like the Discovery copilot.
- Silently auto-completing supports, loads or materials, or showing LLM confidence as evidence.
- Discovery-style live continuous solving (Explore): solver coverage and validation differ.
- Adopting Onshape's "hide the mesh" approach wholesale; mesh quality and dependence are needed to explain validity.
- Abaqus-style module-switching UI, CAD editing or parametric modeling, cloud execution infrastructure.
- New physics or solvers, or a full theme/brand redesign.
- Presenting static deformation cycling as dynamic response.
- Implementation in this research task; `UIIMPROVE1` does that incrementally.

## What could not be verified

- FreeCAD FEM (official wiki blocked), SOLIDWORKS (help body not retrieved), Fusion's individual probe/legend pages, official Siemens documentation. These rest on search summaries or third-party material.
- Hands-on operation of any product, interaction counts or time comparisons, per-version screen differences.
- Result display details for Autodesk CFD and Abaqus, and LLM support where sources are silent (marked "?").
- This app's real-browser appearance, narrow screens, keyboard operation and JP/EN display.

## Versioned common-example comparison (2026-10-18)

This supplement compares **COMSOL Multiphysics 6.3** and **Ansys Mechanical 2025 R2 (v252)** using publisher documentation retrieved on **2026-10-18**. Versions identify the documentation, not installed products. No product was operated. The earlier survey and app inspection remain dated 2026-10-15; this supplement does not upgrade their unverified claims. In particular, SOLIDWORKS 2025 help retrieval again returned a shell/error, so it is not a detailed comparison candidate.

### Shared task and evidence boundary

Use three separately supplied bracket solids: A baseline, B increased plate thickness, C added rib. Keep the mounting interface and loaded interface functionally equivalent. For each, run a linear static case and an independent steady conduction case; this is six cases, not a thermal-stress coupling. A shared input manifest must specify geometry files/units, material properties, fixed/load regions and magnitudes, temperature/heat-input regions and values, mesh policy and result quantities. Re-identify and visually check regions after every geometry change. No supplied CAD files, dimensions, loads or solved reference values exist in this document: this is a reproducible task specification once those inputs are supplied, not an executed benchmark.

**D** means directly described by a retrieved document; **M** means our mapping of those commands to the shared task; **?** means not established. The publishers' tutorials use different geometries/loads. Their results do not establish results for A/B/C.

| Stage | COMSOL 6.3 | Mechanical 2025 R2 |
|---|---|---|
| Import | **D:** CAD import supports STEP, source/current units and resulting selections; an appropriate CAD import/Design/LiveLink license is required [C1]. **M:** import A/B/C separately and check units. | **D:** workflow separates materials and geometry attachment [A1]. **M:** attach each bracket to an analysis system. **?:** exact STEP translator/options were not retrieved. |
| Tree and selection | **D:** bracket tutorial uses Model Builder, geometry selections and selected boundaries [C2]. **M:** make mounting/load/thermal selections per variant. | **D:** Model/analysis objects use a tree [A2]; Named Selections support geometry or worksheet criteria [A3]. **M:** create equivalent named regions per variant. |
| Materials and conditions | **D:** structural tutorial assigns material and mechanical conditions [C2]; thermal tutorial uses a stationary heat-transfer model and temperature/source conditions [C3]. **M:** populate the manifest's two independent cases. | **D:** system type filters compatible loads/results [A2]; thermal setup requires conductivity and offers temperature, heat-flow/flux conditions [A4]. **M:** assign the same manifest properties and regions. |
| Mesh and job | **D:** bracket tutorial meshes and computes [C2]; Progress window permits stop/cancel [C4]. **M:** six separately identified jobs, record mesh/settings. | **D:** workflow exposes mesh, settings and solution steps [A1]. **M:** solve six identified cases. **?:** cancellation/restart behavior was not tested. |
| Diagnostics | **D:** Progress links to logs [C4]; bracket tutorial discusses stress singularities and averaging [C2]. **M:** retain diagnostics with the affected case; distinguish solver success from a credible stress maximum. | **D:** Solution Information presents solver output and solution/result tracking, with solver-dependent availability [A5]. **M:** retain the diagnostic record before editing/re-solving. |
| Results, comparison, export | **D:** parameter job configuration can store results/tables/images [C5]. **M:** compare A/B/C through recorded scalar tables and matched views; this is not proof of automatic cross-file comparison. | **D:** thermal documentation describes contours and charts for comparisons of analyses of the same model [A4]; supported objects export text/delimited data [A6]. **M:** assemble A/B/C tables externally; arbitrary cross-geometry synchronized comparison is **?**. |

Compare displacement/stress for structural cases and temperature/heat flow for thermal cases, keeping quantities, units, averaging, color limits and camera comparable. A maximum at a singular constraint needs interpretation and mesh evidence, not a design ranking by itself. Exported tables/images must carry design/case/input identity. These are evaluation requirements, not claims that either product automatically preserves all of them.

### Beginner burden and agent collaboration: inference, not observation

COMSOL's explicit physics/study/selection nodes suggest more concepts to learn but offer inspectable intermediate settings. Mechanical's system-filtered controls and named regions suggest useful guidance, while the project/tree/Details transitions and selection maintenance still require learning. These are document-based inferences; no click count, completion time, error rate or usability winner was measured.

COMSOL documents programmable CAD import [C1] and parametric solver configuration [C6]. That supports investigating an agent-generated script with human review; it does not establish a ready-made LLM integration. For Mechanical, retrieved pages establish inspectable regions, diagnostics and exported data, but this pass did not retrieve a version-matched automation API. Agent mutation, revision checks, undo, licensing and unattended operation remain **?** for both products. For our app, proposals 1–3 address readiness and retained actionable failures, 4–5 bind regions/conditions and stale results, 6–7 expose job/result context, and 8–9 require reviewable agent changes and design/case identity. Keep the existing ranking and screen sketch.

### Primary sources and remaining verification

All links below were read on 2026-10-18; each URL fixes 6.3 or v252. Brief summaries above paraphrase documentation, with no screen observation implied.

- C1: [Import 3D CAD](https://doc.comsol.com/6.3/doc/com.comsol.help.cad/cad_ug_ref.6.21.html).
- C2: [Bracket — Static Analysis](https://doc.comsol.com/6.3/doc/com.comsol.help.models.sme.bracket_static/bracket_static.html).
- C3: [Heat Conduction with a Localized Heat Source on a Disk](https://doc.comsol.com/6.3/doc/com.comsol.help.models.heat.localized_heat_source/localized_heat_source.html).
- C4: [The Progress Window](https://doc.comsol.com/6.3/doc/com.comsol.help.comsol/comsol_ref_solver.36.109.html).
- C5: [Using a Job Configuration to Store Parametric Results on File](https://doc.comsol.com/6.3/doc/com.comsol.help.comsol/comsol_ref_solver.36.232.html).
- C6: [Parametric Sweep API](https://doc.comsol.com/6.3/doc/com.comsol.help.comsol/comsol_api_solver.51.74.html).
- A1: [General Analysis Workflow](https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/wb_sim/ds_overview_approach.html).
- A2: [Define Part Behavior](https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/wb_sim/ds_Assign_Materials_to_Parts_step.html).
- A3: [Defining Named Selections](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/wb_sim/ds_geo_defname.html).
- A4: [Steady-State Thermal Analysis](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/wb_sim/ds_static_thermal_analysis_type.html).
- A5: [Specifying Solution Information](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/wb_sim/ds_Nonlinear.html).
- A6: [Data Export](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/wb_sim/ds_ExportingData.html).

The research unit supplies a sourced workflow comparison and prioritization, not a six-case validation. Remaining hands-on work: supply the common files/manifest; verify import and region correspondence; record missing-support/wrong-face diagnostics and recovery; change a solved input and inspect stale-result behavior; cancel a job; compare/export/reopen all six cases; test keyboard, locale and narrow layouts. No automatic face persistence, identical solver accuracy or measured beginner benefit is established.

## Mapping to `UIRESEARCH1` acceptance

| Requirement | How this document handles it |
|---|---|
| Compare import, trees, selection, materials/conditions, jobs, diagnostics, results/comparison/export | Versioned common-example table covers every stage for two products; exact Mechanical STEP options and cross-geometry comparison remain explicitly unconfirmed |
| URLs, versions, dates, observed vs inferred | Historical survey dated 2026-10-15; new primary sources fixed to 6.3/v252 and read 2026-10-18; D/M/? separates documentation, mapping and gaps |
| Beginner burden and agent collaboration | Explicit inference section, source-backed automation boundary and proposals 1-9; no measured usability claim |
| Ranked improvements and screen proposals | Proposals 1-9 and the screen sketch |

## Related

[Product direction](product-direction.md), [Result viewer direction](result-viewer-direction.md), [Competitive landscape](competitive-landscape.md), [Agent operation](agent-operation.md), [UI state separation](ui-state-separation.md)
