# Solver candidates and selection

[日本語](../solvers.md)

These are native OSS candidates, not a promise that they run in the browser. Each adapter/version/element/material/boundary combination must be built and validated.

|Candidate|Role|Integration intent|
|---|---|---|
|CalculiX|Linear/nonlinear structural, static/dynamic and thermal|First structural candidate|
|Elmer FEM|Structural, thermal, fluid and acoustic equations|Thermal/acoustic and comparison candidate|
|Code_Aster|Advanced structural, thermal, fatigue/fracture|Later specialist adapter|
|OpenFOAM Foundation|CFD and solid/fluid heat transfer|Primary CFD candidate; finite volume, not FEM|
|Gmsh|CAD/meshing|Meshing candidate, not a physics solver|
|occt-import-js|STEP import/tessellation|Browser WASM import already used|

Expose only supported combinations. Keep candidate, implemented adapter, validated capability and available runtime as separate states. Display why a solver is unavailable. Separate common settings from engine-specific ones, and list conditions that cannot transfer when switching. Never silently change engines after a failure.

Compare identical geometry, loads, materials, boundaries, units and convergence targets; record mesh and element differences. Peak stress alone is not a sufficient equivalence test.

Browser execution requires checking language/toolchain, Fortran/BLAS/sparse/MPI dependencies, filesystem assumptions, memory and licensing. Native binaries cannot run directly from Pages. Do not label a newly assembled browser engine as CalculiX or another original engine. Review licenses, source/notice obligations and redistribution before shipping any solver.

Official sources: [CalculiX](https://www.calculix.de/), [Elmer](https://github.com/ElmerCSC/elmerfem), [Code_Aster](https://code-aster.org/en/product/main), [OpenFOAM](https://openfoam.org/), [Gmsh](https://gmsh.info/doc/texinfo/).

MFEM 4.10 independent stiffness assembly and CG are implemented as a WASM structural engine. [Scope and build process](native-solvers.md). Other candidates above remain unported.
