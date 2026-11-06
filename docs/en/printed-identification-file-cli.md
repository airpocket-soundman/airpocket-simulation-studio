# Identify printed parameters from saved files

[日本語](../printed-identification-file-cli.md)

A file entry point for existing identifyPrintedParameters(raw,explicitOptions), preserving the[dataset contract](printed-measurement-dataset.md) and[model limits](printed-identification-audit-20261104.md). It applies no material, runs no solver and mutates no project.

```powershell
node scripts/identify-printed-parameters.mjs --dataset "D:\data\measurement.json" --options "D:\data\options.json" --output "D:\data\new-identification.json"
```

Replace the example paths with existing host-native absolute input paths and an existing output parent. Options example(no implicit thresholds):

```json
{"model":"linear-elastic","maxStrain":0.02,"minPoints":3,"maxRelativeStandardError":0.1}
```

Bilinear adds maxTangentRatio; SLS adds holdStrainTolerance, exactly as the pure gate requires. Unknown fields/models refuse. Each of the three flags occurs once. Relative/duplicate/unknown arguments, same paths(case-insensitive onWindows), input hardlink aliases and existing output file/directory/link refuse. A hardlink-capable filesystem and existing output parent are required. Symlink/junction components and non-regular input files refuse; physical parents are resolved and NOFOLLOW/NONBLOCK used where available. This is not an atomic hostile-filesystem snapshot or filesystem-timeout guarantee.

Dataset cap2000000bytes,options cap16384bytes: size is checked before allocation, then bounded FD reads allocate/read at most limit+1. FD/path identity,size,mtime/ctime changes refuse. StrictUTF8 withoutBOM; dataset text reaches the existing importer unchanged. Flat optionsJSON rejects decoded duplicate keys,nonfinite numbers/nested values, then reaches the existing pure options gate. RawSHA identifies the captured bytes, not authenticity/calibration.

Artifact schemaVersion1/kind:printed-parameter-identification-file has status identified/refused, input bytes/SHA256, the unchanged pure result and stable refusal code/stage. calibrated:false,accuracyVerified:false and synthetic/measured provenance remain. Refused specimens receive no invented parameters; valid partial specimen values/reasons remain the pure result, never a material-acceptance decision.

After safe output and regular-input-path guards, byte/UTF8/JSON/options/dataset validation refusals also publish a new refused artifact without raw input,stack or private text. Fully read invalidUTF8 keeps its rawSHA; oversized/changed unstable inputs have nullidentity. Argument/path/missing-or-nonregular-input/symlink guards and publicationI/O failures create no artifact.

The existing publishJson writes an owned temporary JSON completely, then publishes through an exclusive same-directory hardlink. Existing paths are never replaced/deleted; normal failures remove owned temporary files and expose no partial final file. Crash leftovers/cleanupWarning are separate from a complete artifact. Output cap524288bytes. Compact stdout returns outputBytes/outputSha256. Exit0=all identified,2=refused artifact,1=argument/path/I/O/publicationerror(code-only, no artifact). Two competing writers publish at most one final artifact.

[Evidence](../evidence/2026-11-04-printed-identification-file-cli.json) covers synthetic actualCLI/pure equality, independent tensile/aggregate oracle, all3models,capacity/refusal/alias/junction/race and types. Measured calibration, independent-specimen accuracy and actualGUI equality remain separate acceptance work.
