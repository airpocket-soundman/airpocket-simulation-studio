# Experimental native SU2 flow: MCP and API

Use only a checkout containing `scripts/studio-native-flow-mcp.mjs`. Discover the tools actually registered in this conversation first; implementation in the repository does not activate tools in an already-running host. The native path uses a local SU2 process, not WASM or Stokes. It currently runs a startup-approved, fixed mesh/input case. Read `docs/su2-native.md` for the tested cow and physical limitations.

## Start/configure

An approved local case JSON contains `origin` (exact Studio browser origin), absolute `executable`, `meshPath`, `outputRoot`, and `approvedInput`. Do not guess the user's wind/material/geometry or change them to get convergence. Inspect the configured values before any solve. Native SU2 must already be prepared; MCP startup never downloads/installs a solver.

- Existing full MCP plus native tools: `node <checkout>/scripts/studio-mcp.mjs --native-flow-config=<absolute approved-case.json>`.
- Native-only MCP: `node <checkout>/scripts/studio-native-flow-mcp.mjs <absolute approved-case.json>`.
- No flag: existing MCP operation is unchanged and no native tools are exposed. Restart/reconfigure the client deliberately; do not claim the current conversation has been re-registered.

Both modes use stdio. Keep the same process alive for the job lifetime. EOF/shutdown cancels active native jobs and awaits settlement. Restart recovery is unsupported, though output files remain. A direct Node fallback may import `createNativeFlowMcp` and retain the returned instance; do not create a fresh instance for each status call.

## Workflow

1. `studio_native_flow_capabilities({})`: inspect exact approved input, units and limits. This does not validate geometry, mesh, turbulence assumptions or physical accuracy. Ask the user about missing physical intent instead of silently changing it. The host refuses client-supplied paths/physics.
2. `studio_native_flow_start({requestId})`: use a unique short request ID and retain `jobId`. An identical retained ID returns the same job. After a timeout inspect/retry the same ID; do not create a second physical calculation by inventing a new ID.
3. `studio_native_flow_status({jobId})`: poll appropriately; latestObservation carries provisional solver residuals. `completed` means execution/publication finished, not full numerical convergence or physical validity. Inspect `metadata.residualChecks`, `numericallyConverged`, `diagnostics`, `physicalValidationComplete` and `executionSettled`.
4. `studio_native_flow_result({jobId})`: retrieve compact summary and diagnostics first. Do not download all arrays unless needed. For pages use `field: "pressure"|"velocity"|"coordinates"|"connectivity"|"offsets"|"types"`, optional `domain:"volume"|"surface"`, `offset`, `limit` (default 50, maximum 200 entries). Follow `nextOffset` until null. Velocity/coordinates return three components per entry, so offsets count nodes, not scalar components. Responses are capped at 64 KiB.
5. Coordinates are **m**, gauge pressure **Pa**, velocity **m/s**; connectivity uses zero-based point indices. Existing Studio project geometry/probes often use mm and are a different contract. Native fields are not accepted by existing `studio_probe`/case archives. The native result reader returns retained memory and publication hashes, not revalidation of current disk bytes.
6. `studio_native_flow_cancel({jobId})`: request cancellation and poll until settled. `studio_native_flow_release({jobId})`: only release after terminal settlement and necessary retrieval. It drops memory/ID registration, not files. Released request IDs can execute again; do not retry a released start unintentionally.

## Browser and presentation boundary

`studio_native_flow_connection({})` returns the same temporary host's endpoint/code and permitted browser origin. Keep the code private, out of URLs, commits and public reports. Giving connection information does not connect a browser or grant existing browser-MCP scopes. The user can enter it in Studio's native-flow panel. Public HTTPS-to-loopback is unverified.

Browser API `nativeFlowApi` supports explicit connect, start/status/cancel/release/result, view field selection and capture. The seven native MCP tools cover computation/data; native view/capture are not yet exposed as MCP tools. Do not invent view tools or claim MCP start automatically displays a result. Existing browser-MCP view operations address standard results, not this separate native panel.

## Repair and interpretation

- `SU2_WALL_MODEL_NOT_CONVERGED`: preserve affected-point counts and suggestions. Inspect wall y+, refine near-wall mesh/change to a validated wall treatment, then repeat convergence checks. Never remove warnings to report success.
- Pressure-only termination is not complete convergence. The initial cow case met the pressure stop criterion but failed other residual targets and wall treatment; classify it as provisional and not quantitatively validated.
- `NATIVE_FLOW_RESULT_UNAVAILABLE`: get status; wait for successful terminal settlement before reading. `NATIVE_FLOW_PAGE`: use returned counts and valid bounds. `NATIVE_FLOW_REQUEST_REFUSED`: inspect state/input; never broaden paths or alter approved physics silently.
- Compare input revisions, mesh and complete fields/hashes for reproduction. Exact direct/Studio/MCP agreement establishes path reproducibility, not accuracy or drag prediction.
