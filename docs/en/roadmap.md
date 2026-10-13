# Roadmap and acceptance

[日本語](../roadmap.md)

The canonical task list is src/progress.json and the live development board. Each task includes status, acceptance criteria, dependencies and implementation evidence where deployed. Three-dimensional region setup and the shared API are available; Airpocket structure/heat/limited flow/frequency and transient acoustics/natural modes and independent MFEM structural WASM are integrated. General 3D flow and advanced material/coupling tasks remain.

1. CAD import/viewing, curved partial regions, project persistence and browser runtime feasibility.
2. Volume meshing and linear static analysis; cantilever displacement/reactions, force conservation, units and mesh convergence.
3. A second validated engine and steady/transient thermal analysis with reference solutions and energy balance; begin cavity/pipe acoustics.
4. Nonlinear materials, practical rubber models and advanced structural adapters; compare test curves and standard cases.
5. Fluid domains, laminar flow and validated CFD engine; pipe pressure losses, mesh convergence and mass balance.
6. Adaptive remeshing/reanalysis, thermal stress, conjugate heat transfer, vibroacoustics, turbulence and contact; validate transfers/conservation.
7. Failure/fatigue models with measured material data, uncertainties and benchmark/experimental validation.
8. Final optional printed-parts mode using Bambu slice data after standard analysis works.

Cross-cutting tasks include English/Japanese interfaces and documents, the live board, regression APIs, cancellation/diagnostics, performance limits, solver comparisons and report/export support. Exact ordering follows dependencies and feasibility results, not engine names alone.

Completion requires input generation, execution, result reading and convergence diagnostics—not merely installing an engine. Record reference values, justified tolerances, version, mesh and measured error. Test on Pages; native-only success is insufficient. Identify missing properties, unsupported models, lost regions, poor meshes and failed/unconverged runs.
