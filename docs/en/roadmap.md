# Development plan and acceptance

[日本語](../roadmap.md)

Updated 2026-10-16. Product intent is defined in [product direction](product-direction.md), [agent operations](agent-operation.md) and [viewer direction](result-viewer-direction.md). This document defines implementation order and completion gates; proposals are not shipped capabilities.

## Incremental loading data and static curves (RESULTCURVE1, added 2026-10-16)

Retrieve prescribed displacement, total axial reaction on the loaded face, gauge extension and calculation status at each displacement-controlled increment. Compare and save static force–displacement and stress–strain curves. Animated graphs are unnecessary; retain 3D deformation animation as a separate view. This task is queued. Existing numerical access or display-only deformation cycles do not establish graph support.

- **Data access**: Share incremental data across GUI/API/MCP. Retain input revision, geometry/material/supports/loading path, increment, units, convergence/provisional status, node/face selections and result revision. Aggregate loaded-face reactions for displacement control; distinguish prescribed force from computed displacement for force control. Connecting independent final results must not be presented as a stateful plastic loading/unloading history.
- **Stress–strain definitions**: Engineering stress is axial force divided by initial section area; engineering strain is gauge extension divided by initial gauge length. Maximum von Mises stress paired with maximum displacement is not a stress–strain curve. Record gauge/area provenance. Offer true stress/strain only when the necessary deformation data exists.
- **Views and exports**: Plot force–displacement and stress–strain with axes, units, legends and multiple-case overlays. Export CSV/JSON increment tables and static images. Identify proportional straight lines and coincident unloading paths for linear elasticity. Yield, hysteresis and fracture require supporting material data and solver capability. Distinguish display-scale oscillation from computed loading history.
- **Acceptance**: Verify uniform-bar reactions and extension against analytical solutions. For nonlinear support, verify continuous state history, reaction balance, an unloading reference and failed-increment handling. Confirm GUI/API/MCP, saved/restored results and exports agree, and an LLM can reproduce the curves from increment tables.

Dependencies and priority: extend P3 result access and P4 views/exports. Existing API/MCP/jobs work comes first; separate acquisition and plotting according to MOD1. The current examples may use increment tables plotted by the user's LLM, without claiming in-app graph completion. Implementing another material model or solver does not substitute for this task.

## Finite-strain viscoelastic-plasticity, damage and tensile testing (FINITEVISCO1, added 2026-10-16)

The goal is to distinguish time-dependent material hysteresis, post-yield permanent deformation, and finite-deformation cross-section reduction/necking, then compare dumbbell force-displacement and stress-strain behavior only when calibrated to experiments. The current small-strain J2 and rubber-oriented finite-strain Neo-Hookean paths do not implement this combination. Abaqus Parallel Rheological Framework (PRF) is a reference constitutive approach from an existing CAE; neither adopting Abaqus nor using it in the SolidCraft/Studio-only design demonstrations is required.

1. **Material data**: Collect tensile loading/unloading and stress-relaxation or creep data for a recorded material lot, print orientation/process, temperature and test rate. Do not assume FDM PLA is isotropic without stating the test evidence and treatment of anisotropy. Without material data, do not label results calibrated or predictive.
2. **Single-element constitutive validation**: Add large-deformation kinematics and objective stress updates, then introduce material behaviors in stages. Model time-dependent loops in the elastic range with finite-strain viscoelasticity (generalized Maxwell/Prony or PRF-like); yielding/cycling with finite-strain elastoplasticity/viscoplasticity; and load drop/fracture with damage/softening as a separate behavior. Match reference tests at the same material and loading times. First compare material-point/single-element loading rate, hold, unload, reload, dissipated energy and residual strain. Reject unsupported model combinations.
3. **Structural integration**: Track internal state, displacement, reaction, Cauchy and reference-configuration stress, strain measure and deformed cross-section at each converged physical load step. Validate large rotation/strain, element inversion, and force- versus displacement-control. Report true stress only when local area and strain definitions are supported.
4. **Necking and damage**: Compare neck initiation and post-peak response on the dumbbell. Assess geometric imperfection, local mesh, characteristic-length or fracture-energy regularization, and element deletion. Report mesh/time-step sensitivity and do not claim fracture prediction outside the calibrated data range.
5. **Results and LLM access**: Expose physical steps through RESULTCURVE1 history APIs/MCP so static force-displacement/stress-strain plots and 3D deformation can be compared. Verify that curves, 3D states and saved cases reference the same input revision, material, time history and calculation step. Display-scale animation is not physical load-history playback.

Dependencies and priority: Full-feature APIs/MCP, the LLM intermediate-result pipeline and job infrastructure remain the highest priorities; FINITEVISCO1 does not replace them as a publication goal. Before implementation, establish the MOD1 solver-adapter boundary, material provenance contract and physical result history. Accept each stage separately; do not proceed from single-element loops to the dumbbell until the material loop matches experiment. Keep the existing SolidCraft/Studio-only design and verification policy; external CAE tools are references only.

## In-app access to the user's AI (AGENTACP1 / AGENTCHAT1, added 2026-10-16)

Adopt the agent selection, connection and embedded-chat workflow exemplified by SolidCraft. Start with Codex and ChatGPT sign-in; model access and usage remain governed by the user's plan, visibly distinguished from API-key authentication. No proprietary AI subscription is required.

- **AGENTACP1 local connection**: Extend the existing browser connector to discover, start and stop ACP agents and guide authentication. A browser cannot directly launch local programs. ACP carries conversation and approval events; existing MCP/shared operations perform Studio actions. Provide Codex ACP adapter installation/update guidance, record supported protocol/adapter versions and preserve external MCP clients.
- **AGENTCHAT1 UI**: Add an AI toolbar entry, a collapsible chat panel and connection settings. Include agent selection, refresh, missing-install guidance, connection test, sign-in state, connect/disconnect and model selection when exposed by the agent. Keep manual endpoint/code entry in advanced settings. Provide bilingual messages, questions, operation cards, analysis progress, provisional/final result references, stop and connection recovery.
- **Permissions and analysis integrity**: Distinguish inspection, editing, analysis and save/export permissions, mapping them to existing scopes and identifying operations requiring multiple scopes. Retain explicit grants, Origin/Host checks, authentication and expiry. Never retain credentials in chat or diagnostics. Explain that a local connector can still send analysis information to the AI provider. Follow existing cancellation contracts on stop/disconnect, observe termination and prevent duplicate runs/exports after reconnect. Preserve physical provenance, input revisions and frozen running snapshots.
- **Skills and acceptance**: Document installation, ChatGPT sign-in, connection, inspection, edit preview/approval, solve, intermediate observations, results and save/export in the specialist skill. Initially verify a standard Windows browser against both public HTTPS and local serving. Exercise missing installation/login, usage limits, permission refusal, stale revisions, disconnect, cancellation and reconnect. A chat mockup alone does not establish completion.

Dependencies: AGENTACP1 uses P0/P3 and BROWSERCONNECTOR1; AGENTCHAT1 uses AGENTACP1 and existing operation contracts. Separate UI and connection modules according to MOD1. Incident recovery and existing API/MCP/jobs work come first. These are additional P3 plans, not automatic additions to the current publication gate. Both tasks are queued, with no implementation claimed.

Reference: [SolidCraft agent chat](https://github.com/bherbruck/solidcraft/blob/main/docs/agent-chat.md). Reuse the workflow concept; assess licensing and dependencies separately before incorporating external code.

## Upper priority: module boundaries and parallel development (MOD1, added 2026-10-15)

Prioritize independent maintenance and parallel development over additional physics, solvers and printing features. Publication incident recovery comes first; perform bounded structural improvements alongside existing API/MCP, jobs and result-access work. A complete React or WASM rewrite is not a new publication prerequisite.

1. Define TypeScript contracts for projects, materials, units, diagnostics, jobs and results; fix dependency direction and compatibility rules.
2. Extract materials, boundary conditions, analysis settings and result/export UI and state from `main.js`. Introduce React incrementally by screen, with explicit Three.js and Worker interfaces.
3. Separate discipline-specific execution adapters; keep common Worker responsibilities to dispatch, cancellation, progress and results. Reduce central branching changes for new solvers.
4. Establish boundaries for shared models, operation APIs, viewer, disciplines and runtime adapters, with independent tests, file ownership and integration procedures. Demonstrate separate UI and solver changes without editing the same central files.
5. Regress saved formats, GUI/API/MCP parity, numerical references, cancellation and restoration at each migration step. Move measured computational bottlenecks to WASM; assess Rust/C++ separately based on existing assets and validation scope.

Acceptance: checked types/public interfaces/dependency rules, representative UI and solver changes in independent file sets and tests, and restoration of existing projects/results. Directory moves or extension changes alone do not complete MOD1. Initially queued.

## First priority for the next solver (2026-10-15)

The first solver addition targets ordinary-speed airflow around complex fixed solids such as a rough cow, with velocity and pressure fields. Use low-Mach incompressible viscous Navier–Stokes with inertia, beyond existing Re <= 0.1 Stokes. Ordinary wind can have high Reynolds numbers at object scale; assess required steady/unsteady and turbulence scope rather than assuming laminar flow meets the use case.

Existing I/O, API/MCP/Skill and publication work retains priority. This external-flow solver comes first among solver additions; additional structural models, Mach-2 shocks and meshfree methods follow. Research can proceed, but this priority change does not declare any unverified solver supported.

1. Evaluate existing OSS first; pin version, runtime/distribution requirements, wall/far-field boundaries, meshing, input, cancellation and result contracts. Do not require custom development or WASM porting first; establish a native baseline.
2. Validate simple reference geometries for velocity, pressure, drag, mass balance and domain/mesh/time-step dependence. Declare the unsteady/turbulence scope needed at the selected Reynolds numbers.
3. Import a rough closed cow solid, verify leg gaps and near-wall mesh resolution, and connect shared inputs, intermediate observations, final results and visualization/export.
4. Retrieve velocity vectors, pressure maps, sections and point measurements through API/MCP. Provide physical-time movies only from computed time histories. Start unverified SolidCraft integration with STEP exchange.

See the [CFD plan](compressible-cfd-plan.md) for the subsequent compressible work.

## Priorities before publication (revised 2026-10-15)

Prioritize inputs, observations, result retrieval, views/exports and LLM documentation for existing capabilities over additional physics or solvers. The publication milestone is an end-to-end workflow using the user's ordinary browser and own LLM, from input through saved results and revised settings without computer use. These are future acceptance gates, not claims of shipped capability.

| Order | Plans | Priority work | Acceptance |
|---|---|---|---|
| 0 | Publication foundation | Repair failed publication and reconcile candidate, deployed assets and progress revisions | Required CI and public-environment checks succeed; retain a release tag and verification evidence |
| 1 | P0/P1 | Close existing input, capability, unit, provenance, unconfirmed-input and structured-diagnostic gaps | Record GUI/API/MCP/Skill coverage per operation; verify success, refusal and repair paths |
| 2 | P3 | Complete shared jobs, observations, cancellation/settlement/release and ordinary-browser connectivity | Associate stages, residuals and supported fields with input revisions; expose units, provisional status, sampling, retention limits and unavailable observations. Verify public HTTPS connectivity in the actual environment |
| 3 | P3/P4 | Align final-result retrieval, storage, restoration and comparison | Trace quantities, units, input/result revisions, meshes, settings, engine versions and assumptions; verify chunked retrieval, integrity and remeasurement after storage |
| 4 | P4 | Complete camera/color/time-range controls, view restoration and reproducible image/video export | Preserve PNG/WebM; declare capabilities and limits for fixed frames, MP4/GIF and comparison videos. Unsupported requests return reasons and verified alternatives. Manually converted external videos do not count as product support |
| 5 | Across P0–P4 | Align LLM Skill, operation contracts, runnable examples, repair examples and public verification | Synchronize distributed and repository Skills; reproduce pairing, import, setup, preflight, solve, observation, comparison, export and revised settings through MCP alone |

Documentation and verification in order 5 accompany every change rather than waiting until the end. Do not require every iteration field from every solver. Require an explicit contract for available/unavailable observations, physical versus presentation time and provisional versus final results. Numerical convergence remains distinct from physical validity.

Prioritize P2/P6 only where acquisition, performance, compatibility or stability supports this workflow. A full rewrite or general native product is not a publication prerequisite. Keep P5 SolidCraft integration, general/compressible/meshfree CFD, contact/additional coupling, printing analysis/test equipment and new streamline/particle visuals in the later backlog. Preserve research without delaying publication work.

Track the current publication milestone separately from future extensions, including unfinished, verification-pending and publication-pending items. Adding or splitting tasks must not automatically expand the milestone. Close verification items against acceptance evidence; documentation changes alone do not justify released status.

Develop with small commits and frequent pushes to working branches. Review PR diffs, appropriate tests, API/MCP/Skill and bilingual documentation, and necessary browser behavior before merging into main. Main protection requires PRs, an up-to-date branch and the GitHub Actions `verify` check, including administrators. These settings were read back through the API; see [protection evidence](../evidence/2026-10-15-main-protection.json). Successful deployment is distinct from progress JSON updates.

## Highest-priority product principle (confirmed 2026-10-14; order revised 2026-10-15)

The primary differentiator is that the user's own LLM can freely compose all application functions through a specialist SKILL to perform analysis and design iteration. The product does not assume a proprietary AI or an AI subscription operated by this application. Users choose their LLM, contract and execution environment; the application supplies shared APIs, MCP, specialist skills, validation and traceable results.

Full API/MCP coverage, continuous specialist-SKILL development and a pipeline delivering intermediate results to the LLM have highest priority. Expose preparation, mesh quality, iterations/residuals, completed time steps and provisional measurements with job IDs/input revisions, compact summaries and detailed artifact references. Declare solver limitations when intermediate fields are unavailable. Observation and preparation of subsequent settings must not mutate a running snapshot.

New GUI features include semantic APIs, MCP operations, observable state/diagnostics, SKILL guidance and verification scenarios in the same work item. Skills teach supported scope, units, physical assumptions, repair and provisional/final distinctions without silently changing models or engines. Acceptance measures API coverage, MCP-only task completion, intermediate observation/reconfiguration and reproducible SKILL-driven examples.

Start with P0/P1, then prioritize P3 intermediate-result/shared-job pipelines and API/MCP coverage of existing functions in P4. Include specialist-SKILL updates and scenario verification in every stage. P2 supports this path as necessary. Additional visualizations, physics models and printing extensions follow; separate new P4 visuals from API/MCP coverage of existing features.

## Baseline and tracking

The published baseline is v0.43. Its recorded verification is 242 tests, 26 runtime checks and 42 browser checks; these were not rerun for this documentation review. Reuse STEP/regions, shared APIs, volume meshes, Airpocket structural/thermal/limited-flow/acoustic/modal analysis, MFEM linear-structural WASM, cases, PNG/WebM and saved-JSON MCP. Scope restrictions remain in the analysis guide and discipline documents.

`src/progress.json` tracks existing tasks and release evidence. Early task descriptions retain historical scope and are not a complete current capability list. P0–P6 below are registered planning identifiers in progress JSON. Register implementation tasks with dependencies, acceptance criteria and evidence when work starts; a plan alone does not justify released status.

Keep REG2 and PRINT2 in progress. Reuse unresolved-region rejection in P1. Finish a bounded save/refusal/regression checkpoint for the orthotropic foundation; prioritize the publication priorities 0–5 above over further printing extensions. Orthotropic infrastructure does not complete printed-part analysis.

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

Partial implementations exist for P0 capabilities/diagnostics,P1 input/provenance,P3 shared jobs/optional browser connection,P4 existing viewer/export APIs and P6 fixed-bar native comparisons. These stages remain incomplete;building means work has started. P1 explicit-input/provenance contracts now cover static isotropic/orthotropic structure,isotropic modes,temperature evaluation/thermal stress,small-strain J2/Neo-Hookean,thermal,acoustic and limited flow. Physical-source applicability,post-mesh boundary/constraint checks and assessment/unsupported-combination diagnostics remain ongoing. Continue P3/P4 recovery,complete operation coverage and reproducible-output gates. Dates,owners and performance thresholds remain unset.

## Decision gates

- Before P1: settle API/save schema compatibility, migration and unsupported-version rejection against existing projects, cases and the full current shared API/MCP operation contracts.
- Before public P3 acceptance: validate the chosen temporary-local connector with public HTTPS and the same-origin serving alternative, environment-specific setup/permissions, authentication, sharing, disconnection and installation-free reach. Local computation does not imply no external data transmission.
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
- PROCESSISOLATION1: Optional same-executable Node child isolation preserves intermediate APIs/MCP and waits for close after failures,cancellation and timeouts. Validate containment separately from V8 root-cause resolution.
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

## 2026-10-15: Bounded P0/P1 execution-failure diagnostic increment

Added bounded failure schema1 transport from Worker through hosts, jobs, GUI wrappers and MCP while preserving legacy messages/JOB_* codes. Verification covered 33 targeted tests, six real MCP failure scenarios, a direct failure response and subsequent success of an explicitly declared valid model. The real GUI reproduced insufficient constraints at rank 3/6 and ran a separately declared fixed-base/100 N comparison model. See [testing](testing.md) and the [overall record](../evidence/2026-10-15-execution-failure-full.json).

This is a bounded increment in P0/P1 information for diagnostic and repair decisions. Stage fallbacks do not prove root causes, and comparison-model success does not prove repair of intended user physics. completePhysicalValidation:false and subsequent mesh/boundary/convergence/source-applicability checks remain. The full P0–P6 plan and existing remaining tasks are incomplete; phase completion gates are unchanged.

## 2026-10-15: Bounded P0 discovery/P3 direct-failure increment

Added session-free discovery of all 80 operation contracts through default MCP and preserved direct browser exception failure metadata through HTTP/MCP. Verification covered 28 targeted tests, real MCP and local GUI catalog retrieval/input creation/invalid-frame refusal/unchanged input revision/explicitly corrected editing/scope refusal. See [testing](testing.md), [GUI evidence](../evidence/2026-10-15-browser-operation-contracts.json), [screen](../evidence/2026-10-15-browser-operation-contracts.jpg) and [overall record](../evidence/2026-10-15-operation-contracts-full.json).

No solver was run in GUI verification. This completes only the bounded P0/P3 increment: complete nested physical schemas, public HTTPS, cross-restart job recovery and the full P0–P6 plan remain unfinished. Discovery does not grant access or certify physical validity; existing completion gates remain unchanged.

## 2026-10-15: Bounded P1/P3 edit-candidate increment

Read-only preview adds candidate revisions, changed pointers, compact preflight and explicit normalization; expectedResultingRevision binds commit to the actual saved host representation. Checks include 30 new tests, old/new agreement across 24 GUI study states and real GUI preview of 150 N while a 100 N job remained running, with original input/snapshot unchanged and commit only after completion. Two explicitly declared analyses succeeded at center 0.02/0.03 mm and maximum 0.04/0.06 mm. See [testing](testing.md), [GUI evidence](../evidence/2026-10-15-browser-edit-preview.json), [screen](../evidence/2026-10-15-browser-edit-preview.jpg) and [overall record](../evidence/2026-10-15-edit-preview-full.json).

Keep initial size 0.6 stack overflow and HMR-blocked complete export separate from the main successful evidence. After correction the 30,000-element limit remains and rejects that fine candidate. This adds no user-facing UI feature or general physical-accuracy guarantee. Full P1/P3, public HTTPS, cross-restart jobs, all P0–P6 and resolution of the known V8 issue remain incomplete; completion gates are unchanged.

Publication run [38651016310](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/38651016310) passed verify,deploy and verify-published for103065f,including26public runtime checks and an annotated release tag. See [publication record](../evidence/2026-10-15-publication-103065f.json). PUBLISHEDPROGRESS1/PUBLICATIONGATES1 add manifest-bound progress and runtime gate validation; they remain checking after recurrence of the known defaultNode24 V8 fatal. Public HTTPS pairing,positive browser progress adoption and the other publication gates remain incomplete.

Publisheda446dc5 passedCI,26runtime checks,annotated tagging and actual JP/EN browser progress adoption. Only publication gate0 is complete with candidate-specific evidence;five gates and the fullP0–P6 objective remain open. See [publication](../evidence/2026-10-15-publication-a446dc5.json) and [browser proof](../evidence/2026-10-15-published-progress-browser.json). INPUTINSPECTION1 covers bounded input reading,SKILLROUTING1 workflow references/distribution synchronization,andMCPARGUMENTTYPES1 positional types. The limited Skill evaluation used supplemental SDK knowledge;Skill-only end-to-end completion and updated registered-host projections remain unverified.

## 2026-10-15: Contract discovery, saved validation and pending observations

Expose evidence/intent edit arguments through MCP discovery, validate every saved case through restoration, and reject planar rotation controls without a matching frame. Bound pending observation count/estimated bytes independently of retained storage, exposing drop reasons and source sequence. Track PROVENANCECONTRACT1, CASEARCHIVEVALIDATION1, PLANARROTATION1 and OBSERVATIONQUEUE1 as verification work rather than published completion.

Worker transport backpressure and event-ring payload/page byte limits remain P3 follow-ups; current queue limits do not bound total JavaScript heap. Preserve public HTTPS, saved comparison/same-point remeasurement, Skill-only end-to-end and all P0–P6 acceptance requirements.

JOBEVENTBYTES1 implements P3 event payload/retention/page limits with explicit gaps and cursor continuation. This is separate from OBSERVATIONQUEUE1 pending-storage limits; Worker transport backpressure remains open. Track ongoing fluid PR #7 integration independently without treating its common API/MCP/Skill connections as complete.

PUBLICATIONISOLATION1 prioritizes publication verification repair by isolating numerical checks in same-Node child main processes. Full suite: 980 tests, 977 passed, 3 skipped, zero failed; all 26 local checks passed. Preserve the original Linux V8 failure, without claiming a root fix or browser stability. CI and published-candidate evidence remain separate requirements.

DEVINSIGHTS1 adds six-status history and fixed-criterion product estimates to the management page, separating observation from subjective scoring. Optional studio_progress arguments expose the same data to the user’s LLM. Full1011tests/zero failures and real UI verified; publication acceptance stays candidate-specific.
