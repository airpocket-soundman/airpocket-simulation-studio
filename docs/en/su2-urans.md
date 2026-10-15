# Experimental native URANS connection

Stacked on the unmerged native SU2 PR #7. This is native CPU execution, not browser WASM/WebGPU CFD.

Use startup-approved `kind: unsteady-incompressible-rans-sa`, explicit `timeStepSeconds`, `timeSteps`, `outputEvery`; `maxIterations` is the inner iteration limit per physical step. Uniform initial flow, second-order dual time stepping, SA standard wall function and dimensional SI fields. No restart from a steady solution.

Limits: time step >0..1 s, 2..200 steps, <=500 inner iterations, positive integer output interval, <=41 saved frames, <=256 MB registered artifacts, 900 s host timeout. Artifact size is checked after execution, not an active disk quota.

API adds `GET /jobs/{id}/frames/{index}` for completed, settled jobs. Browser API adds `getFrame(index, jobId)` and `showFrame(index, jobId)`, with a selector and playback toggle. Playback pacing is presentation time. MCP `studio_native_flow_result` accepts an optional zero-based `frame`; default output includes the manifest, field pages remain <=200 entries. Frame reads verify registered VTU byte sizes/SHA before parsing; no separate JSON response hash is supplied. Existing final-result JSON integrity checks remain.

The cow smoke test ran 6 steps at 0.02 s, 12 inner iterations: SU2-reported times 0..0.10 s. Direct and hosted VTU/history hashes match. Real Studio main-page connection/frame display/capture and MCP frame paging were exercised. See `docs/evidence/2026-10-15-cow-urans-smoke.json`. The 40-inner-iteration pilot was terminated at 180 s, with nine saved frames.

This is unvalidated startup, not developed wake dynamics: wall warnings and unresolved residuals remain. `numericallyConverged` and `allTimeStepsConverged` remain false for transient runs until all-step convergence certification exists. Mesh, time-step, inner-convergence and duration studies remain acceptance requirements. The GIF is an offline rendering of saved physical frames, not a validated turbulence animation.

Not implemented: live in-progress field access, streamlines/vorticity/reverse-flow-specific views, browser MP4/GIF export, validated vortex shedding or GPU CFD.

Primary configuration reference: https://github.com/su2code/SU2/blob/v8.5.0/config_template.cfg
