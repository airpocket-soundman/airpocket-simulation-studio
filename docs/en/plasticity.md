# Small-strain J2 plasticity

[日本語](../plasticity.md)

Enable J2 plasticity in material properties and supply Young's modulus E, Poisson ratio ν, initial yield stress σY and linear isotropic hardening modulus H. The UI uses MPa for stresses/moduli; the API uses Pa. H must be strictly positive: perfect plasticity (H=0) is unsupported. Record material test conditions in `testConditions`. Reference values describe a synthetic material, not certified properties of a steel grade.

H differs from the post-yield tangent Et of the total uniaxial stress–strain curve: `Et = E H / (E + H)`, or `H = E Et / (E - Et)`. Select E, σY and H from tests at the relevant temperature and loading rate. Curves are not fitted automatically.

## Model and solution

The model uses 3D small strain, isotropic linear elasticity and associated von Mises flow. Its yield function is `f = sqrt(3/2 s:s) - (σY + H κ)`, where s is deviatoric stress and κ is accumulated equivalent plastic strain. Hydrostatic stress alone does not cause yielding. A trial stress outside the yield surface is corrected by radial return with `Δκ = max(f_trial, 0) / (3G + H)`.

Loads and prescribed displacements are applied incrementally. Newton iterations restore equilibrium using a consistent tangent. Plastic state is committed only after an increment converges; iteration trial states must not accumulate as history. Nonconvergence is not a successful result. The material-point model supports elastic unloading and residual plastic strain; this does not establish support for user-defined cyclic FE loading through the analysis UI.

## Reference bar and output

Use a 10×10×40 mm bar with E=200 GPa, ν=0.3, σY=250 MPa and H=1 GPa. Prescribe top z displacement 0.12 mm, ux=0 on x=0, uy=0 on y=0 and uz=0 on z=0. These symmetry restraints permit lateral contraction. At total axial strain εz=0.003, the independent uniaxial solution is:

- `κ = (E × 0.003 - σY) / (E + H) ≈ 0.00174129353`
- `σz = σY + H κ ≈ 251.74129353 MPa`
- Top axial reaction magnitude: `σz × 100 mm² ≈ 25174.129353 N`; the bottom reaction has the opposite sign.

Displacement is in mm, stress in Pa and strain is dimensionless. Six-component strain uses normal strains and engineering shear strains (γij=2εij). Equivalent plastic strain is stored per Tet4. Color plots use nodal averages and smooth the boundary of yielded regions. Point probes use the containing element value, which may differ from interpolated plot colors.

## API and limits

Load the plastic tension reference with `window.analysisApi.loadPlasticExample()`. After preparing geometry and boundary conditions, set material properties as follows:

```js
window.studioApi.setMaterialProperties({
  youngModulus: 200e9,
  poissonRatio: 0.3,
  plasticity: {
    model: 'j2-isotropic',
    yieldStress: 250e6,
    hardeningModulus: 1e9,
    testConditions: 'Synthetic uniaxial reference; not a steel grade'
  }
});
await window.analysisApi.analyze({size: 5, method: 'wasm-pcg', adaptive: false});
```

Element values are in `result.plasticity.equivalentPlasticStrain`; its `maxEquivalentPlasticStrain` holds the maximum. `plasticStrain` contains six plastic-strain components per element. The UI displays equivalent plastic strain as a percentage.

Supported execution is Airpocket JS/WASM CPU, up to 2000 tetrahedra and 2000 nodes. A final total principal strain with absolute value above 0.02 is rejected. This bound is not an accuracy guarantee. MFEM, WebGPU, adaptive remeshing, modal analysis, thermal stress, temperature-dependent properties, mechanical contact, fatigue, fracture and finite-strain plasticity are unsupported.

Tet4 can lock under isochoric plastic deformation and predict an excessively stiff response. Agreement for a uniform bar does not establish accuracy for arbitrary geometry. Compare reactions, displacements and plastic zones against independent reference solutions and multiple meshes.

References are the author's [FEniCSx radial-return and consistent-tangent example, including its locking warning](https://bleyerj.github.io/comet-fenicsx/tours/nonlinear_problems/plasticity/plasticity.html), and the [official MOOSE isotropic plasticity update](https://mooseframework.inl.gov/source/materials/IsotropicPlasticityStressUpdate.html). This implementation is not a port of those solvers or an accuracy certification. Regression coverage belongs in `tests/plasticity.test.mjs` and `tests/worker-pipeline.test.mjs`; consult the actual verification record for execution results.
