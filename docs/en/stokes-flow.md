# Low-Reynolds-number Stokes flow around external CAD solids

[日本語](../stokes-flow.md)

v0.37 implements CPU velocity–pressure coupling, shared APIs, the worker, probes and saved-result consistency checks. All 209 source tests, 21 public runtime checks and 22 public browser checks passed. This guide records a limited prototype and individual measured results; it does not certify arbitrary-geometry accuracy.

The implementation solves steady incompressible 3D viscous flow of a Newtonian fluid around a fixed CAD solid inside a finite outer box. All outer faces receive the same velocity vector; the solid surface has zero-velocity no-slip conditions. One pressure node fixes the additive pressure constant. This velocity–pressure problem is distinct from the existing fully developed channel model.

## Material data and scope

Use dynamic viscosity μ in Pa·s, density ρ in kg/m³, outer velocity U in m/s and characteristic length L in m. Convert mm geometry dimensions to m for the Reynolds number. Supply measured values or reliable property sources for the relevant fluid temperature and composition. A fluid name alone does not establish properties or certified drag.

The prototype limit is `Re=ρ|U|L/μ ≤ 0.1`. L is a representative body diameter: 2a for a sphere. Record its definition and value; mesh size is not the characteristic body length. This selects a viscosity-dominated regime rather than bounding errors for arbitrary shapes. Inertia, turbulence, unsteady flow, compressibility, non-Newtonian rheology and two-way fluid–structure coupling are outside scope. Current execution limits are CPU GMRES, 2000 nodes and 8000 tetrahedra; these do not imply MFEM/WebGPU or adaptive-remeshing support.

## Numerical verification

With physical pressure, the Stokes equations are `−div(2μ ε(u))+grad(p)=0` and `div(u)=0`, with `ε(u)=(grad(u)+grad(u)ᵀ)/2`. The mixed weak form contains viscous terms, pressure–velocity-divergence coupling and incompressibility. Some reference implementations reverse the pressure sign; verify consistency of the equations, displayed pressure and surface-stress signs.

Equal-order linear Tet4 velocity and pressure require pressure stabilization. PSPG tests the momentum residual against pressure-test-function gradients. Its coefficient, length scale and sign need verification. Convergence of stabilized algebraic equations alone does not establish accurate element divergence or physical flux conservation.

Force on the solid uses total stress `σ=−pI+2μ ε(u)`, including pressure and viscosity. The fluid-domain normal on its inner boundary opposes the solid's outward normal. Do not assume surface-integrated force and discrete reaction give identical numerical values; record the force method, sign and mesh convergence.

The implementation distinguishes surface-integrated `dragN` from `reactionDragN`, obtained by negating the discrete velocity-equation residual at the fixed wall. Low-order surface gradients can reduce traction accuracy; reference comparisons should also examine the variationally consistent reaction.

## Finite enclosure and acceptance

Uniform outer velocity in the UI is a finite-box boundary condition. Box size and clearance affect flow and drag, so this is not the exact unbounded-sphere problem with drag `6πμa|U|`. Separate mesh refinement from enclosure-size comparisons.

Only a test imposing the analytical unbounded velocity field on the finite outer boundary can directly compare against the unbounded drag of a sphere of radius a. That benchmark does not certify the UI's uniform-velocity boundary. Acceptance checks should include independent references, linear μ/U scaling, flow reversal, pressure-gauge changes, boundary velocities, divergence and boundary flux balance, enclosure/mesh dependence, and rejection of nonconvergence or exceeded limits. Worker, archive and UI checks are additional integration requirements.

Primary references: [DOLFINx's Stokes mixed weak form and pressure-sign note](https://docs.fenicsproject.org/dolfinx/main/python/demos/demo_stokes.html), [INL OpenPronghorn's equal-order elements and PSPG](https://openpronghorn.inl.gov/modules/navier_stokes/cgfe.html), [COMSOL's creeping-flow assumptions](https://doc.comsol.com/6.4/doc/com.comsol.help.corr/corr_ug_fluidflow.09.003.html), and the [original study of finite-boundary effects on Stokes resistance](https://www.cambridge.org/core/journals/journal-of-fluid-mechanics/article/abs/effect-of-finite-boundaries-on-the-stokes-resistance-of-an-arbitrary-particle-part-3-translation-and-rotation/F8D5C0143118CD053A673C9C2DA8BDFA). This prototype is not a port of those product solvers.

Development measurement: for a 5 mm sphere with μ=1 Pa·s, ρ=1000 kg/m³ and U=0.001 m/s under analytical outer conditions, local refinement gave approximately 6.25% reaction-drag error (about 16% on the coarse mesh), 28.3% surface-integrated drag error and 27.7% relative nodal pressure error. These individual measurements document prototype accuracy limits; they are not finalized acceptance results or accuracy guarantees for the uniform-box UI.

Shared study settings are `kind:'creepingFlow'`, `dynamicViscosity`, `fluidDensity` and `freeStreamVelocity:[ux,uy,uz]`. Optional `referenceLengthMm` defaults to the original CAD solid's largest bounding-box dimension; an explicit value below that dimension is rejected. An external `fluidDomain` with a rectangular `enclosure` is required, without manual boundary conditions. `stokesBoundary(mesh,source,study)` constructs outer velocities, body no-slip, the pressure gauge and the effective length. STEP flow requires recorded original CAD bounds.

v0.40 lets users select stabilized P1/P1 or Taylor–Hood P2/P1 through Velocity element. Set `study.stokesVelocityElement:'P2'`; omission retains P1. P2 uses quadratic velocity with separate edge-midpoint fields and linear pressure, without pressure stabilization. Geometry remains straight tetrahedra and flat boundary triangles, not quadratic CAD geometry.

Probes evaluate ten-node quadratic velocity and four-corner linear pressure. Each section triangle is subdivided into four render triangles with quadratic midpoint samples. Maximum nodal speed includes corners and edge midpoints. The velocity color range uses a quadratic Bernstein coefficient bound that also bounds extrema between nodes; this bound is used for Reynolds rejection. Cell stresses/divergence are centroid samples; RMS divergence uses four-point quadrature.

P2 retains limits of 2000 base vertices and 8000 tetrahedra, plus 12000 velocity nodes and 40000 degrees of freedom. JS/WASM CPU GMRES is supported; GPU, MFEM, inertia and turbulence remain unsupported. Archive validation independently reconstructs midpoint topology, boundary values, gauges, extrema/bounds, stresses, divergence, forces and fluxes, and checks interior momentum/weak incompressibility. Legacy P1 archives remain supported.

The refined analytical-boundary sphere test has reaction drag error 1.77%, surface drag error 8.20% and nodal pressure error 9.81%. This differs from the uniform finite-box UI boundary and is not an accuracy guarantee for that UI. Continue comparing mesh and enclosure sizes.
