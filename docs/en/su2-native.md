# Native SU2 external-flow introduction

[日本語](../su2-native.md)

2026-10-15. The experimental adapter is `scripts/su2-native.mjs`. It is not registered in the browser solver, GUI or MCP. This is native execution, separate from existing WASM, and not a finished browser-only capability.

Official SU2 v8.5.0 Windows OpenMP starts and runs the official steady incompressible cylinder case. With the official 5000-iteration limit it stops at iteration 105 with log10 pressure residual -10.0074 and produces VTU fields. This establishes execution, not independent physical validation or cow analysis. The example's density 998.2 kg/m³, viscosity 0.000798 Pa·s and speed 8e-6 m/s must not be reused as cow airflow conditions.

Source: https://github.com/su2code/SU2/releases/tag/v8.5.0 . GitHub reports SHA-256 `4466fe21aedb5e0bad57afd45f829acbdec6ec79fe8c3f8954ddea06a4b4bc11` for `SU2-v8.5.0-win64-omp.zip`; extract its nested win64-omp.zip. Verify the hash. No system PATH or service changes. Retain SU2 licenses/notices; product redistribution review remains pending.

The adapter requires explicit properties, velocity, metre-based SU2 mesh, wall/farfield markers, iteration limit and residual target. It writes only a new job directory and launches without a shell using one thread. It exposes intermediate CSV residuals, input/mesh identity and final VTU/CSV hashes. Cancellation/timeouts await process close. Pressure residual achievement, successful execution and physical accuracy are distinct; results remain provisional.

Remaining work: independent references and balance/convergence checks; 3D/boundary-layer meshing; turbulence/unsteadiness at the target Reynolds numbers; VTU conversion; shared jobs, MCP and browser connectivity; storage/views/exports; distributed Skill and examples. Run the cow only after integration. WASM porting is not a prerequisite.

Official configuration: https://github.com/su2code/SU2/blob/v8.5.0/TestCases/incomp_navierstokes/cylinder/incomp_cylinder.cfg . Mesh: https://github.com/su2code/TestCases/tree/master/incomp_navierstokes/cylinder . Pinning the mesh commit/hash in a reproducible setup script remains pending.

Adapter proof: explicit CFL 100 and three multigrid levels reached pressure log10 residual -6.00649 at iteration 56. Real cancellation and timeout both awaited process close. These numerical settings differ from the official example. Evidence: [native adapter record](../evidence/2026-10-15-su2-native.json). Opt-in Windows setup: `node scripts/setup-su2.mjs`; no automatic download at import.
