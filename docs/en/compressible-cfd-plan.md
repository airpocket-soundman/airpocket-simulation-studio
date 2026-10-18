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


## Embedded-boundary and meshfree research sheets (CFDRESEARCH2, 2026-10-18)

This addition is literature/source research only. SHAs below pin **research snapshots of default branches**, not recommended stable releases or complete runnable environments. [Confirmed] means documented in official sources; [Judgement] means a product-specific inference; [Unverified] means no build, numerical trial or integration was performed. This work is separate from the existing ordinary-speed SU2 evaluation and adds no Mach-2 capability.

### Candidates and pins

| Candidate | Research SHA / distribution | Documented evidence | Unverified work / decision |
|---|---|---|---|
| AMReX | `f621539f8f890a877119061caaef313852ea6166`, BSD-3 [E1] | [Confirmed] Cartesian EB geometry/data infrastructure; regular/cut/covered cells, no multi-valued cells, small-cell stability issue [E2] | [Judgement] First geometry-workflow research target, not a complete Euler solver. Reject or refine geometries where thin gaps divide one cell into multiple fluid fragments; validate that handling |
| PeleC | `949e2bb67386bf4b16324b06555e303ff411e179`, three-condition BSD-style licence [E3]; PelePhysics gitlink `6e8026fc6ed121c07e32c9d3fe1d1c919bafc64b` | [Confirmed] C++20, AMReX/PelePhysics/SUNDIALS dependencies, MPI/OpenMP/GPU configurations and plotfiles [E3]; EB updates and FluxRedist/StateRedist documented [E4] | [Judgement] Runnable EB comparison candidate. Pin all nested submodules, EOS and non-reacting configuration; do not mix independent AMReX HEAD with PeleC arbitrarily. Minimal serial CPU build, Windows and WASM are [Unverified] |
| PySPH | `1cd3dea9cfaac7d9f1bda2a2491ce4b42a31dbe5`, BSD-3 with subordinate LICENSE exceptions [E6] | [Confirmed] Python with generated/compiled execution, optional OpenMP/OpenCL/MPI; installation requires a C++ compiler. Gas Sod example exists [E6, E7] | [Judgement] Small particle-method research candidate. Liquid WCSPH examples do not establish external gas-wall support. Neighbour counts, smoothing length, boundary particles, particle injection/removal balances, concave 3D walls and Mach 2 are [Unverified] |
| Spheral | `e9e3df91174e5af4b51ed41327474d75062be4f1`, BSD-3 [E9] | [Confirmed] SPH/ASPH/CRKSPH and compatible-energy mode. Current CMake uses C/C++/Fortran and >=3.24; external build guide assumes Linux/Spack and recommends Ubuntu 24.04 [E9, E10] | [Judgement] Conservation/restart comparison candidate. Pin Python bindings, HDF5/Silo and other dependencies. Native Windows/browser execution, arbitrary CAD walls and resource requirements are [Unverified] |
| GIZMO (method reference only) | Original paper v2, 2015-12-13 [E12] | [Confirmed] MFM/MFV research combines kernel volume estimates, reconstructed gradients and Riemann problems | [Judgement] Reference for flux/EOS reuse, not evidence of arbitrary solid-wall external-flow integration. Old gizmo-public README redirects to pfhopkins/gizmo [E13]. Current distribution/dependencies/licences are not fully pinned; adoption remains on hold |

The standalone AMReX SHA supports geometry-document research; it is not claimed to match PeleC's dependency pin. Installed size, peak RSS, elapsed time, browser payload and initialization are unmeasured for every candidate. A BSD label does not clear the complete dependency distribution.

### Walls, boundaries, I/O and operation

| Candidate | Evidence on walls / inflow / outflow / shocks | Proposed I/O and stop/restart contract | Integration still needed |
|---|---|---|---|
| AMReX/PeleC | [Confirmed] Domain SlipWall/NoSlipWall, adiabatic by default, UserBC/Hard and inflow/outflow guidance; old GS-NSCBC is explicitly not ported to C++ [E5]. Distinguish domain BCs from EB-wall implementation | [Confirmed] Sod/EB input examples and plotfiles [E3, E14]. [Planned] Validate step/time, residuals or balances, checkpoint/restart and final complete frame after stopping | Small-cell redistribution, EB/AMR coarse-fine balances, wall normals/flux extraction and equivalent restart remain [Unverified]. Do not advertise the deprecated NSCBC text as current non-reflecting support |
| PySPH | [Confirmed] Gas Sod source [E7]. [Unverified] Concave Mach-2 walls, far field and gas-particle injection/removal conditions | [Confirmed] Output implementation and --restart-file [E8]. [Planned] Preserve particle IDs, mass, positions, volume and smoothing length; compare restarted fields/neighbour settings. Killing a process does not create a checkpoint | Manage Python and generated-code caches. Do not silently relabel particle fields as nodal fields. A generic inflow/outflow class alone does not validate a compressible boundary |
| Spheral | [Confirmed] InflowOutflowBoundary documents node creation/restart registration; ReflectingBoundary source and Sod/restart test definitions exist [E11] | [Planned] Python case to NodeList fields, conserved quantities and restart; begin with Sod restartStep/restoreCycle/checkRestart for measured restart differences | API declarations/upstream test definitions are not Airpocket passes. Wall penetration, facets, neighbour distribution and energy balance remain [Unverified] |

A common adapter must declare input hashes, units, EOS/gamma, free-stream rho/p/T/U, method/version/dependencies, seed/grid/resolution, boundary semantics, physical time/dt and output interval. Record stop procedure, partial-artifact completeness and files/versions required for restart. Explicit solvers without residual output should report step/time and conservation errors, not invented residuals. A discretization-independent MCP wire contract is planned; existing API acceptance is not claimed.

### Common benchmarks and decisions (unexecuted specification)

Reuse V1–V5 above with the B1–B5 specifications below. Approve and freeze numerical tolerances **before execution**, including reference uncertainty and intended use; do not loosen them after seeing results. V2's earlier 1% target remains provisional research intent, not a validated product standard.

| ID | Fixed problem | Comparison and rejection conditions |
|---|---|---|
| B1 / V1 | Sod: x in [0,1], discontinuity .5, left (rho,u,p)=(1,0,1), right=(.125,0,.1), gamma=1.4, t=.2, nondimensional. Evaluate before waves reach the ends. PeleC's current CMake rejects 1D, so use a transversely uniform periodic 2D strip [E14] | Exact Riemann solution: volume-weighted L1 rho/u/p, wave positions, minimum rho/p. Plan 100/200/400 equivalent axial resolution and separate dt variation. Particle volume is mass/density, not equal point weighting. Reject hidden negative-state/NaN clipping or unexplained resolution behaviour |
| B2 / V2 | Mach 2, 10-degree wedge, gamma=1.4, identical free-stream pressure/density and length, slip wall; weak theta-beta-M branch [E15] | Shock angle, pressure ratio, normal wall mass flux, global mass/momentum/energy including boundary fluxes and wall-pressure forces. Translate/rotate Cartesian grids to isolate cut-cell sensitivity; vary particle placement/seed separately. Hold for reference mismatch, wall leakage or opaque stabilization |
| B3 / V3 | Mach-2 sphere, distinct from a cylinder; fixed diameter D and far field, planned D/delta=16/32/64 equivalents | Cp, stand-off distance, resolution/dt/domain dependence. SU2 cross-comparison alone does not establish correctness: fix a correlation's applicability/uncertainty first. Separate surface-area errors from physical-solution errors |
| B4 / V4 | Uniform flow without a body, then small-amplitude pulse passage through open boundaries; separately a closed oblique wall and thin gap in stationary fluid | Free-stream preservation, reflection amplitude, mass/energy balances, wall penetration, preparation time. Record minimum EB volume fraction/multi-valued detection or deficient particle neighbourhoods and conservation added/removed at open boundaries. Reject unrepresentable gaps explicitly rather than silently sealing them |
| B5 / V5 | Same simplified closed cow surface/free stream, only after B1–B4 pass | Orientation/holes/thin features, preparation time, wall-clock, peak RSS, conservation and restart differences. Demonstration without a reference solution; attractive Mach images are not accuracy evidence |

Accept only after source/dependencies/distribution are pinned, agreed B1–B4 errors/conservation/positivity and reproducibility pass, unsupported geometry is explicitly refused, observation/cancellation/restart work, and user-PC resource budgets pass. Measure a serial CPU baseline first; WASM/GPU are separate gates. Hold for unverified walls/open boundaries, silently accepted multi-valued geometry, missing conservation from particle corrections, unresolved dependency terms or failed benchmarks. **All candidates are currently on hold for adoption.** Prioritizing PeleC EB followed by independent PySPH/Spheral comparisons is [Judgement], not measured performance ranking.

## Reuse-first custom solver plan (CFDRESEARCH3, 2026-10-18)

### Trigger and existing assets

There is no established need to build a custom solver yet. For each candidate, record requirements (concave walls, open boundaries, agent-controlled stop/restart, PC resources, distribution), B1–B5 results, whether configuration/adapter changes suffice, and the cost of a targeted library extension. Stop custom development if existing native OSS meets requirements. Unverified WASM or Python dependencies alone do not justify rewriting a solver. Build only a specified unmet capability with an agreed acceptance test.

| Existing asset, checked in source | Reusable design/functionality | Work that cannot be reused unchanged |
|---|---|---|
| scripts/native-flow-host.mjs, studio-native-flow-mcp.mjs | Approved input, request IDs, process cancellation, observations and artifact hashes | Current host is a fixed SU2 case. Multiple candidates/compressible schemas need a new adapter and validation |
| scripts/analysis-job-service.mjs, analysis-process-worker.mjs | Timeout, settlement, bounded events, failure versus complete output | Each candidate still needs checkpoint/restart and cancellation evidence |
| src/input-provenance.js, project-revision.js, runtime-identity.js | Separate input sources/assumptions/revisions from runtime identity | Do not claim the present schema covers all CFD inputs. Explicitly extend for external binaries/dependency hashes, EOS and particle arrangement |
| src/fluid-domain.js, stl-source.js | Units, original geometry and surface/closure inspection patterns | Convex-STL volume generation does not generate arbitrary concave EB or particle arrangements |
| src/native-flow-view.js, probe.js, saved-case/archive | Pressure/velocity views, measurements/comparison and hashed persistence patterns | Current slice handles tetrahedral cell type 10. AMR cut-cell/particle sampling, balances and Cp/Mach need work; add result-kind validation before existing archive ingestion |

### Stages and exit gates (all planned, unimplemented)

| Stage | Smallest addition | Advance / stop gate |
|---|---|---|
| C0 gap/contract | Gap record; U=(rho,rho*u,rho*v,rho*w,rho*E), SI, gamma/EOS, absolute p/T, input hashes, cell/particle association, errors/balances | Do not build if an OSS adapter suffices. State nondimensional-test to SI conversion. Stop for EOS/gamma/energy-definition mismatch |
| C1 1D CPU | First-order uniform-grid FVM; documented HLLE as robust baseline candidate and HLLC as comparison [E16]. Reflecting/transmissive boundaries, CFL-based dt, conservation accounting | B1 plus strong rarefaction/shock: positive rho/p, conservation and dt/resolution dependence. Do not pass through negative clipping. Fix CFL and vacuum-support envelope from the selected scheme beforehand; explicitly reject unsupported vacuum |
| C2 2D CPU | Cartesian transverse B1, B2 wedge, rotation/advection tests. Add time integration and higher-order reconstruction as separate changes | 1D/2D reduction agreement, boundary flux/global balance and grid-orientation sensitivity. Retain C1 regression after higher order; document limiter/positivity treatment and limits |
| C3 choose one geometry method | EB: cut volume/face apertures, wall flux, small-cell stabilization, coarse-fine accounting. Particle: neighbours, volume/gradients/pair flux, wall particles and open-boundary balances | B2/B4 and coarse B3 wall leakage/geometry sensitivity. Do not fully develop both methods simultaneously. Replacing FVM arrays with points is insufficient |
| C4 3D/local resolution | B3 sphere then B5 cow, reproducible geometry-to-discretization, full fields/balances/domain study | B1–B4 regression, spatial/time/domain dependence, stop/restart, memory/time budgets. Visualization alone cannot pass |
| C5 distribution/acceleration | Minimal CPU WASM sharing native input/result schemas; later SIMD/threads/WebGPU | Compare payload/init/peak memory, same-case numerical differences, cancellation/diagnostics/persistence. Keep native if porting fails. Viscosity/turbulence/boundary layers need a separate plan |

Research completion means recorded candidate sheets, benchmark specifications, decision gates and staged reuse plan. It does not complete C0–C5, adopt a candidate or validate B1–B5 physically. Next work: pin a minimal candidate configuration and all nested dependency SHAs, build on Linux CPU, and approve B1/B2 execution tolerances/resource budgets beforehand. No such success is inferred here.


### Additional primary sources (retrieved 2026-10-18)

Source links are pinned to research snapshots. Dynamic documentation is supplementary; inaccessible or old PeleC pages are not used to infer support. Source IDs match the Japanese edition.

- E1: [AMReX snapshot / LICENSE](https://github.com/AMReX-Codes/amrex/blob/f621539f8f890a877119061caaef313852ea6166/LICENSE)
- E2: [AMReX EB restrictions and small cells](https://github.com/AMReX-Codes/amrex/blob/f621539f8f890a877119061caaef313852ea6166/Docs/sphinx_documentation/source/EB.rst), [Official EB overview](https://amrex-codes.github.io/amrex/docs_html/EB_Chapter.html)
- E3: [PeleC README](https://github.com/Pele-Suite/PeleC/blob/949e2bb67386bf4b16324b06555e303ff411e179/README.rst), [license](https://github.com/Pele-Suite/PeleC/blob/949e2bb67386bf4b16324b06555e303ff411e179/license.txt), [submodule gitlink](https://github.com/Pele-Suite/PeleC/tree/949e2bb67386bf4b16324b06555e303ff411e179/Submodules)
- E4: [PeleC EB/redistribution](https://github.com/Pele-Suite/PeleC/blob/949e2bb67386bf4b16324b06555e303ff411e179/Docs/sphinx/geometry/EB.rst)
- E5: [PeleC domain BCs and GS-NSCBC warning](https://github.com/Pele-Suite/PeleC/blob/949e2bb67386bf4b16324b06555e303ff411e179/Docs/sphinx/BoundaryConditions.rst)
- E6: [PySPH README](https://github.com/pypr/pysph/blob/1cd3dea9cfaac7d9f1bda2a2491ce4b42a31dbe5/README.rst), [installation](https://github.com/pypr/pysph/blob/1cd3dea9cfaac7d9f1bda2a2491ce4b42a31dbe5/docs/source/installation.rst), [LICENSE](https://github.com/pypr/pysph/blob/1cd3dea9cfaac7d9f1bda2a2491ce4b42a31dbe5/LICENSE.txt)
- E7: [PySPH gas Sod](https://github.com/pypr/pysph/blob/1cd3dea9cfaac7d9f1bda2a2491ce4b42a31dbe5/pysph/examples/gas_dynamics/sod_shocktube.py)
- E8: [PySPH application/restart](https://github.com/pypr/pysph/blob/1cd3dea9cfaac7d9f1bda2a2491ce4b42a31dbe5/pysph/solver/application.py), [output](https://github.com/pypr/pysph/blob/1cd3dea9cfaac7d9f1bda2a2491ce4b42a31dbe5/pysph/solver/output.py)
- E9: [Spheral README](https://github.com/LLNL/spheral/blob/e9e3df91174e5af4b51ed41327474d75062be4f1/README.md), [LICENSE](https://github.com/LLNL/spheral/blob/e9e3df91174e5af4b51ed41327474d75062be4f1/LICENSE)
- E10: [Spheral current CMake](https://github.com/LLNL/spheral/blob/e9e3df91174e5af4b51ed41327474d75062be4f1/CMakeLists.txt), [external build](https://github.com/LLNL/spheral/blob/e9e3df91174e5af4b51ed41327474d75062be4f1/docs/build_guide/external/index.rst), [dependencies](https://github.com/LLNL/spheral/blob/e9e3df91174e5af4b51ed41327474d75062be4f1/docs/build_guide/appendix/external_deps.rst)(prefer current CMake >=3.24 over the guide's >=3.21)
- E11: [Spheral boundary](https://github.com/LLNL/spheral/blob/e9e3df91174e5af4b51ed41327474d75062be4f1/src/Boundary/InflowOutflowBoundary.hh), [ReflectingBoundary](https://github.com/LLNL/spheral/blob/e9e3df91174e5af4b51ed41327474d75062be4f1/src/Boundary/ReflectingBoundary.hh), [Sod/restart test definition](https://github.com/LLNL/spheral/blob/e9e3df91174e5af4b51ed41327474d75062be4f1/tests/functional/Hydro/Sod/Sod-planar-1d.py)
- E12: [Hopkins GIZMO original paper v2](https://arxiv.org/abs/1409.7395v2)
- E13: [Former GIZMO repository relocation notice](https://github.com/pfhopkins/gizmo-public/blob/78b66ffcfad6362f8aa0798f8a23a6c9ba5dd2ca/README.md)
- E14: [PeleC Sod inputs](https://github.com/Pele-Suite/PeleC/tree/949e2bb67386bf4b16324b06555e303ff411e179/Exec/RegTests/Sod), [CMake rejection of 1D](https://github.com/Pele-Suite/PeleC/blob/949e2bb67386bf4b16324b06555e303ff411e179/CMakeLists.txt)

- E15: [NASA Glenn oblique-shock applicability and relations](https://www.grc.nasa.gov/www/k-12/airplane/oblique.html)
- E16: [Einfeldt et al. (1991), On Godunov-type methods near low densities](https://doi.org/10.1016/0021-9991(91)90211-3), [Toro et al. (1994), Restoration of the contact surface in the HLL-Riemann solver](https://doi.org/10.1007/BF01414629). Only DOI/bibliographic metadata was confirmed here; inspect original assumptions, wave speeds and CFL conditions before implementing C1.
