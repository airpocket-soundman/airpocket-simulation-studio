# Parallel development progress and remaining conditions, 2026-11-07

[日本語](../development-2026-11-07.md)

PR251 was merged into main and its publication workflow passed. The next implementations and independent reviews use separate work areas, preserving existing data and historical failed logs.

| Area | Scope completed in this batch | Remaining conditions |
| --- | --- | --- |
| Holdout prediction | Raw-hash-bound saved CLI, formal stdio MCP, independent unit conversion and error oracles | Measured calibration, verified physical independence, material application |
| SLS to Prony material point | Explicit bulk modulus, shear/time conversion, finite-ramp and temporal convergence, saved execution | Not exact finite-strain reproduction; measured comparison and structural execution remain open |
| Tangential fluid/plate coupling | Actual channel solver with time-averaged force and midpoint plate, independent work/dissipation/momentum verification, saved execution | Normal pressure/ALE/curved/nonlinear and GUI routes remain open |
| Tet10 saved analysis jobs | Explicit order2, worker/process/formal MCP, full quadratic nodes and Gauss data, closed-form reference | Restricted single box and whole-face conditions; general geometry, comparison, views and probes unsupported |

Saved execution retains source/configuration versions, units, method, limits and artifact hashes. Cancellation and deadlines await actual owned worker termination; incomplete artifacts are not published. Worker output cannot contaminate CLI/MCP JSON and existing files are preserved. These are software execution and verification features, not fabricated measurements or calibration records.

The197-item board remains released159/building34/checking4/queued0, with38 open items. Bounded increments do not complete their parent tasks. P5B still needs common native-result comparison and design-loop acceptance. PRINTMEASURE1/2/3, PRINT2 and FINITEVISCO1 retain their existing physical-machine/slicing/measurement/calibration requirements. Other parent tasks retain general-geometry, physics, performance or real-connection software and verification work; the38 open items are not all external-data blockers.

Environment, failures, fixes and original logs are recorded separately under `docs/evidence/2026-11-07-*`. The corresponding PR's immutable-head CI determines final integrated verification and publication. Synthetic agreement never establishes physical accuracy or calibration.

## Third-wave additions

A separate PR adds dedicated saved Tet10 point queries, tolerance-based FSI replay comparison, and CSV/JSON/SVG pages of saved SLS/Prony reports. Independent reviews fixed sparse-array, length-snapshot and integer-count gaps and rechecked equations and file/publication boundaries. Actual browser rendering verifies a synthetic50/81-row page with31unshown rows. Standard Tet4 probe/case/view/compare, calibration and broader geometry/physics acceptance remain separate. Local `npm run check:mcp` now includes correspondence and GUI classifications.
