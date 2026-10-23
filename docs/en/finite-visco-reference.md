# Restricted finite-viscoelastic material-point reference

[日本語](../finite-visco-reference.md) / [Design and primary sources](finitevisco-material-point-plan.md)

`src/finite-visco-reference.js` is a pure one-branch Green–Lagrange material-point boundary with fixed `synthetic:true/provisional:true/calibrated:false`. It is not connected to the product solver, J2, Neo-Hookean, UI/API/MCP or project schema. It does not complete FINITEVISCO1 or reproduce an entire paper/PRF model.

Public functions are `initFiniteViscoReference({synthetic:true,provisional:true,calibrated:false,parameters})`, `evaluateFiniteViscoReference({state,F})` and `stepFiniteViscoReference({state,F,dtSeconds})`. Parameters are `bulkModulusPa`, `equilibriumShearModulusPa`, `branchShearModulusPa`, `relaxationTimeSeconds`. Evaluate is a noncommitting trial; step returns a new frozen state, observation and work/dissipation increment. The initial state is I/Z=0. Exact data fields and dense3×3 F arrays are required.

Deep freezing and private WeakMap issuance enforce provenance. Copied/changed model, units, parameters, JSON clones and states from another module instance are refused. **Continuation is in-process only; persistent JSON restore/replay is not implemented.** Branching from a previously issued state is allowed. No ancestors or full history are retained. The planned full-history API was deferred; this delivery bounds each state to1MiB and each branch to4096 steps.

F/C/E/Z use full tensors without engineering-shear conventions. Energy/work/dissipation densities use J/m³-reference; instantaneous dissipation rate uses W/m³-reference. S/P/σ are second Piola/first Piola/Cauchy in Pa. No specimen force,current area or traction-free structural deformation is computed. With E=(FᵀF−I)/2 and H=devE, the design energy is K(trE)²/2+μ∞H:H+μ1(H−Z):(H−Z), Zdot=(H−Z)/τ. S=∂ψ/∂E, P=FS and σ=FSFᵀ/J.

Step explicitly means an E-linear interval, not linear-F interpolation. Endpoint C spectral bounds imply the same interval bounds by convexity and J within[.95³,1.05³]. Time-dependent spatial rotations preserve memory/energy/dissipation and correctly rotate stresses. Full reference-basis covariance is independently tested.

Admission: x=dt/τ within1e-6–1e6; positive dt and increasing finite time≤1e9s; moduli1–1e12Pa; τ1e-6–1e6s; 2/3≤K/μ∞≤3 and0<μ1/μ∞≤1. Principal stretches are.95–1.05 with1e-14 rounding allowance on C eigenvalues; J is.85–1.16. Inverted/singular/nonfinite F and out-of-envelope parameters are refused. These are numerical scope limits, not calibrated validity or StVK stability guarantees. Compression ellipticity loss and absence of a J-collapse energy barrier remain limitations described in the design.

The exact update uses expm1 and small-x series. Dissipation uses a completed-square positive Gram integral without negative-value clamping. Work follows a separate stress-path primitive; its balance with Δψ+ΔD is checked at1e-10+1e-10·scale. Rejection preserves caller input and committed state.

Independent tests include2000-panel Simpson stress-power/dissipation integration, exponential hold, a separate large-x ramp primitive, all nine P components against Richardson energy gradients, large time-dependent rotations, noncoaxial material-basis changes, identical E-linear subdivision, smooth nonlinear-path time convergence, reduced stress-free recovery, capacity/provenance/invalid inputs and real runtime-import type fixtures. The quartic energy uses Richardson differences at h=1e-4/5e-5, checking P at1e-6Pa+1e-10 relative.

[Measured evidence](../evidence/2026-10-23-finite-visco-reference.json) records numerical results and scope. Pure viscoelastic recovery is not permanent plasticity. Yield/damage/necking/fracture,FDM/material prediction,experimental calibration,element/structural integration and product publication remain absent.
