# Compare holdout predictions from saved files

[日本語](../printed-holdout-cli.md)

`node scripts/compare-printed-holdout.mjs --request <absolute.json> --output <new-absolute.json>`

This read-only saved-file entry fits training specimens only and predicts explicitly mapped validation specimens under the existing [holdout contract](printed-parameter-holdout.md). It never applies results to materials or analysis inputs. Compared means errors were computed, not that accuracy passed. `calibrated`, `accuracyVerified`, and `physicalIndependenceVerified` always remain false.

The request has exactly five fields: `schemaVersion:1`, `training:{path,expectedSHA256}`, `validation:{path,expectedSHA256}`, `options`, and `specimenPairs:[{trainingSpecimenId,validationSpecimenId}]`. Paths are absolute; each expectedSHA256 is the lowercase64-character SHA-256 of the original JSON bytes. Options explicitly provide all identification conditions. Complete one-to-one mappings, disjoint dataset/specimen identities, matching recorded conditions, and no extrapolation remain required. File names never prove calibration or physical independence.

Limits are64KiB per request,2,000,000bytes per dataset,100pairs and10,000combined samples, and4MiB per artifact. Duplicate decoded keys, invalid UTF-8, BOM, excessive depth and size are refused. Both original files are read through bounded FD snapshots and both hashes are checked before comparison. Symlinks/junctions, reused inodes and input/request/output aliases are refused.

Artifacts retain source byte hashes and sizes, the existing pure result, or a refusal without invented model numbers. Residuals in Pa are prediction minus observation. Publication is exclusive: existing outputs are preserved and concurrent processes have one complete-artifact winner. Exit codes are0 compared,2 refusal artifact,1 argument/path/IO error. Stdout is a compact JSON summary without curves or internal exception stacks.

Measured calibration, verified physical independence, material accuracy guarantees, GUI/MCP entry points, and general cyclic histories remain outside this completed entry point.
