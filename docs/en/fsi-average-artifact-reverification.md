# Saved FSI average-force artifact recomputation

[日本語](../fsi-average-artifact-reverification.md)

`node scripts/verify-fsi-average.mjs --request <absolute JSON> [--output <new absolute report.json>]` pins a [saved worker artifact](fsi-average-file-cli.md) by raw SHA and reruns its explicit initial configuration once in an owned Node worker. Original files are never written. This does not establish calibration, authenticity, physical accuracy, general equilibrium or general FSI validity.

The exact request is `schemaVersion:1,artifact:{path,expectedSHA256},tolerances:{relative,absolute:{displacementM,velocityMPerS,arealEnergyJPerM2,tractionPa,tractionImpulsePaS,arealMomentumKgPerMS,dimensionless}}`. All values are explicit. Relative tolerance is finite0..1e-6; this is the same-method service applicability bound, not an accuracy certificate. Seven finite nonnegative absolute tolerances carry their respective units. There are no defaults; all zero requests exact numeric equality. Comparison uses `|saved-recomputed| <= absolute[quantity]+relative*max(|saved|,|recomputed|)`. Pa and J/m² are not implicitly merged. Nonfinite differences/thresholds/diagnostics refuse the operation instead of producing successful Infinity-to-null JSON.

Strict UTF-8/JSON limits are64KiB request,4MiB artifact and64KiB report. Decoded duplicate keys, unknown fields, nonfinite values, excessive depth/count and invalid profile/history data are refused. Regular/link-free paths and before/after FD identity checks retain the existing read policy. After expected raw SHA verification, checks enforce methodVersion1, synthetic/calibrated flags, settled execution, source shape, canonical configuration hash, normalized settings, exact times and work bounds. Shared no-advance admission rederives the configuration and2000000-cell-step bound before starting the worker.

Every history/profile value, initial energy, maximum x-spread and derived final summary is compared. Configuration/version/metadata/time/integer work are exact, without interpolation. Reports contain per-quantity counts, maximum absolute differences/thresholds and at most eight mismatch pointers. `matched` means only within supplied tolerances; nonzero permitted differences retain `exactNumericMatch:false`. Numeric mismatch returns status `mismatch`, exit2 and an optional diagnostic report. Structural/hash/compute/cancel/timeout refusals exit1 without a completed report. Matches exit0.

Legacy methodVersion1 artifacts lack the original raw request text and Node/V8/runtime identity. Reports therefore always state `originalSourceRecomputed:false,originalRuntime:'not-recorded'`. Source bytes/SHA are shape-checked and bound by the expected artifact hash, not independently rederived or authenticated. Current Node/V8/platform/architecture are recorded separately, without claiming cross-runtime equivalence.

Execution shares the immutable-text/private strict configuration/owned worker boundary, waiting for exit0 and private stdout/stderr closure. Cancellation/timeouts await termination and actual exit; unexpected worker output is not forwarded and refuses execution. The maximum120s timeout covers worker execution, not all OS filesystem I/O. Optional reports use exclusive atomic publication. The complete return value including prospective publication metadata and cleanup-code margin is bounded to64KiB before publication. Cancellation after publication starts does not undo a complete report.

Tests cover real legacy-artifact CLI replay, per-unit tolerance boundaries, pre-worker raw/hash/config/time/work refusals, nonfinite comparison rejection,4097-row histories,4MiB/64KiB boundaries, changed FDs, owned cancellation, concurrent publication and byte-identical existing saved-CLI golden artifacts. The original [synthetic linear laminar tangential-wall scope](fsi-channel-average-force.md) is unchanged.

[Dated execution evidence](../evidence/2026-11-07-fsi-average-reverification.json)

## Formal MCP

`studio_reverify_fsi_average({request,output?})` uses the same saved recomputation service. Optional output is an exclusive new report, so the operation is non-idempotent. Matched means the explicitly configured numerical tolerance only. Browser inputs and permissions are unchanged.
