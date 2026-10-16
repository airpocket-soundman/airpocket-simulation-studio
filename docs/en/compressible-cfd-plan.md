# Compressible CFD and meshfree research plan

[日本語](../compressible-cfd-plan.md)

Research date: 2026-10-14 (SU2, OpenFOAM-family, HiSA and Eilmer research sheets added 2026-10-16). Documentation and planning only: no solver installation, build, port, simulation or custom solver implementation. Target Mach-2 flow around complex geometry using user-owned compute and agent operation. The supplied cow image does not identify its solver or validation conditions.

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

## Research sheets (CFDRESEARCH1, retrieved 2026-10-16)

Nothing was implemented, built, run or downloaded as a binary; only official pages, GitHub/GitLab API metadata and raw source files were read. Labels: [Confirmed] = read directly in the cited source, [Inferred] = reasoning from confirmed facts, [Not verified] = could not be established here. Numbered sources are listed at the end.

### Pinned versions, licences, distribution

| Candidate | Pin candidate | Licence and distribution | Status |
|---|---|---|---|
| SU2 | v8.5.0 (2026-04-27, GitHub API). Official zips: linux64-mpi/omp, macos64(-mpi), win64-mpi/omp (win64-omp 28,043,921 B) [S1] | LGPL 2.1. LICENSE also carries third-party notices: ParMETIS/METIS free only for non-profit education/research, evaluation-only for others, redistribution needs prior approval; TecIO under Tecplot terms; CGNS zlib-style; CLI11 BSD-3 [S2] | [Confirmed]. Whether a ParMETIS-free build is cleanly redistributable is [Not verified] (that ParMETIS is only built with MPI is [Inferred] from meson.build) |
| OpenFOAM Foundation | v14 (2026-07-14), v13 (2025-07-08) [S3] | GPLv3 (official footer) [S4]; trademarks separate | [Confirmed] |
| OpenFOAM ESI/OpenCFD (Keysight) | v2606 (2026-06-26), v2512 (2025-12-22) [S5] | "distributed by Keysight under the GPL License" (version not stated); source plus prebuilt Linux/Windows/macOS packages [S6] | [Confirmed]; GPL version detail [Not verified] |
| HiSA | 1.13.4 for OpenCFD v2512 (tag validated-v2512, 2026-04-03); 1.13.2 for Foundation v13 (validated-v13, 2025-08-10). Supported: OpenCFD 2006-2512, Foundation 9-13 [S7] | GitLab LICENSE: GPL v3.0 only [S8]. The site states no licence and disclaims OpenCFD endorsement | [Confirmed]. Support for OpenFOAM v14/v2606 [Not verified] |
| Eilmer/GDTk | v5.0.0 (2025-12-31); previous v4.1.0 (2022-02-23) [S9] | GPLv3; docs CC BY-SA 4.0 [S10] | [Confirmed]. GitHub Releases is empty; tags only |

HiSA requires a specific host: with Foundation, pin v13 (v14 is not in its list) [Inferred]; with ESI, pin v2512. All four are GPL/LGPL, so user-downloaded native use is plausible, while bundled redistribution by Studio must satisfy per-version source/notice obligations; legal judgement is out of scope here.

### Dependencies, build and WASM

| Candidate | Dependencies and build | WASM/browser | Footprint |
|---|---|---|---|
| SU2 | C++17, meson >=1.8.2, Python. A plain serial build needs no external libraries; Eigen, CLI11, mel, Catch2 are bundled. MPI adds METIS/ParMETIS; optional CGNS, TecIO, PaStiX, BLAS, CoolProp, Mutation++ [S11, S12] | No public Emscripten port found by search: [Not verified]. A pared-down serial C++17 file-I/O solver could be feasible in principle, but memory limits, threads and virtual filesystem are untested [Inferred] | Release zips about 28-38 MB; installed size [Not verified] |
| OpenFOAM (both lines) | Large C++ code base, custom wmake, separate ThirdParty archive, environment scripts, many shared libraries [S13] | No public port found: [Not verified]. Dynamic library loading, shell-driven workflow and MPI assumptions make direct porting hard [Inferred] | Installed size [Not verified] |
| HiSA | Extra Allwmake build on top of OpenFOAM; modified cfMesh optional [S7] | Dependent on OpenFOAM; independent port unlikely [Inferred] | Not verified |
| Eilmer | D (ldc2), gfortran with 32-bit libs, C, readline, ncurses, OpenMPI, plotutils, Python/Ruby FFI; Lua bundled [S14] | LDC has targeted WebAssembly since 2018 but no 2025-2026 evidence on druntime/WASI maturity was found: [Not verified]. Fortran, Lua and native FFI make it hard [Inferred] | Not verified |

### I/O, intermediate results, stop and restart

| Candidate | Input | Output | Residuals / observation | Stop / restart |
|---|---|---|---|---|
| SU2 | .cfg plus .su2 (ASCII nodes/elements/MARKER_TAG) or CGNS (single-zone unstructured, ADF only); Gmsh exports .su2 [S15] | OUTPUT_FILES default RESTART, PARAVIEW, SURFACE_PARAVIEW; CSV, TECPLOT, STL also; VOLUME_OUTPUT picks fields, RES_ prefix saves residual fields [S16] | History output (RMS_RES, AERO_COEFF...), SCREEN_OUTPUT, `SU2_CFD -d` lists fields; frequency configurable [Confirmed] | RESTART_SOL=YES with restart file; RESTART_ITER for unsteady [S12, S20]. A soft-stop (signal/stop file) was not found in the first part of CDriver.cpp: [Not verified]. External process termination is the fallback [Inferred] |
| OpenFOAM | Case directory (system, constant, 0); meshing by blockMesh, snappyHexMesh etc. | Time directories (ascii default, binary option) | Residual logging via function objects: [Not verified]; writeControl modes in controlDict [S17] | startFrom latestTime; stopAt writeNow/noWriteNow/nextWrite; runTimeModifiable re-reads dictionaries [S17]. Mid-run effect of editing stopAt [Not verified] |
| HiSA | OpenFOAM case format [S7] | OpenFOAM format | Local time stepping for steady convergence; residual output format [Not verified] | Follows OpenFOAM [Inferred] |
| Eilmer | Lua scripts (prep) generating grids and config; structured and unstructured blocks | VTK and Tecplot writers, history, loads [S18] | history.d and loads.d exist; halt_on_large_flow_change option [S19] | max_step, max_time, halt_now flag, .control file re-read (control_count) [S19]. A restart prep script e4-prep-restart exists [Confirmed]; workflow [Not verified] |

### Boundary coverage for compressible external flow

| Candidate | Confirmed support |
|---|---|
| SU2 | MARKER_EULER (slip wall), MARKER_FAR, MARKER_SUPERSONIC_INLET, MARKER_SUPERSONIC_OUTLET, MARKER_INLET, MARKER_OUTLET, MARKER_SYM, MARKER_HEATFLUX, MARKER_ISOTHERMAL. SOLVER EULER/NAVIER_STOKES/RANS; convective schemes include ROE, AUSM family, HLLC [S20] [Confirmed from config_template]. Stability on Mach-2 3D unstructured cases [Not verified] |
| rhoCentralFoam | Transient density-based solver, Kurganov-Tadmor central-upwind, with heat transfer and shock capturing; p, U, T required; turbulence/thermophysics via dictionaries [S21]. The full BC catalogue [Not verified] |
| HiSA | Characteristic non-reflective far-field and reflective wall BCs, local time stepping, implicit coupled system, shock-capturing schemes, ALE moving meshes [S22]. Individual BC names [Not verified] |
| Eilmer | bc/ directory (supersonic inflow etc. [Inferred] from file names). Example directories include 6-degree sharp wedge, blunt wedge, oblique shock, spheres, cylinders, shock tubes, forward-facing step (names only; contents [Not verified]) [S23] |

### Validation problems and accept/reject criteria

Common rule: SI units, ideal gas (gamma 1.4) and identical free-stream states; convert each candidate's output into the shared result contract. Tolerances are provisional placeholders to be revisited after first measurements.

| ID | Problem | Reference | Metrics (provisional) |
|---|---|---|---|
| V1 | 1D shock tube (Sod-type, nondimensional) | Exact Riemann solution | Shock/contact location, conservation, positivity; L1 error decreases monotonically on grid doubling |
| V2 | Mach-2 wedge, 10-degree half angle | Theta-beta-M relation and oblique-shock pressure ratio | Relative error of shock angle and pressure ratio decreases with refinement; provisional target 1% or less |
| V3 | Mach-2 blunt cylinder or sphere | Published shock stand-off correlations plus candidate cross-comparison | Surface Cp, stand-off distance; spread between candidates within the correlation's published uncertainty |
| V4 | Inflow/outflow/far-field reflection | Uniform-flow preservation, domain-size dependence | Small departure from free stream; result unchanged when the domain is enlarged |
| V5 | Coarse cow geometry (final demo, no reference) | None | Surface closure, completion, conservation balance, density-gradient view only; no accuracy claim |

Accept (all required): (1) pinned version, licence and dependencies are [Confirmed] and user download or bundling is permissible; (2) V1 and V2 are reproduced within tolerance with SI-unit I/O conversion; (3) intermediate residuals or fields are obtainable during a run and stop/restart is an established procedure, demonstrated in measurement (SU2 stop, OpenFOAM stopAt/latestTime, Eilmer max_step/halt_now/restart); (4) V3 and V4 show no negative pressure/density and a valid far field; (5) memory and run time can be estimated for user hardware, and for WASM the payload, initialization and memory ceilings are acceptable separately.

Reject: licence terms cannot be met, versions cannot be pinned, V1/V2 not reproduced, stop/restart cannot be made a procedure, or dependencies are incompatible with Studio's distribution form. WASM is not a mandatory gate; native baselines are evaluated first (existing policy).

### Provisional recommendation (includes inference)

- Keep SU2 v8.5.0 first: official zips, CLI, mesh format, BCs, history and restart are documented. Design user-download rather than bundling first, since the ParMETIS terms can matter for commercial redistribution [Inferred].
- OpenFOAM lines are cross-check candidates. Mind the Foundation v14 / HiSA 1.13.2 (v13) mismatch; fix one of v13+HiSA or v2512+HiSA 1.13.4 [Inferred].
- Eilmer has rich example cases but heavy build dependencies; WASM looks hard [Inferred].
- Browser WASM feasibility is demonstrated for none [Not verified]; a minimal-build trial belongs to a later stage.

### Sources (retrieved 2026-10-16)

- S1: https://api.github.com/repos/su2code/SU2/releases/latest
- S2: https://github.com/su2code/SU2/blob/master/LICENSE.md
- S3: https://openfoam.org/download/history/
- S4: https://openfoam.org/download/14-source/
- S5: https://www.openfoam.com/news/main-news
- S6: https://www.openfoam.com/news/main-news/openfoam-v2606
- S7: https://hisa.gitlab.io/download/
- S8: https://gitlab.com/hisa/hisa/-/blob/master/LICENSE
- S9: https://github.com/gdtk-uq/gdtk/tags
- S10: https://github.com/gdtk-uq/gdtk
- S11: https://raw.githubusercontent.com/su2code/SU2/v8.5.0/meson.build
- S12: https://su2code.github.io/docs_v7/Installation/ and https://raw.githubusercontent.com/su2code/SU2/v8.5.0/meson_scripts/init.py
- S13: https://openfoam.org/download/14-source/
- S14: https://github.com/gdtk-uq/gdtk (README Quick Start)
- S15: https://su2code.github.io/docs_v7/Mesh-File/
- S16: https://su2code.github.io/docs_v7/Custom-Output/
- S17: https://doc.cfd.direct/openfoam/user-guide-v13/controldict
- S18, S23: https://github.com/gdtk-uq/gdtk/tree/master/src/eilmer and https://api.github.com/repos/gdtk-uq/gdtk/contents/examples/eilmer/2D
- S19: https://raw.githubusercontent.com/gdtk-uq/gdtk/master/src/eilmer/globalconfig.d
- S20: https://raw.githubusercontent.com/su2code/SU2/v8.5.0/config_template.cfg
- S21: https://doc.openfoam.com/2212/tools/processing/solvers/rtm/compressible/rhoCentralFoam/
- S22: https://hisa.gitlab.io/
- WASM searches (no SU2/OpenFOAM port found; LDC added a WebAssembly target in 1.11, 2018, current status unknown).

### Still unverified

SU2 soft-stop mechanism; redistribution of a ParMETIS-free SU2; actual BC behaviour at Mach 2; OpenFOAM residual-output details; HiSA individual BC names and v14 support; Eilmer restart workflow and stop file; installed size, memory and WASM feasibility for every candidate. Legal interpretation of licences is outside this survey and must be checked per pinned version.

## Verification, outputs and remaining research

Shock tubes: fields, wave positions, conservation, positivity and refinement. Wedges: shock angle/pressure ratios. Blunt bodies: shock location, Cp and domain/space/time dependence. Boundaries: reflection/transmission and leakage. Complex cows are final demonstrations, not reference solutions; record surface closure/orientation, simplification and thin features.

Preserve node/cell/particle association, density, pressure, velocity, temperature, Mach, time, residuals and balances. Store free-stream Cp references and define schlieren-like fields as density gradients. Separate solve steps from stored/export frames.

No official WASM distribution was confirmed in this review, which is not proof that none exists. Exact versions, build graphs, wall/inflow/outflow examples, acceptance tolerances and resource targets remain research items. Some sources are older guides; PeleC redirects to Pele-Suite and parts of its old documentation were inaccessible. Recheck against selected versions.

Primary sources: [SU2 theory](https://github.com/su2code/su2code.github.io/blob/master/_docs_v7/Theory.md), [installation](https://su2code.github.io/docs_v7/Installation/), [AMReX embedded boundaries](https://amrex-codes.github.io/amrex/docs_html/_downloads/008eb6dbfab802633dff40122ece848c/amrex.pdf), and candidate repositories linked above.
