# Printed material measurement dataset import contract

[日本語](../printed-measurement-dataset.md)

2026-10-23, work order 63 PRINT2. `src/printed-measurement-dataset.js` is a standalone importer. UI, MCP and solver integration, identification and accuracy verification remain unimplemented. No measured data was supplied; all regression inputs are explicitly synthetic.

`importPrintedMeasurementDataset(rawJson)` accepts schemaVersion 1 JSON bounded to 2,000,000 UTF-8 bytes, 100 specimens and 10,000 samples across all specimens. It preserves the exact source string, its SHA-256 and normalizationVersion=1. A parsed object or caller-supplied hash cannot replace the source. If original acquisition logs have another format, callers must retain those files separately: this hash covers only the JSON string. See `src/contracts/printed-measurement-dataset.d.ts` and the synthetic fixture in `tests/printed-measurement-dataset.test.mjs`.

Required metadata includes dataset ID/revision, synthetic/measured provenance, explicit units, instrument ID/hardware/software revisions, calibration evidence, and specimen ID/dimensions/gauge length/unit build direction/batch/temperature/speed/displacement kind and raw time-force-displacement samples. Dimensions mean initial cross-section width, thickness and specimen length. Duplicate specimen IDs, missing/unknown fields, excessive gauge length, nonfinite/out-of-bounds values and duplicate/nonincreasing times are rejected. Numerical bounds protect import resources; they do not certify an instrument's capability or physical validity.

Explicit mm/m, N/kN and mm/s or m/s are normalized; time must be s and temperature degC. Only gauge displacement is accepted. Crosshead stiffness/slip corrections are never inferred. Engineering stress uses the initial cross-section and engineering strain uses gauge length. The synthetic oracle is 1 N / 1 mm² = 1 MPa and 0.1 mm / 10 mm = 0.01.

Calibration status is unverified (all evidence explicitly null) or reported (force, displacement and dimensional evidence strings all required). Reported means a supplied report, never an independently verified claim; accuracyVerified is always false. Synthetic inputs cannot claim reported calibration. No coefficients, corrections, general physical accuracy or complete orthotropic identification are inferred.

`importPrintedEquivalentDatasets(properties, rawDatasets)` first invokes the existing printedEquivalent validator, then matches identification followed by independent validation data to exact reference IDs/revisions/specimen sets and material batch. Identification and validation specimens must be disjoint. It never mutates properties or changes the saved schema, legacy compatibility or rejection of equivalent/explicit stiffness double counting. Linking synthetic data grants no additional measured/identified guarantee.

Parent acceptance still requires instrument calibration, measured data, identification, independent predictive comparisons, uncertainty evaluation and UI/API integration. This delivery does not complete or release PRINT2.
