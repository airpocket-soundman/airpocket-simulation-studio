# Experimental native URANS connection

[日本語](../su2-urans.md)

Stacked on the unmerged native SU2 PR #7. This is native CPU execution, not browser WASM/WebGPU CFD.

Use startup-approved `kind: unsteady-incompressible-rans-sa`, explicit `timeStepSeconds`, `timeSteps`, `outputEvery`; `maxIterations` is the inner iteration limit per physical step. Uniform initial flow, second-order dual time stepping, SA standard wall function and dimensional SI fields. No restart from a steady solution.

Limits: time step >0..1 s, 2..200 steps, <=500 inner iterations, positive integer output interval, <=41 saved frames, <=256 MB registered artifacts, 900 s host timeout. Artifact size is checked after execution, not an active disk quota.

API adds `GET /jobs/{id}/frames/{index}` for completed, settled jobs. Browser API adds `getFrame(index, jobId)` and `showFrame(index, jobId)`, with a selector and playback toggle. Playback pacing is presentation time. MCP `studio_native_flow_result` accepts an optional zero-based `frame`; default output includes the manifest, field pages remain <=200 entries. Frame reads verify registered VTU byte sizes/SHA before parsing; no separate JSON response hash is supplied. Existing final-result JSON integrity checks remain.

The cow smoke test ran 6 steps at 0.02 s, 12 inner iterations: SU2-reported times 0..0.10 s. Direct and hosted VTU/history hashes match. Real Studio main-page connection/frame display/capture and MCP frame paging were exercised. See `docs/evidence/2026-10-15-cow-urans-smoke.json`. The 40-inner-iteration pilot was terminated at 180 s, with nine saved frames.

This is unvalidated startup, not developed wake dynamics: wall warnings and unresolved residuals remain. `numericallyConverged` and `allTimeStepsConverged` remain false for transient runs until all-step convergence certification exists. Mesh, time-step, inner-convergence and duration studies remain acceptance requirements. The GIF is an offline rendering of saved physical frames, not a validated turbulence animation.

Not implemented: live in-progress field access, streamlines/vorticity/reverse-flow-specific views, browser MP4/GIF export, validated vortex shedding or GPU CFD.

Primary configuration reference: https://github.com/su2code/SU2/blob/v8.5.0/config_template.cfg

## Inner-iteration and wall-Newton sensitivity (2026-10-15)

Same cow/mesh/dt=0.02 s, six steps: increasing inner budget 12→60 changes final pressure residual −2.919→−5.392 and worst velocity-component residual −2.176→−3.680. Velocity target −5 is unmet; final affected wall points 215→220. On 5681 nodes within x=[−1.5,1.8], y=[−0.7,0.7], z=[0,2] metres, pressure RMS difference is 1.450 Pa and vector-velocity RMS difference 0.295 m/s. These are unweighted nodal differences, not error against a known solution.

Wall Newton max=1000 with relaxation 0.2 leaves 1210 affected points; relaxation 0.5 leaves 233. Neither removes warnings. These trials are not recommended or new defaults. The official tutorial identifies these as numerical options, not guaranteed remedies: https://su2code.github.io/tutorials/Inc_Turbulent_Bend/

Optional startup-approved `wallModelNumerics: {maximumIterations, relaxationFactor}` accepts integer 200..2000 and finite 0.05..1, SA only. Capabilities declares ranges; unknown keys/invalid values are refused. No change to physical wall treatment or convergence tolerance. Prioritize near-wall mesh/treatment assessment next; half-time-step, mesh independence and developed wake validation remain unperformed. Evidence: `docs/evidence/2026-10-15-cow-urans-sensitivity.json` and comparison PNGs.

## Near-wall mesh and treatment experiments (2026-10-15)

The cow STEP is unchanged. Experimental native Gmsh 4.14.1 scripts add locally refined horn junctions and tetrahedralized normal layers. Default smoothed normals failed local direction checks. The final recipe explicitly supplies a vector normal field constrained to point outward against every incident wall-face normal: first layer 3 micrometres, 10 layers, ratio 1.6, total about 0.545 mm. It is a fixed cow recipe, not general STEP auto-meshing or a new browser backend. Source STEP is not bundled; its SHA is retained in evidence.

Run `scripts/experimental/mesh-cow-boundary-layer.py --step ... --output-directory ...`, then `scripts/experimental/check-cow-layer-direction.py --step ... --mesh-directory ...`. Both accept `--gmsh-python-path` for a local runtime directory; no automatic installation. The mesher requires Gmsh 4.14.1 and refuses nonpositive element Jacobians; the separate checker refuses nonunique/inward wall adjacency. Checking CAD point-inside alone confounds curved-surface chord sag with layer direction, so the final direction check orients discrete wall-plane normals using signed OCC normals. This is not full volume-intersection or mesh-independence certification.

New explicit approved-input options: `wallTreatment: resolved-no-slip` (SA without wall functions), `spatialOrder: 1|2`, and `gradientMethod: GREEN_GAUSS|WEIGHTED_LEAST_SQUARES`. Existing defaults remain unchanged. The startup trials use first order and weighted least squares, not validated second-order dynamics. Preserve `SU2_WALL_RESOLUTION_UNVERIFIED`; removing wall functions does not certify wall resolution. Solver-reported divergence becomes structured `SU2_NUMERICAL_DIVERGENCE`, including repair suggestions in API/MCP job errors.

`summary.wallYPlus` adds dimensionless range/median/p95/counts above 1/5. MCP result `field: yPlus` pages surface values, defaults domain to surface, and refuses volume. GUI field selection remains pressure/speed; y+ comparison PNG is an offline diagnostic rendering of saved VTUs.

Two-step startup (SU2 times 0..0.02 s), CFL 0.1 and 12 inner iterations passes without divergence at both 30 and 3 micrometres. Instantaneous y+ maximum changes about 3.08→0.88. These unconverged startup diagnostics do not prove wall resolution later in developed flow. Outer-layer/wake resolution, temporal/second-order accuracy, all-step convergence and mesh independence remain unverified.

Reference: https://gmsh.info/doc/texinfo/#gmsh_002fmodel_002fgeo_002fextrudeBoundaryLayer

Follow-up: same 3-micrometre mesh with CFL 5 and 60 inner iterations exits successfully but gives peak speed about 56.9 m/s and volume pressure about −7362..4309 Pa. Reject this trial for the 5 m/s cow case; residual reduction and low y+ do not establish acceptable fields. CFL 0.1/12-inner startup has peak speed about 5.75 m/s but remains unconverged. Nominal first-layer size is extrusion displacement; normal spacing is smaller at creases.

Provenance audit: inherited prose in provenance.mesh retained old layer/CFL details. Actual mesh SHA and typed config were verified, with per-run corrections in docs/evidence/2026-10-15-cow-wall-resolution.json. Frozen input/config/VTU were not rewritten. Future case authors must derive mesh provenance from metadata/SHA rather than inheriting stale prose.
