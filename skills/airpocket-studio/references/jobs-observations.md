# Jobs Observations

Repository-version reference. Discover actual connected tools before using names below; older registered servers may expose only a subset. Read only the sections needed for the task.

## Discover retained artifacts

Before fetching an intermediate artifact, use studio_job_artifacts({jobId,offset:0,limit:50}) or inspect-scoped live jobArtifacts with the same page arguments (maximum100). Node service listArtifacts and browser analysisApi.listJobArtifacts return metadata only, total and nextOffset. Select an artifactId, then retrieve using existing studio_job_artifact/jobArtifact validation. This rediscovery works even after relevant events are truncated. Catalog listing does not rehash files; retrieval performs existing hash/revision/mesh checks. Released jobs are unavailable, and same-process retention does not provide persistent restart recovery.

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
