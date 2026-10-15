# Native SU2 external-flow integration

[日本語](../su2-native.md)

2026-10-15. Experimental native adapter, fixed-case loopback host, Studio panel and browser API are implemented. This is separate from WASM and is not integrated into the public release or ordinary solver selection. Dedicated tools can be added to existing MCP with explicit startup configuration. Arbitrary CAD meshing is not automatic.

## Cow direct/Studio equivalence

User-approved conditions: representative 20 C air, 5 m/s head-to-tail, no ground. Assumed density 1.204 kg/m³ and viscosity 1.81e-5 Pa·s. Steady incompressible RANS, SA, standard wall function and SU2 FREESTREAM_NU_FACTOR=10. Prefer freestreamNuFactor; the initial test's turbulentViscosityRatio is a compatible legacy name for this modified-kinematic-viscosity/molecular-viscosity ratio, not the eddy-viscosity ratio itself.

Gmsh WASM 0.3.0 normalized STEP coordinates to metres and generated 7,716 points, 37,455 tetrahedra and 4,262 cow surface triangles, without prism layers. After direct execution, nativeFlowApi.startJob in the actual Studio browser page launched a separate process with identical input/mesh/settings. Both reached iteration 184. All 7,716 pressures and 23,148 velocity components, mesh/surface pressure, VTU and history hashes matched exactly. [Evidence](../evidence/2026-10-15-cow-flow-equivalence.json), [comparison](../evidence/2026-10-15-cow-flow-comparison.png). Headless Chrome was used without desktop interaction.

This proves path reproducibility, not accuracy. Pressure log10 residual -5 alone stopped the solver; velocity/turbulence targets were not all met. Wall-function y+ failed at 116 points in the final iteration; maximum y+ was approximately 1706. The adapter distinguishes pressure stopping from complete numerical convergence and returns SU2_WALL_MODEL_NOT_CONVERGED with repair candidates. Do not use this result for quantitative drag/local-pressure predictions.

## Local setup

1. Opt in on Windows x64 with node scripts/setup-su2.mjs. Imports do not download code or modify system PATH.
2. Prepare a checked SU2 mesh and approved input. The initial mesh remains in the working area's .qa/cow-flow/cow.su2; see evidence.input. Meshing is currently a separate preparation step.
3. Create a local JSON with origin, executable, meshPath, outputRoot and approvedInput. Paths must be absolute. Run node scripts/native-flow-host.mjs approved-case.json. Origin must exactly match Studio.
4. In Studio's experimental native external-flow panel enter endpoint/code, inspect conditions and run. Only local development-server connectivity is verified; public HTTPS is unverified.

The host binds to loopback and checks Origin/Host/Bearer. It accepts only the configured mesh and approved input, never client-selected filesystem paths. One active/four retained jobs, cancellation/settlement and result SHA-256 checking are provided. Authentication is separate from existing browser MCP permissions.

## APIs and limitations

window.nativeFlowApi exposes configure/connect/startJob/getJob/cancelJob/getResult/showResult/setField/capture/getDisplayedResult. startJob computes; showResult displays retrieved data. Pressure/velocity, a center slice and vectors, JSON and PNG exports are available. Results use the experimental panel format, not existing caseApi archives. Default MCP exposes no native tools; configured compute/data tools are listed below. Native view/capture still uses browser APIs.

Remaining: wall mesh/treatment, complete residual/balance/mesh convergence, independent accuracy checks, general meshing, unsteady/additional turbulence models, shared job/case/probe and view-MCP integration, public connectivity and distributed Skills. WASM porting is not a prerequisite.

## Pinned runtime and initial example

Official release: https://github.com/su2code/SU2/releases/tag/v8.5.0 . Windows OpenMP archive SHA-256: 4466fe21aedb5e0bad57afd45f829acbdec6ec79fe8c3f8954ddea06a4b4bc11. Retain licenses/notices; product redistribution review remains pending.

The earlier cylinder [record](../evidence/2026-10-15-su2-native.json) distinguishes the initial timeout, later numerical-settings success and cancellation. Its pressure criterion is not a physical-accuracy certification.

## Native MCP and Skill

Add native tools to the full server with node scripts/studio-mcp.mjs --native-flow-config=<absolute approved-case.json>, or run the native-only entry node scripts/studio-native-flow-mcp.mjs <approved-case.json>. Default startup remains unchanged. Updating source does not register tools into an already running client/conversation; deliberate registration/restart is separate.

Seven tools: studio_native_flow_capabilities, studio_native_flow_connection, studio_native_flow_start, studio_native_flow_status, studio_native_flow_result, studio_native_flow_cancel and studio_native_flow_release. Start is request-ID idempotent while retained; status exposes provisional observations, settlement and diagnostics. Result defaults to compact summary and supports <=200 entries/64 KiB. Coordinates are metres, gauge pressure Pa and velocity m/s; vector page offsets count nodes. Reads use registered memory, not fresh disk validation. Release drops retention without deleting files, and released IDs may execute again. Connection information does not grant existing browser-MCP scopes.

Real JSON-RPC stdio through the full MCP reran the cow in a separate process. All 7,716 pressures and 23,148 velocity components matched direct execution; 74 observations, idempotency, cancellation/settlement, premature-release refusal and retained warnings were verified. [MCP evidence](../evidence/2026-10-15-cow-flow-mcp.json). The task-specific Skill reference is skills/airpocket-studio/references/native-flow.md; distributed Skills and running MCP registrations are not automatically updated. Native view/capture via MCP remains pending.
