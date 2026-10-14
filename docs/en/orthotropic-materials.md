# Orthotropic material foundation (PRINT2 in progress)

[日本語](../orthotropic-materials.md)

Static small-strain linear CPU structure supports directional elastic constants and material axes through project JSON or API `materialProperties.orthotropic`. Automatic calibration from printing settings, connection of imported 3MF/G-code to analysis geometry, detailed walls/layers/infill and validation against measured printed specimens remain unfinished.

The Japanese companion contains a complete synthetic JSON example. Its constants are analytical references, not measured print data. `youngModuliPa` contains E1/E2/E3; `shearModuliPa` contains G12/G23/G31, all in Pa. `poissonRatios` contains ν12/ν23/ν31, where νij = −εj/εi under uniaxial stress in direction i. Reverse-direction coefficients follow reciprocity. Check a source's convention before transferring values.

`axes` contains material directions 1/2/3 expressed in global coordinates, as orthogonal right-handed unit vectors. Source and test conditions are required. Non-positive-definite or numerically unstable compliance is refused.

Supported methods: `pcg`, `pcg-strict`, `wasm-pcg`. MFEM, WebGPU, modal analysis, thermal stress, hyperelasticity, plasticity, and the existing isotropic fatigue/fracture models are refused. Scalar Young modulus and Poisson ratio are unused for orthotropic analysis. Gravity needs a separately registered apparent density.

Results retain constants, axes and provenance. Archive import checks the registered input and reconstructs strain and stress from displacement. Generic material saving preserves the orthotropic record.

Verification covers analytical directional bar displacement, axis permutation, simultaneous rotation of geometry/loads/supports/material axes, pure shear, the isotropic limit, JavaScript/WASM parity, canonical Worker execution and archive restoration. These tests validate the numerical engine using synthetic references; they do not establish measured print performance.
