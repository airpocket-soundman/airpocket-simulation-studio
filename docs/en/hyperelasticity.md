# Finite-strain rubber analysis

[日本語](../hyperelasticity.md)

Use the Rubber finite-strain example, or enable the compressible Neo-Hookean model in material details. Enter shear modulus μ and bulk modulus K in MPa. Optional test curves record [stretch, nominal stress Pa] pairs in JSON. Parameters are not fitted automatically; obtain them from appropriate measurements.

The implementation uses logarithmic volumetric energy:

$$W=\frac{\mu}{2}(\mathrm{tr}(F^T F)-3)-\mu\ln J+\frac{\lambda}{2}(\ln J)^2,\quad J=\det F,\quad\lambda=K-2\mu/3.$$

Formula reference: [official FEniCS hyperelasticity example](https://docs.fenicsproject.org/dolfinx/main/cpp/demos/demo_hyperelasticity.html). This is an Airpocket implementation, not a port of the FEniCS solver.

Reference-configuration Tet4 elements assemble first-Piola internal forces and the consistent tangent. Loads and prescribed displacement increase over 1–30 increments. Newton iterations use residual-reducing backtracking, with 1–50 iterations per increment and 1e-8 relative equilibrium tolerance. Insufficient constraints, inverted/collapsed elements, nonpositive tangent systems and nonconvergence are rejected. Local-frame constraints, reference-configuration gravity and dead forces are supported.

Reported stresses are current-configuration Cauchy stresses. Strains are Green-Lagrange, with shear entries 2Eij. Displacements are saved in mm and stress in Pa, displayed as MPa. Cases preserve each increment’s residual, minimum J and potential energy, and support saved display and input restoration.

The reference example is a 10×10×40 mm bar with μ=0.5 MPa and K=2 MPa. Lateral displacement is fixed and the top moves 8 mm: F=diag(1,1,1.2), minimum J=1.2. End force is first-Piola stress times reference area; displayed stress is Cauchy stress. These constraints differ from a laterally free uniaxial rubber test.

Current limits: Airpocket JS/WASM CPU, 2000 tetrahedra and 2000 nodes, K/μ=2/3–20. Common nearly incompressible rubber requires mixed or other suitable elements and is rejected here. MFEM/WebGPU, adaptive remeshing, thermal strain, follower pressure, mechanical contact, buckling branch tracking, viscoelasticity and failure are unsupported. Material parameters are never silently changed to fit these limits.

API material data: `hyperelastic: {model:"neo-hookean-log", shearModulus:500000, bulkModulus:2000000, testCurve:[[0.8,-200000],[1,0],[1.2,200000]]}`. Study settings: `nonlinearLoadSteps` and `maxNewtonIterations`. Worker checks reject incompatible pressure, thermal-stress and execution modes.

Verification includes energy/stress and stress/tangent finite differences, rigid objectivity, 20% stretch/compression forces and stresses, a force-driven bar compared with an independently solved stretch, curve roundtrips, the actual WASM worker pipeline and archive validation.
