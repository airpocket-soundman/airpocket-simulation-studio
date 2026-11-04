# Independent local scalar damage audit and fixes (2026-11-04)

[日本語](../finite-visco-damage-audit.md)

The synthetic work-order100 material point at base `d8214ad` was audited. Forged states, input getter execution and cancellation in the exponential law were corrected. The95 PRF-J2,88 Hencky Prony and72 uniaxial Prony implementations, existing assertions and historical October29 evidence remain unchanged.

Previously, spreading an issued state, changing dissipation to−100 and freezing the record was accepted, producing negative dissipation after stepping. A module-private WeakSet now admits only states actually issued by this module. States are immutable and process-local; JSON/structured clones and reconstructed records cannot resume. The WeakSet does not strongly retain old states or a trajectory. The declaration uses an opaque state brand as well.

Parameters are checked and copied before object spreading or delegation. Own enumerable data properties and dense ordinary arrays are required. Limits of8 branches,64 segments,4096 total steps and a3×3 F are checked first; getters, custom map/iterator hooks and sparse arrays are refused without execution. Existing lower-model parameter, stretch, J, dt/τ and time bounds still apply.

For `x=max(0,(r−Y0)/Yf)`, damage uses `−expm1(−x)` while stress, stored energy and viscous/plastic increments use `exp(−x)` directly. This retains damage around1.25e−18 previously erased by `1−exp(−x)` and avoids reconstructing a tiny survival factor from rounded damage. At x=35, that reconstruction caused about5.65% relative stress error. Damage that rounds to1 is explicitly refused under the existing `d<1` contract; it is not interpreted as deletion or rupture.

Independent tests do not use another production constitutive model as their oracle. For `F=aI`, direct Hencky formulas are `Y=9e6(log a)²`, `τ_eff=6e6 log a` and `J=a³`; maximum-history damage and trapezoidal damage dissipation are checked separately. A synthetic relaxed traction-free uniaxial case uses the closed forms `ν=2/7` and `E=18e6/7 Pa` for stress and energy. All46 related tests, including4 existing and5 new damage tests, pass; all35 contract declarations type-check.

The [machine-readable record](../evidence/2026-11-04-finite-visco-damage-audit.json) retains counterexamples, fixed source hashes, commands and scope. Damage dissipation remains the specified discrete `Y_mid Δd` trapezoidal bookkeeping, not exact work integration for arbitrary finite steps. Threshold and softening values are synthetic and uncalibrated. No structural solver, regularization, characteristic length, fracture energy, tension/compression split, deletion, GUI/API/MCP integration, measurement or publication validation was added. The FINITEVISCO1 parent remains incomplete.
