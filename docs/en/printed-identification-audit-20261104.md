# PRINTMEASURE3 identification audit (2026-11-04)

[日本語](../printed-identification-audit-20261104.md)

These changes audit work order 101 using synthetic curves only. They do not verify measurements, calibration, accuracy, or automatic material application.

- Apply caller maxStrain to SLS held strain; require at least four hold points for three unknown parameters.
- Check monotonicity over the complete bilinear input, including samples outside the fitting window. Reject nonpositive tangent modulus; perfect plasticity is outside this profile.
- Bound quadratic breakpoint search to 512 selected points. Larger curves return identified:false before search, without decimation or skipped candidate breakpoints. The dataset 10000-point import bound is unchanged.
- Require finite successful diagnostics and caller-relative-standard-error acceptance for every parameter. Undefined constant-stress R-squared cannot silently serialize as null in a successful result.
- Require enumerable own data option fields with ordinary/null prototype; reject accessors, symbols and inherited model names.

Standard errors remain conditional model approximations, not calibration accuracy or evidence that the model is correct. Bilinear coefficient covariance remains conditional on the fitted breakpoint; only yield uncertainty additionally uses breakpoint profile curvature. Finite strain, multiple branches, unloading/cyclic and perfectly plastic identification remain unsupported. Identification data are not independent validation: existing importPrintedEquivalentDatasets specimen separation is unchanged.

Evidence: [audit result](../evidence/2026-11-04-printmeasure3-audit.json). No progress changes.
