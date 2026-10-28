# Inventory of pending verification and unimplemented work (2026-10-23)

[日本語](../verification-inventory-2026-10-23.md)

This inventory fixes candidate `5647a6ff36e2ff5e5a886e770d9e2cb1829c5b72` and compares the progress source, critical path, existing audit, parallel implementation report and all 20 orders numbered 52–71. The [machine-readable inventory](../evidence/2026-10-23-verification-inventory.json) retains source SHA-256 values and acceptance criteria for every one of the 37 unfinished IDs. Order documents were read from the primary checkout without modifying it. Concurrent browser/runtime work is not credited before its evidence exists.

## Orders 52–71

| Order | Existing implementation at the fixed candidate | Remaining work classification |
|---|---|---|
| 52 | Real-solve staged bundle, audited bounds/capacity/residual fixes | Final candidate CI/publication verification; displacement control and general nonlinear history remain separate unimplemented features |
| 53 | Single/comparison graphs and limited Chrome evidence | Verify complete Blob bytes/hash, enlargement, 390px, delayed selection, unchanged revisions and HTTPS; root owns this work |
| 54 | Bounded ACP text session and synthetic subprocess tests | Limited unit verified; actual Codex entry/authentication are external prerequisites, GUI/MCP delegation unimplemented |
| 55 | Connection status UI and Node session | Chat panel session wiring, generations, send/stop behavior unimplemented; locale/390px/keyboard checks follow implementation |
| 56 | Restored job discovery, requestId rejection, settlement tests | Verify real stdio stop/restart/unavailable-result/new-request loop; adding persistent results is outside this order |
| 57 | Background recording, lock cleanup and limited hidden evidence | Verify actual session expiry during recording and locale/foreground/background/non-selected matrix; root owns this work |
| 58 | Chrome cold/warm/cancel measurements at two scales | Existing measurement lacks isolated 3-second inter-case idle and normalized exportProject snapshot/hash; correct procedure and remeasure |
| 59 | Second-browser measurement plan | Depends on order 58 fixed input; capability inventory and same-input cold/warm/cancel checks unperformed; installing a browser is not a prerequisite imposed here |
| 60 | SU2 fine-mesh raw/config/hash and evaluator | Existing reference fails mesh Cd difference: 4.1226959% versus 3%; bounded further numerical verification, without tolerance relaxation |
| 61 | Nodal far-field integration and SU2 adapter | Solver-integrated discrete face-flux extraction/parser unimplemented and output evidence absent; nodal integration cannot substitute |
| 62 | Prepared Tet4 record and force/moment validator | Explicit boundary-node-set to record adapter unimplemented; existing host/WASM evidence does not validate that new adapter |
| 63 | Dataset import, units, separation, raw source hash | Exact capacity, independent compression oracle and public type regression completed here; physical data/calibration external, identification/GUI unimplemented |
| 64 | Explicit candidate confirmation to existing half-space cap | ID/version/clearance/normal boundaries and public types checked here; local CAD lids/arbitrary wires/UI unimplemented |
| 65 | Conforming limited orthogonal-cell Tet4 conversion | Maximum-capacity independent volume/outward normals/areas checked here; general Gmsh boundary layers/flow/y+ unimplemented |
| 66 | Linear nonuniform total heat and single-triangle nodal reference | Independent nonmatching nodal integration, partial coverage and serialized-operator equivalence remain to be checked against supported scope; general iterative solver unimplemented |
| 67 | Independent penalty oracle, opening/contact/unloading/reversed load | Limited static reference independently audited; general history/friction/3D contact unimplemented |
| 68 | Closed-Tet complex pressure force/moment/rigid virtual work | Limited independent reference checked; general curved accuracy and production coupled solver remain unimplemented/unverified |
| 69 | Time/view helpers and main selection path | Extract one generation/cancellation path and add A→B→A/stale/disposal regressions; existing helper tests do not fulfill the extraction |
| 70 | Specialist Skill and single/comparison MCP | Procedure update and fresh independent loop pending; full bytes/hash, input invariance and tampering checks owned by root |
| 71 | Progress/publication validators | This inventory is input only; accepted PR/head/final CI/manifest/public verification reconciliation remains pending |

## Verification completed here

PRINT2 accepts exactly 2,000,000 UTF-8 bytes and rejects one byte more, with the over-limit string still below the character-count guard. Exactly 100 specimens and 10,000 aggregate samples are accepted; each plus one is rejected. An independent 2×5 mm section with −30 N and −0.4/20 mm gives −3 MPa and −0.02, identically after m/kN conversion.

CFDPORT1 verifies a 64-character cap ID and safe integer mesh-version endpoints, rejecting overlong IDs, fractions, negative and unsafe versions. Strict inward clearance at the existing 1e-6 mm rule and the existing 1e-8 normal tolerance remain unchanged.

CFDMESH1 at 512 wall layers generates 2,056 nodes and 3,078 Tet4 elements. Independent scalar triple products give 2,000 mm³ with every volume positive. Independent boundary cross products verify outward orientation, 2 mm² on each wall and zero total boundary area vector. The existing seven-cell 20 mm³ reference and over-capacity rejection tests were rerun.

Positive/negative type fixtures now import the public runtime modules for all three APIs. Adjacent declarations for orders 64/65 expose their existing contracts. A normal Node test compiles the fixtures, including the prior order 64 fixture; previously declaration validation and standalone manual compilation did not exercise all fixtures in ordinary test runs.

The combined focused run passes 99 tests with zero failures/skips. Ten contract declaration files and the diff check pass. These results do not establish physical accuracy, actual browser behavior or publication.

## All unfinished IDs and publication gates

The progress source contains 171 tasks: 134 released, 12 queued, 21 building and 4 checking, hence 37 unfinished. No status changed. Older counts within historical critical-path paragraphs remain historical observations.

| Group | Complete ID set | Why it stays unfinished |
|---|---|---|
| 15 mixed verification/implementation tasks | REG2, CFDMESH1, COUPLE3, CONTACT1, COUPLE4B, CFDPORT1, PERF1, UIIMPROVE1, AGENTINPUT1, VIEWCOMPARE, VIEWTIME, BROWSEREXPORT1, AGENTACP1, AGENTCHAT1, RESULTCURVE1 | Parent acceptance still includes general geometry/accuracy, GUI/API/MCP, persistence, actual browsers and publication |
| 7 tasks with physical/external conditions | PRINT2, PRINTMEASURE1, PRINTMEASURE2, PRINTMEASURE3, RUNTIMEWASM1, EXPORTBACKGROUND1, FINITEVISCO1 | Measurements, instrument calibration, runtime cause and actual browser expiry require their own evidence; independently executable software checks proceed separately |
| 15 parent epics | MESH1, CFD1, COUPLE1, FAIL1, CFD2, CFD3, COUPLE5, MOD1, P0, P1, P2, P3, P4, P5, P6 | Limited child tests/research/synthetic fixtures cannot replace full acceptance |

The publication milestone retains one complete gate and five pending gates. Its completed evidence belongs to an older candidate and does not certify CI/deployment/public verification for `5647a6f`. This audit did not refetch remote candidate CI/manifests/verification. Final integration must reconcile newly produced evidence without promoting an unpublished candidate or its parent tasks prematurely.
