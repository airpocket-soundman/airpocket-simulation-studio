# Material temperature, rate and direction data

[日本語](../material-dependence.md)

Register optional dependence JSON in the material details panel. Projects and case archives preserve it. Young’s modulus in JSON uses Pa (the ordinary input uses MPa), temperatures use °C and strain-rate bounds use 1/s.

```json
{
  "elasticTemperatureTable": [
    {"temperature": 20, "youngModulus": 1000000000, "poissonRatio": 0},
    {"temperature": 80, "youngModulus": 500000000, "poissonRatio": 0}
  ],
  "strainRateMin": 0,
  "strainRateMax": 1,
  "rateDependent": false,
  "directionality": "isotropic",
  "testConditions": "Synthetic reference material; not a design value."
}
```

For uniform-temperature structural analysis, Young’s modulus and Poisson’s ratio use piecewise linear interpolation. Supply 2–100 rows in increasing temperature order. Extrapolation is rejected. The uniform material evaluation temperature applies without thermal stress; thermal-stress calculations use the solid temperature instead. Transferred temperature fields can use the table only when all nodes have the same temperature. Nonuniform temperature-dependent stiffness, temperature-dependent conductivity and integrated variable expansion coefficients are unsupported.

Airpocket JS/WASM, the WebGPU correction path and MFEM receive the evaluated elastic constants. Results report the evaluation temperature and interpolated constants. A 10×10×40 mm bar carrying 100 N at 50°C and 750 MPa has an axial reference displacement of 0.053333 mm. Synthetic example data does not replace measurements.

Registered temperature bounds are enforced for structural material temperatures and temperature extrema at every thermal step. Static structure has zero strain rate, which must lie in the registered rate envelope. Structural calculations reject `rateDependent: true` and `directionality: "orthotropic"`; those constitutive laws are not implemented.

An orthotropic record requires three global unit vectors such as `axes: [[1,0,0],[0,1,0],[0,0,1]]`. Orthogonality and right-handed orientation are validated. Free-text test conditions can record test standards, humidity, rate and direction. These mechanical direction records are not applied to heat conduction.

Automated verification: `tests/material-dependence.test.mjs` and `tests/worker-pipeline.test.mjs`. Headless API calls are `setMaterialProperties({..., dependence: ...})` and `setStudy({kind:"structural", materialTemperature:50})`. Invalid updates preserve the original project.
