# Identification statistics by measurement conditions

[日本語](../printed-identification-groups.md) · [Identification UI](printed-identification-ui.md)

The existing inspector adds condition-specific summaries alongside individual specimen fits. When direction, temperature, speed, batch, dimensions or gauge differ, the mixed overall average is hidden and users are directed to the groups. Materials and solver inputs remain untouched.

`identifyPrintedParametersByCondition(rawDatasetJson, explicitOptions)` reuses the existing identification API and raw dataset parser. Its `identification` retains the old result, including legacy overall across statistics. Only the new `grouping` partitions normalized buildDirection, temperatureC, speedMmPerSecond, batch, dimensionsMm and gaugeLengthMm. Numeric equality uses Object.is, including signed zero. There is no tolerance, rounding or direction equivalence. Different source units group together only when their normalized values are identical.

Only identified specimens contribute to each group's mean and sample standard deviation. One accepted specimen has null (unknown) standard deviation, never fabricated zero. Refused specimens retain their reason without substituted coefficients. A group without identified specimens has null statistics. Between-specimen scatter is not parameter covariance or measurement accuracy. calibrated, accuracyVerified and covarianceAccuracyVerified remain false.

Bounds are100 groups,100 specimens and three parameters per model, preserving2MB/10000 total samples and512 bilinear window points. Reports bind raw SHA/model/explicit options. Means sum divided contributions; standard deviation uses scaled hypot with finite checks. Worker/UI gates require each specimen exactly once, valid condition records, matching identity/model/options, statistics recomputed from accepted individual coefficients and correct null semantics. Cancellation, generations, the single pending SHA slot,10-second worker watchdog and existing download URL rules remain intact.

This adds no measurements, calibration or independent measured validation. It is a limited PRINTMEASURE3 increment for reading existing synthetic identification without mixing conditions, not completion of the parent task.

[Evidence](../evidence/2026-11-04-printed-identification-groups.json)
