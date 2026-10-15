# Jobs Observations

Repository-version reference. Discover actual connected tools before using names below; older registered servers may expose only a subset. Read only the sections needed for the task.

## Discover retained artifacts

Before fetching an intermediate artifact, use studio_job_artifacts({jobId,offset:0,limit:50}) or inspect-scoped live jobArtifacts with the same page arguments (maximum100). Node service listArtifacts and browser analysisApi.listJobArtifacts return metadata only, total and nextOffset. Select an artifactId, then retrieve using existing studio_job_artifact/jobArtifact validation. This rediscovery works even after relevant events are truncated. Catalog listing does not rehash files; retrieval performs existing hash/revision/mesh checks. Released jobs are unavailable, and same-process retention does not provide persistent restart recovery.


## Restart recovery (opt-in, metadata only)

Only when the MCP server was started with --job-store=<absolute directory> are small job records kept and reloaded. After a restart studio_job_status/studio_job_events/studio_cancel_job/studio_release_job work on restored:true metadata with resultAvailable:false: no result body, events, intermediate artifacts or mesh output are restored (re-run the job if you need them), terminal states keep their recorded state, and a job that was running or saving becomes state interrupted with error.code ANALYSIS_JOB_INTERRUPTED_BY_RESTART, executionSettled true and releaseAllowed true; it is never resumed or re-run. studio_release_job also deletes the record. requestId idempotency is not carried across a restart. Without the option nothing is persisted and unknown jobs are still reported as Unknown job. Tool and operation counts do not change.

## Select a body for intermediate samples

Intermediate jobArtifact/studio_job_artifact point reads accept bodyIndex or elementIndex with point; node pages retain available nodeBodies. If an interface point touches multiple bodies, an unspecified sample is ambiguous and refused: select the intended body/element explicitly. Final studio_probe also supports bodyIndex. Legacy meshes lacking body IDs cannot accept body selection; do not infer or reconstruct missing nodeBodies. Existing hash/mesh/revision checks remain.

Intermediate mesh summaries expose bodyIdentifiersAvailable:boolean and bodyCount:number|null; legacy missing IDs mean unknown bodyCount:null. Node pages include nodeBodies only when IDs exist.

## Select an observation-capable route

Inspect capabilities.observation.profiles and diagnoseExecution/preflight selectedObservation before requesting intermediate data. Profiles describe implemented solver/model/method observations, not physical validity or execution support: inspect allowed separately. CPU linear PCG iterations, modal residuals, nonlinear load steps and thermal/transient-acoustic fields differ; no internal Newton residuals/every-iteration fields are implied. MFEM/WebGPU paths can offer stage/text only. Harmonic acoustics and frequency sweeps expose BiCGStab residuals; channelFlow exposes PCG residuals. Zero iterations may emit no event. Supported fields still depend on includeFields, shared64 MB retention, successful observations and execution.

selectedObservation includes supported/profileId/profile/reasons, adaptive flags and fieldRetention(requested/available/maxBytes64000000/eventRetention256), with declarationOnly:true/physicalAccuracyVerified:false. acousticSweep emits frequency-step start/complete events; adaptiveSolve does not accept onObserve, so do not promise structured adaptive-round numerical events.

fieldRetention.available describes requested scalar/vector-field eligibility; inspect scalarFieldsSupported/vectorFieldsSupported/meshSupported/meshAvailable separately. Mesh may be available on CPU routes with no numerical fields; availabilityIsGuarantee:false applies. Catalog has13 browser/12 Node profiles (no Node WebGPU), including shared preparation/mesh/progress text stages. diagnose_execution accepts includeFields; preflight accepts adaptive/includeFields. Invalid diagnostic options fail, whereas preflight returns structured diagnostics with selectedObservation.supported:false. Existing saved analysisAssessment format is unchanged.

MCP capabilities/diagnose_execution/preflight_project include top-level runtime with only node/v8/platform/arch (missing values null), schemaVersion1/kind node. Exact observed Windows x64 Node24.11.1/V8 13.6.233.10-node.28 reports observed-risk and NODE_WASM_ALLOCATION_FATAL_OBSERVED unresolved evidence; others are not-assessed, not proven safe. compatibilityVerified/rootFixProven are false. This does not block execution, change defaults or alter physical-input allowed/assessment. Portable studioApi capabilities do not include host runtime.

## Inspect nonlinear step displacements

includeFields:true enables converged plasticity/hyperelastic step structuralDisplacement fields; opt-out produces/transfers no new vector fields and final results are unchanged. Catalog/profile eligibility distinguishes scalarFieldsSupported and vectorFieldsSupported; available covers either, not guaranteed retention. Read field step/steps/loadFactor (actual unloading factor, not seconds), solver and min/max magnitude in mm. Pages expose displacementMm:[[x,y,z],...]; point samples expose displacementMm/magnitudeMm with step metadata. No time, stress or internal Newton residual is supplied. Step convergence is not final-job/physical accuracy validation; keep provisional labeling and existing body selectors/hash/retention/release rules.

## Interpret Stokes GMRES observations

Read iteration events with solver:stokes-gmres/velocityElement:P1|P2 and phase/residualKind. restart-check/preconditioned-relative measures the equilibrated left-ILU0 reduced system at outer-loop starts including0. arnoldi-estimate/preconditioned-relative-estimate is an estimate at first/each10th/break-before inner iterations. final-check/true-relative is the original nondimensional full-system free-equation residual divided by rawRhs norm after its1e-8 numerical check. All are dimensionless; no intermediate field arrays are added.

converged applies only to the named residual criterion. Later regime checks/job completion can still fail; preserve provisional labels and do not infer physical accuracy, flow balance or mesh independence. Zero-RHS skip still emits final-check at0.

## Interpret harmonic-acoustic and channel observations

Use existing jobEvents. acoustic-frequency exposes iteration/solver:bicgstab/kind:acoustic with frequencyHz/solvePhase:single|sweep and residualKind:recurrence-relative. Distinguish phase:s-check/r-check/zero-rhs. Sweeps add frequency-step/solver:acoustic-sweep start/complete with step/steps/frequencyHz; complete includes residual/iterations/peakPressurePa/splDb. A failed frequency may lack complete. Channel iteration/solver:pcg/kind:channelFlow has the same residualKind and no phase.

Residuals are dimensionless recurrence norms relative to the eliminated RHS, not independent true checks. Cadence is first/every25/convergence (BiCGStab also iteration limit); acoustic zero RHS emits iteration0, channel emits none. No physical-time axis or pressure/velocity field arrays are added. Check terminal state and later radiation/probe/Re/Mach validation; converged alone does not establish success or physical accuracy. Profiles remain13 browser/12 Node; these routes keep fields empty.

Nonfinite residuals/tolerances are omitted from telemetry, not normalized into valid numbers or JSON null. Sweep complete also requires finite residual/iterations/peakPressurePa/splDb metrics before notification. Computation, stopping rules and original errors remain unchanged; inspect terminal job failures even when no event is emitted.

## Reconstruct an intermediate mesh

For an artifact that needs external reconstruction, retrieve its ordinary node pages and `pageKind:"elements"` pages through studio_job_artifact/live jobArtifact, with offset/limit<=200. Element pages return tetrahedra of four global node indices and optional elementBodies. Node/element identities are each page.offset+i; preserve the artifact's mesh/input hashes. Follow nextOffset while hasMore. Default limit0 remains summary-only. Element pages reject point/bodyIndex/elementIndex measurement selectors. Use the same retained intermediate mesh; a later adaptive final mesh can differ. Missing body IDs stay unknown. These values remain provisional and retrieval is not physical validation.

## Save a completed browser job without changing current input

When current input has moved from A to B, do not restore A merely to export A's completed result. Discover inspect-scoped jobResultExport/jobResultRead/jobResultRelease. Supply A's succeeded,executionSettled jobId and exact inputRevision to export. Retrieve bounded base64 chunks,decode in offset order and verify raw UTF-8 totalBytes/SHA256 before parsing the analysis-output JSON. It includes the retained input/calculation/mesh/boundary/result; preserve physical units and provisional assessment. Release the transfer after saving. Transfers belong to the paired session and disconnect invalidates them. This does not apply/display a result,create a case,or invent missing engine-build identity. Discover actual limits from metadata/contracts; unsupported older deployments require an explicit alternative.

For execution provenance, inspect retained output.calculation.runtimeIdentity (also exposed when recorded by caseList). See [preserving calculation identity](case-archives-measurements.md#preserve-calculation-runtime-identity) when comparing builds/engines. Missing legacy values stay unrecorded.

## Pending intermediate payload limits

Independently of the 64 MB retained store, pending mesh/field processing defaults to eight events and 8,000,000 estimated bytes, including the active consumer. The host reserves structural estimates before cloning/serialization; excess snapshots are dropped while summaries, diagnostics and final calculation continue. Read reasons and counters in `observation-queue-limit` / `observationQueue`, browser completion `intermediate.queue`, or Node `intermediateQueue`. Capabilities `observation.pendingPayloadQueue` declares host defaults; startup overrides may differ, so use actual job metadata.

`observationSequence` records source order. Summaries/diagnostics bypass asynchronous storage and may precede older field publication. latestPolicy is last-accepted-snapshot, not replacement with the latest rejected field. Rejected meshes prevent subsequent fields binding to an old mesh. accepted/latestCompleted mean queue admission/consumer completion, not successful artifact retention; verify artifact references and integrity separately. Cancellation releases waiting payloads and drain waits for in-flight work.

The conservative structural estimate does not bound total JS heap, Worker postMessage queues or arbitrary event-ring payload bytes. Report dropped observations and limits rather than claiming complete intermediate fields.

## Job event payload and page byte limits

Defaults: 32,768 UTF-8 bytes per event, 1,048,576 retained event bytes and 256 events per job, and 65,536 bytes for the entire jobEvents JSON value. Events are returned whole; fewer events than requested is valid, so follow nextSequence/hasMore. Count/byte eviction removes oldest entries and remains detectable through firstAvailableSequence/truncated. eventRetention reports effective budgets/current retained count/bytes; eventPageBytes reports actual JSON-value bytes.

Oversized or unsafe observations (cycles, non-finite numbers, accessors, etc.) become same-sequence `observation-event-gap` events with `payloadOmitted:true` and `gap.reason`. Getters are not invoked; missing physics is not filled with zero/null. Gaps do not mean solver failure or convergence. Ordinary small metrics and valid structured primary failures remain available. Oversized status summaries expose summaryOmissions; error messages are capped at 2,048 UTF-16 code units with messageTruncated/originalMessageLength. Cancellation, settlement and release semantics remain unchanged.

Capabilities observation.eventPayload declares defaults and scope. Internal startup budgets must fit valid failures/envelopes; tiny values are rejected. The 64 KiB limit covers jobEvents JSON values, not transport envelopes. MCP duplicates values in text/structuredContent, so complete JSON-RPC/HTTP wire payloads can exceed 64 KiB. Worker transport and total JS heap remain outside this guarantee. Retrieve complete final results through dedicated jobResultExport/Read chunked transfers; do not reconstruct them from event summaries.

## Inspect boundary transfer after a mesh-only job

For a saved project, call `studio_preflight_mesh_boundaries` with its absolute `path`, a retained `jobId`, and the exact SHA-256 `inputRevision`. First create the job with `studio_start_analysis` and `operation:"mesh"`, then wait until `studio_job_status` reports `state:"succeeded"` and `executionSettled:true`. The inspection reads that retained mesh and its frozen input; it does not remesh or solve. For a paired live browser, discover and invoke `meshBoundaryPreflight` with `jobId` and the inspected `inputRevision` under the inspect scope. Both routes reject stale revisions, failed/pending/non-mesh jobs and unsupported study/material combinations, and preserve boundary-transfer diagnostics. The supported scope is static linear structural input. `completePreflight` remains false: constraint rank, rigid-body modes, convergence and physical accuracy are not checked. This is a read-only transfer check, not proof that the supports make the model solvable.

## メッシュ専用ジョブ後の境界転送確認

保存プロジェクトでは、絶対パスの `path`、保持中の `jobId`、正確なSHA-256 `inputRevision` を指定して `studio_preflight_mesh_boundaries` を呼び出します。先に `studio_start_analysis` を `operation:"mesh"` で実行し、`studio_job_status` が `state:"succeeded"` と `executionSettled:true` を返すまで待ちます。この確認は保持されたメッシュと凍結入力を読み取り、再メッシュもsolveも実行しません。接続済みライブブラウザーでは、inspect scopeで `meshBoundaryPreflight` の契約を確認し、`jobId` とinspectで得た `inputRevision` を渡します。どちらも古いrevision、失敗中・未settled・mesh以外のjob、非対応のstudy/materialを拒否し、境界転送診断を保持します。対象は静的線形構造入力です。`completePreflight` は常にfalseです。拘束rank、剛体モード、収束、物理精度は未確認であり、この確認は読み取り専用の転送検査で、支持条件がモデルを可解にする証明ではありません。
