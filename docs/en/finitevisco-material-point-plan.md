# FINITEVISCO1 material-point reference implementation plan

[日本語](../finitevisco-material-point-plan.md)

**Design only; unimplemented.** The proposed output is `synthetic:true`, `provisional:true`, `calibrated:false`. No product solver/UI/API/MCP/project integration is proposed while P1/P3/MOD1/RESULTCURVE1 prerequisites remain incomplete. Root review precedes a separate implementation candidate. No source, external CAE or SDK was changed/downloaded.

## Existing implementation and primary references

`plasticity-core.js:j2Return` uses small strains/engineering shear, committed J2 plastic state and hardening/dissipation, without physical dt. Its structural path caps principal strain at0.02 and refuses incompatible rate/thermal/hyperelastic input. `hyperelastic-core.js:neoHookean` computes finite F/J/P/Cauchy stress but has no viscous state. Its load-step count is not physical time. Adding those two implementations does not create finite viscoelastic-plastic behavior.

[Liu, Zhao and Guan, arXiv2501.11947v1](https://arxiv.org/html/2501.11947v1), sections2/4, develops generalized-strain quadratic configurational energies and internal-state evolution, and discusses non-coercive strain measures. [Official FrontISTR theory](https://source-docs.frontistr.com/en/theory/constitutive/04_viscoelastic.html) supplies the Maxwell relaxation ODE/Prony spectrum; [official COMSOL theory](https://doc.comsol.com/6.4/doc/com.comsol.help.sme/sme_ug_theory.06.011.html) distinguishes finite multiplicative kinematics. [Official FEBio documentation](https://febiosoftware.github.io/febio-docs/features/features/solid_material_viscoelastic/) describes a different stress-convolution model. None establishes that our restricted design reproduces their complete implementations.

The equations below are an explicit **project-specific restricted reference design**, informed by those sources. They are not a verbatim reproduction, PRF/Simo/FEBio compatibility or a calibrated constitutive law. In particular, dev(E) differs from a Green strain formed using the isochoric C tensor; this is not an exact isochoric/volumetric split.

## Model and objective quantities

Use full3×3 tensors, C=FᵀF, J=detF, E=(C−I)/2, H=devE, and symmetric trace-free reference internal memory Z. No engineering-shear Voigt convention is used. Parameters K,μ∞,μ1 are positive Pa; τ is positive s. Define η=μ1τ in Pa·s with the coefficient convention below.

```text
ψ = K/2(trE)^2 + μ∞ H:H + μ1(H−Z):(H−Z)    J/m³ initial volume
Zdot = (H−Z)/τ                              1/s
S = K tr(E)I + 2μ∞H + 2μ1(H−Z)              Pa, second Piola
P = F S                                    Pa, first Piola
σ = F S Fᵀ/J                               Pa, Cauchy
D = 2μ1/τ (H−Z):(H−Z) >= 0                  W/m³ initial volume
P:Fdot = S:Edot = ψdot + D
```

F/E/H/Z are dimensionless. Z is viscous memory, not plastic strain or a geometrically defined finite elastic strain. With μ∞>0 the stress-free model eventually recovers; it cannot predict permanent plastic residual strain. Returning prescribed F to I may temporarily leave stress, which is not permanent plasticity.

For any proper, time-dependent spatial rotation Q, F*=QF leaves C/E/Z/ψ/D unchanged and gives P*=QP, σ*=QσQᵀ. Pure spin adds no work/dissipation. A reference-basis change R requires F*=FRᵀ and Z*=RZRᵀ together. These identities need explicit tests rather than an objectivity claim based on naming.

## Restricted admission and stability

Initial synthetic fixture: K=2e6Pa, μ∞=1e6Pa, μ1=0.5e6Pa, τ=2s. Proposed numerical envelope: principal stretches0.95–1.05 inclusive; J0.85–1.16; 2/3≤K/μ∞≤3; 0<μ1/μ∞≤1. These are uncalibrated reference scope limits, **not a physical validity or stability guarantee**. Reject nonfinite F/parameters/state/time/results, nonpositive J, reflection/collapse, nonsymmetric C or invalid eigenvalues, stretch/J/ratio limits, nonpositive dt, non-increasing time, state/model/parameter revision mismatch, unsupported units and arbitrary oversized internal memory. Use symmetric spectral calculations, not the diagonal entries of F. Test both sides of every endpoint and repeated eigenvalues.

Use a single branch and initial stress-free F=I,Z=0. Committed state carries schema/model/parameter revision, time, preceding F/E, Z and accumulated dissipation. Resume only a verified chain; no implicit state transfer from J2 or Neo-Hookean. Copy-on-write guarantees unchanged input and previous commit on failure. Proposed budget:4096 steps and1MiB total input/output, plus bounded graph/depth/retention. Exact budgets and refusal codes require meaningful implementation regressions. Overflow/underflow and negative computed dissipation must not be concealed by clamping. Use expm1/series near zero and explicit large-exponent limits.

The quadratic Green-strain equilibrium energy is StVK-like. Frame indifference and D≥0 do not establish rank-one convexity/strong ellipticity. There is no energy barrier as J approaches zero. A one-dimensional counterexample ψ=E_mod(λ²−1)²/8 yields dP/dλ=E_mod(3λ²−1)/2, negative below1/√3. That is not a universal3D compression limit. For the3D hydrostatic state F=λI,Z=0, one transverse rank-one coefficient is μ_inst λ²+(3K/2)(λ²−1), μ_inst=μ∞+μ1; the relaxed analogue uses μ∞. The proposed fixture's equilibrium version loses that mode below√(3/4). This is only one state/mode, not general-history stability. Reject outside the narrow envelope and make no structural stability claim inside it. A wider future model needs a defensible coercive energy, selected finite viscous theory, acoustic-tensor and spatial/time sensitivity verification.

## Exact update, independent verification and time sensitivity

The path contract explicitly means **piecewise linear Green–Lagrange E**, not piecewise linear F. Check C(t)=I+2E(t) positive definite and the complete interval envelope, including J. Proper rotation is separate and introduces no viscous spin. For dt, v=(H1−H0)/dt, r0=H0−Z0, a=τv, b=r0−a:

```text
r(t)=a+b exp(−t/τ),  Z1=H1−r(dt)
x=dt/τ
ΔD=(2μ1/τ)[(a:a)dt+2(a:b)τ(1−exp(−x))
                        +(b:b)τ/2(1−exp(−2x))]
```

A stable small-x evaluation still requires design; a direct cancellation-prone transcription followed by zero-clamping is unacceptable. Independent quadrature/high-precision oracles must check it. Integrate S:Edot separately; defining work as Δψ+ΔD and testing that same identity would be circular.

Planned acceptance, with analytical expectations rather than measured implementation results:

1. Hold E12=E21=0.005, other components0, Z0=0. Principal stretches0.9949874371,1,1.0049875621; J0.99994999875. S12 starts15000Pa, is11839.39720585721Pa at2s and approaches10000Pa. Initial branch energy25J/m³;2s dissipates21.616617919084682J/m³. The ideal initial jump is an evaluate-only oracle, not an accepted zero-dt history step.
2. Ramp to that E in1s: S12=13934.693402873665Pa. Independently integrate the exponential history through loading/hold/unload/reload and different rates. No yield or permanent plasticity is introduced.
3. Coaxial reduced stress-free recovery oracle: e=μ1 z/(μ∞+μ1), z=z0 exp[−t μ∞/(τ(μ∞+μ1))]. Recovery time differs from τ. This is not a3D traction-free specimen/area solution.
4. Hold work is0 and Δψ=−ΔD; accumulated D is nondecreasing. Check zero/reversal/cycles/noncoaxial paths,90°/180° and time-dependent rotations, reference-basis transforms, S:Edot versus P:Fdot and stress push-forward. Avoid zero-denominator relative errors.
5. Divide the same linear-E path into1/2/4/8 parts: endpoint state/energy/dissipation should agree to roundoff. For a smooth nonlinear F(t), refine dt/2/4 and measure convergence of the declared E-linear approximation. Proposed starting tolerances: stress1e-6Pa+1e-10·scale, energy1e-10J/m³+1e-10·scale, state1e-12+1e-10·scale; justify them across scales/long histories before adoption.
6. Check every refusal, state/hash chain tampering, pause/resume versus uninterrupted execution, and unchanged input/committed state after failure. Do not return a complete history after a rejected intermediate trial.

No plasticity/damage/necking/failure, FDM anisotropy, temperature/WLF, finite plastic multiplicative decomposition, mesh/element/Newton integration, structural reactions/current area, physical calibration/accuracy, product result schema or LLM history integration is included. Passing these future material-point tests would not complete FINITEVISCO1 or its prerequisites.
