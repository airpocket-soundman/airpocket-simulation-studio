# Saved measurement JSON batch identification

Identify at most eight independent datasets sequentially and publish one new JSON artifact. Datasets are never averaged together. This entry point applies no material, runs no solver and performs no calibration; `calibrated:false` and `accuracyVerified:false` remain fixed. Within-dataset specimen aggregation follows the existing pure API.

`node scripts/identify-printed-batch.mjs --manifest <absolute JSON path> --output <new absolute JSON path>`

The exact manifest shape is `{"schemaVersion":1,"entries":[{"id":"A","dataset":{"path":"D:/data/a.json","expectedSHA256":"64 lowercase SHA256 characters"},"options":{"path":"D:/data/options.json","expectedSHA256":"64 lowercase SHA256 characters"}}]}`. Unknown fields, duplicate decoded keys/IDs, duplicate dataset/options hash pairs and relative paths are refused. Hashes identify raw UTF-8 versions; they do not authenticate measurements or establish calibration.

Limits are 131072 manifest bytes, 2000000 bytes per dataset, 16384 bytes per options file, 8388608 total referenced input bytes and 4194304 output bytes. Reused files count for every reference. Reuse requires the same role, physical path and expected hash; a dataset can therefore be evaluated under different options versions. Alternate hardlink names, cross-role aliases and manifest aliases are refused. All path components must be free of symlinks/junctions and inputs must be regular files. Fixed-capacity FD reads and before/after identity checks reject growth or replacement; this is not an OS sandbox against adversarial parent-directory replacement.

All capacity and raw-version checks finish before the first fit. A later SHA mismatch leaves every entry not run. Individual model/options refusals preserve entry order and other valid results. Unidentified specimens receive no invented parameters. Artifacts contain IDs, hashes, finite results and stable refusal codes, without raw input, file paths or stacks.

The existing exclusive publisher never replaces a file, directory or link. Concurrent writers have exactly one winner. Exit codes are 0 for all identified, 2 for a published refusal artifact, and 1 for CLI/path/publication errors. Invalid manifest/content/version refusals publish only after a safe destination has been prepared; unsafe paths and existing destinations produce no artifact. Compact JSON stdout reports output length and SHA.

Real CLI tests cover eight entries, the exact aggregate byte boundary, independent linear expectations, partial refusals, version checks before fitting, links/file changes, concurrent publication and declarations. Success/refusal bytes from the existing single CLI remain identical to committed golden artifacts after the shared read-only IO extraction. No new measurements, GUI behavior, calibration or general accuracy are established.

[日本語](../printed-identification-batch-cli.md) / [Single-file CLI](printed-identification-file-cli.md)
