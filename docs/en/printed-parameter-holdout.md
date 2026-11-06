# Holdout specimen prediction errors (limited, read only)

[日本語](../printed-parameter-holdout.md)

`comparePrintedHoldoutPrediction({rawTraining, rawValidation, options, specimenPairs})` invokes existing `identifyPrintedParameters` once on training JSON only. Each training specimen's coefficients predict stress in its explicitly paired validation specimen; validation is never refitted and across-specimen averaged coefficients are never used. `specimenPairs` contains `{trainingSpecimenId, validationSpecimenId}` for every specimen in both datasets, exactly once. Dataset IDs and raw SHA-256 must each differ, and specimen-ID sets must be disjoint.

Independence is a recorded declaration. Renaming duplicated curves or physically independent manufacture/measurement cannot be verified. Results always state `independence:'declared-only'`, `physicalIndependenceVerified:false`, `calibrated:false` and `accuracyVerified:false`. `status:'compared'` means errors were computed, not that accuracy passed. No pass threshold, material application or UI/CLI/MCP integration is added.

Normalized build direction, temperature, speed, three dimensions, gauge length and batch must match **exactly**. No rounding tolerance or cross-batch policy is inferred. Instrument and calibration reports do not establish identity or accuracy. Both provenance labels are retained; reported measured inputs are not treated as verified measurements.

## Initial profile

- Linear and bilinear data must use all nonnegative in-window samples with strictly increasing strain. An initial zero strain is allowed only as an explicit zero-stress anchor. Holds, unloading, cycles and out-of-window points are not silently removed. The validation strain span must lie within the training observed span; no extrapolation is performed.
- SLS requires exactly one initial zero-strain/zero-stress anchor followed by a **declared ideal step** at the first held sample. Subsequent strain must be positive and exactly constant. Training requires at least `max(4,minPoints)` held samples; validation requires at least two. Actual step speed and apparatus response are not verified. Validation amplitude and elapsed hold duration must not exceed training observed bounds. Each dataset's first held sample defines its own zero elapsed time.
- Invalid raw data, mapping, conditions or histories refuse the whole call with `PRINTED_HOLDOUT_INVALID` and a reason. An unidentifiable training fit returns only a per-pair `training-not-identified` result and the original identification reason, without invented coefficients/errors. Nonfinite predictions/errors also refuse that pair.

Predictions use `E ε`, the continuous bilinear piecewise law, or held SLS `ε_hold(E∞+E1 exp(−elapsed/τ))`. Every validation sample uses `residualPa=predictedStressPa−observedStressPa`. Bias is its signed mean, MAE the mean absolute residual, RMS the root mean square and maxabs the maximum absolute residual. Count includes **all validation points including the zero anchor**; the SLS zero-response anchor is not silently excluded. Stress/error units are Pa, time s and engineering strain dimensionless. Errors from different pairs are not implicitly pooled.

## Bounds and verification

Each raw UTF-8 document is limited to2,000,000 bytes, with at most100 pairs,10,000 samples combined across both datasets and4,000,000 result bytes. Options and pairs are copied before the first await from own enumerable data properties and dense ordinary arrays. Getters, custom iterators, sparse arrays and extra fields are refused. Results are deeply frozen; raw inputs and project state are unchanged. Existing dataset normalization retains its unit and capacity contract.

Independent analytical tests cover a validation-only changed linear slope, a bilinear validation specimen too short to refit, and SLS at a different hold amplitude/start time. Predictions and Pa errors are checked by closed forms. Reversed specimen order, mismatched conditions, entire-history refusal, caller mutation during await, two training digests versus one validation digest (no validation refit),100 pairs and the exact10,000-point boundary are checked too. See the [fixed record](../evidence/2026-11-04-printed-parameter-holdout.json). Structural integration, measured accuracy, physical independence, calibration, general histories/finite strain, publication and the PRINTMEASURE3 parent remain unverified.
