# Compressible CFD and meshfree research plan

[日本語](../compressible-cfd-plan.md)

Research date: 2026-10-14. Documentation and planning only: no solver installation, build, port, simulation or custom solver implementation. Target Mach-2 flow around complex geometry using user-owned compute and agent operation. The supplied cow image does not identify its solver or validation conditions.

## Revised solver introduction order (2026-10-15)

The first new solver targets ordinary-speed external airflow around a fixed cow-like solid. Evaluate existing OSS for low-Mach incompressible viscous Navier–Stokes with inertia, including unsteady/turbulence needs at the selected Reynolds numbers. Existing Stokes settings cannot provide this. Preserve I/O, API/MCP/Skill priority; progress from native simple reference cases to rough cow geometry. Acceptance is specified in the [roadmap](roadmap.md).

The Mach-2 candidate comparison and staged Euler plan below remain research for subsequent compressible support. Ordinary-speed candidate selection still requires investigation; do not transfer the supersonic ranking unchanged. Decide custom development or meshfree adoption only after establishing unmet requirements in existing OSS.

## Scope and candidates

Existing Stokes/channel and small-signal acoustic engines cannot become shock-capable compressible CFD by changing settings. Start with fixed geometry and ideal-gas inviscid Euler. Viscosity, turbulence, boundary layers, heating, moving bodies, FSI and real gases are separate stages. Inviscid visualization does not validate total drag or thermal performance.

| Candidate | Method | Role and caveat |
|---|---|---|
| [SU2](https://github.com/su2code/SU2) | Mesh-based FVM/DG | First reference candidate; compressible Euler/NS. Investigate serial native dependencies first |
| [rhoCentralFoam](https://doc.openfoam.com/2212/tools/processing/solvers/rtm/compressible/rhoCentralFoam/) | Mesh-based FVM | Shock-capable alternative. Pin distribution/version; this source is OpenCFD, not interchangeable with Foundation versions |
| [HiSA](https://hisa.gitlab.io/) | OpenFOAM-related high-speed solver | Transonic/supersonic candidate; check host-version compatibility and dependencies |
| [Eilmer/GDTk](https://github.com/gdtk-uq/gdtk) | Mesh-based compressible flow | Reference/alternative; D and additional language/build dependencies complicate portability |
| [AMReX](https://github.com/AMReX-Codes/amrex)/[PeleC](https://github.com/Pele-Suite/PeleC) | AMR Cartesian embedded boundaries | Prioritize for reducing geometry/meshing work. AMReX alone is not a finished CFD solver |
| [PySPH](https://github.com/meshfree-research/PySPH) | SPH | Compressible examples, but external high-speed walls/inflow/outflow need validation. Python/generated code is not immediately browser-ready |
| [Spheral](https://github.com/llnl/spheral) | SPH/ASPH/CRKSPH | Compressible particle-method reference; validate suitability beyond its original application domains |
| [GIZMO](https://arxiv.org/abs/1409.7395) | MFM/MFV/SPH | Meshfree-method reference; astrophysical hydrodynamics does not establish arbitrary wall-bound external-flow capability |

All Airpocket adapters and WASM execution remain unverified. Checked public license sources include SU2 LGPL 2.1, PySPH/Spheral BSD-3 and GIZMO's GPL statement. Review exact pinned versions, dependencies and redistributed assets before adoption; other details remain research items.

User-free meshing and mathematical meshlessness are distinct. Embedded boundaries still use a background grid; particle/point methods still require sampling, neighborhoods, resolution and wall treatment. Evaluate the simplest method that meets the geometry workflow.

## Efficient adoption sequence

1. Compare pinned native serial Euler inputs, dependencies, licenses and outputs, with SU2 first and an independent alternative.
2. Specify verification on shock tubes, Mach-2 wedges and blunt bodies before complex demos.
3. Compare automated boundary-fitted meshing with Cartesian embedded boundaries for geometry preparation, thin gaps and wall accuracy.
4. Evaluate minimal WASM builds separately for dependencies, I/O, threads, memory, payload and initialization. CUDA/OpenCL support is not WebGPU support. Native capability alone does not establish WASM feasibility.
5. Assess meshfree candidates using identical physics, reference cases, walls, boundaries, conservation and resource metrics.
6. Decide whether targeted extension/porting or custom development addresses a concrete unmet requirement. Do not rebuild a full mesh solver and then rebuild a full meshfree solver.

Retain shared geometry/regions/units, case definitions, diagnostics, result schemas, visualization and benchmarks. The current convex-STL path does not support general concave cow geometry; plan a separate surface/fluid-domain path.

## Conditional custom-development stages

Define conservative variables, ideal-gas EOS, units, boundaries, diagnostics and output contracts shared by native/WASM. Start with a first-order 1D finite-volume Euler kernel using established fluxes; consider robust HLLE and contact-resolving HLLC options. Verify positivity, CFL, conservation, shocks and rarefactions before limited higher-order reconstruction. Extend to 2D Cartesian wedges/reflections/expansion waves. Choose embedded boundaries or point/particle methods after comparing geometry needs. Validate cut-cell or neighborhood reconstruction, conservation and walls before 3D/adaptivity. Add GPU/parallelism after a CPU reference, and viscosity/turbulence/motion only with corresponding requirements and benchmarks.

EOS, fluxes, temporal integration, physical boundary semantics and tests can be reused. Meshfree volume/face estimation, neighborhoods, gradients, point quality and wall models are additional work; replacing mesh arrays with points is insufficient. Low-speed liquid WCSPH settings are not Mach-2 gas models.

## Verification, outputs and remaining research

Shock tubes: fields, wave positions, conservation, positivity and refinement. Wedges: shock angle/pressure ratios. Blunt bodies: shock location, Cp and domain/space/time dependence. Boundaries: reflection/transmission and leakage. Complex cows are final demonstrations, not reference solutions; record surface closure/orientation, simplification and thin features.

Preserve node/cell/particle association, density, pressure, velocity, temperature, Mach, time, residuals and balances. Store free-stream Cp references and define schlieren-like fields as density gradients. Separate solve steps from stored/export frames.

No official WASM distribution was confirmed in this review, which is not proof that none exists. Exact versions, build graphs, wall/inflow/outflow examples, acceptance tolerances and resource targets remain research items. Some sources are older guides; PeleC redirects to Pele-Suite and parts of its old documentation were inaccessible. Recheck against selected versions.

Primary sources: [SU2 theory](https://github.com/su2code/su2code.github.io/blob/master/_docs_v7/Theory.md), [installation](https://su2code.github.io/docs_v7/Installation/), [AMReX embedded boundaries](https://amrex-codes.github.io/amrex/docs_html/_downloads/008eb6dbfab802633dff40122ece848c/amrex.pdf), and candidate repositories linked above.
