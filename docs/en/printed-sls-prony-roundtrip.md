# Bounded SLS-identification / uniaxial Prony consistency

[日本語](../printed-sls-prony-roundtrip.md) · [Training-only holdout](printed-parameter-holdout.md) · [Condition groups](printed-identification-groups.md)

`runPrintedSlsPronyRoundtrip` accepts synthetic data only and drives the existing finite-strain Prony uniaxial material point using training-only SLS fits. Validation never enters a fit. Existing holdout gates enforce complete one-to-one, disjoint specimens, recorded-condition equality and no extrapolation. There is no material application, real measurement, calibration or structural solve. This is a bounded next step of order101, not validation of order100 damage or the entire finite-visco feature.

## Why direct copying is wrong

Identification uses engineering strain and nominal stress F/A0 with `E(t)=E∞+E1 exp(−t/τE)`. The driver instead uses constant bulk modulus K and shear Prony branches, traction-free lateral faces, and piecewise-linear Green–Lagrange strain. K/Poisson ratio cannot be identified from this axial curve alone. K is an explicit mandatory synthetic input.

In the infinitesimal traction-free limit, the operational modulus is `E(s)=9K μ(s)/(3K+μ(s))`, with `μ(s)=[μ∞+μ0 sτμ]/[1+sτμ]`. The denominator pole gives `τE=τμ(3K+μ0)/(3K+μ∞)`. Hence `E0=E∞+E1`, `μ∞=3K E∞/(9K−E∞)`, `μ0=3K E0/(9K−E0)`, `μ1=μ0−μ∞`, and `τμ=τE(3K+μ∞)/(3K+μ0)`. The relaxation times are not copied unchanged. E0<9K and the unchanged driver's parameter/ratio/dt-to-tau/stretch/J envelopes must hold.

## Ideal step versus finite ramp

Raw JSON must declare a zero-strain/zero-stress anchor followed by a constant positive held strain with uniformly spaced held samples. The first held sample remains the ideal-step origin used by the existing holdout API. Since the driver cannot accept an instantaneous step, caller-specified rampDurationSeconds places a hypothetical finite ramp immediately before that first held time, never before the anchor. This is not a measured ramp.

Engineering strain maps to `E11=ε+ε²/2`. Comparison uses driver P11 (first Piola, nominal stress); S11 (second Piola) and Cauchy stress are retained separately. Finite strain, ramp duration and lateral piecewise-linear time discretization preclude exact reproduction of the engineering SLS law. Independent tests refine amplitude, ramp and source time spacing separately. Shortening only the ramp on a fixed grid leaves a temporal error floor.

Held-only signed Pa errors (Prony minus observed, Prony minus ideal step, ideal step minus observed) include bias/MAE/RMS/max. Existing holdout metrics including the zero anchor retain a distinct name. Original and driver times and signed offsets remain explicit; no interpolated or newly measured time is invented. Uniform-spacing checks permit only eight-epsilon-scale timestamp roundoff.

## Bounds, versions and cancellation

Limits:2MB per raw input,8 pairs,4096 total driver steps and4MB output. Unidentified training or out-of-envelope mappings return refused reasons, never invented coefficients. Reports bind raw SHA/id/revision/provenance, explicit fitting conditions, normalization/identification/holdout/mapping versions and the driver's own model version. Planned and executed steps differ explicitly. Outputs are synthetic/provisional; measured/calibrated/accuracyVerified/physicalIndependenceVerified/bulkModulusIdentified remain false.

Own-data inputs snapshot before awaiting. AbortSignal is checked after awaits and between bounded driver calls. Native SHA is allowed to settle before cancellation returns; a synchronous driver call is not interruptible by a hard deadline. No GUI/MCP/material/progress change.

[Evidence](../evidence/2026-11-07-printed-sls-prony-roundtrip.json)


Fitted conditional standard errors remain attached to the scalar identification parameters only. They are not propagated through the Prony transform; parameterUncertaintyPropagated is false. The reported Pa differences are numerical/model consistency residuals, not calibrated prediction intervals.
