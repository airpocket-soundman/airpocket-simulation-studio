# Read-only SLS/Prony roundtrip file CLI

[日本語](../printed-sls-prony-cli.md) · [Physical transform and limits](printed-sls-prony-roundtrip.md)

`node scripts/roundtrip-printed-sls.mjs --config "D:/examples/config.json" --config-sha256 "<64 lowercase raw SHA256 characters>" --output "D:/examples/new-report.json"`

This adds a raw-pinned file entry to the existing synthetic SLS/Prony API. It does not modify materials/solver inputs, measure/calibrate anything or register GUI/MCP access. Stdout contains one small JSON summary, not curves. completed means computation finished, not accuracy passed. Exit codes:0 completed,2 persisted refused report,1 argument/IO error. Input text/stacks are not printed to stderr.

Config must be UTF-8 without BOM, at most65536B. A dedicated parser rejects duplicate decoded keys, depth above8 and more than1024 values. schemaVersion1 requires:

- training / validation: `{path:absolutePath, expectedSHA256:64 lowercase raw hash}`
- options: model=`sls-relaxation`, maxStrain, minPoints, maxRelativeStandardError, holdStrainTolerance
- specimenPairs: complete one-to-one trainingSpecimenId / validationSpecimenId mappings, at most8
- bulkModulusPa, rampDurationSeconds, workerMilliseconds (integer1–30000)

The config SHA is itself pinned by the CLI argument. Computation starts only after all three raw identities match. Datasets are capped at2MB each and must be regular files. Symlink/junction components, cross-role hardlinks/path aliases and existing outputs refuse. Existing bounded read/stat-before/after, strict UTF-8 and atomic-exclusive publication helpers are reused. No input repair or overwrite occurs, including concurrent writers. Atomic complete-byte visibility is not fsync/power-loss durability.

One owned Node worker must emit an actual exit before publication. Its deadline covers startup, computation, reply and exit wait. Timeout/Abort requests termination; cleanup waits for real exit before publishing refused with result:null. Cleanup can extend beyond the budget; this does not prove every native OS task has stopped. Main-side file IO is byte-bounded/cooperative, without a hard IO deadline. The first SIGINT/SIGTERM requests Abort; abrupt kill or repeated signals have no unconditional cleanup guarantee.

The final Abort check precedes the irreversible decision to call publishJson. Later Abort does not remove a completed file; abortObservedAfterPublication reports it. Unsettled/timeout/partial curves cannot become completed. Existing temporary-unlink cleanupWarning remains visible.

`writePrintedSlsPronyReport({config,configSha256,output},{signal})` returns the small summary for future backend reuse. No MCP registration or permission is added here. The transform still needs explicit K and a hypothetical finite ramp, with small-amplitude/time-refinement limits. Young/shear relaxation times differ. Results remain uncalibrated, accuracy-unverified and unapplied.

[Evidence](../evidence/2026-11-07-printed-sls-prony-cli.json) · [Original pack](../evidence/2026-11-07-printed-sls-prony-cli/verification.json)


Worker stdout/stderr are isolated with dedicated readable streams. Any nonempty output causes typed WORKER_STDIO refusal, not a parent stdout/stderr write. Content is discarded; observed-byte metadata saturates at4097 with a truncation flag. Publication waits for both actual worker exit and stream end/close. The plain-JS worker uses execArgv:[] rather than inheriting incompatible inline-host flags; an actual --input-type=module -e host is covered. Original pre-isolation capture bytes remain historical and unchanged.

## Formal MCP

`studio_roundtrip_printed_sls({config,configSha256,output})` uses the same saved-file service. `studio_capabilities.printedSlsPronySavedFiles` is available only for Node. Exclusive new-file publication is non-idempotent and does not add calibration, material application or browser permissions. The config supplies an explicit worker deadline; this synchronous stdio call advertises no separate cancellation notification.
