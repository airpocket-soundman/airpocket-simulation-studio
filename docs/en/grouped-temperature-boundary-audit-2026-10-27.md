# Grouped temperature contact/persistence boundary audit

[日本語](../grouped-temperature-boundary-audit-2026-10-27.md)

Fixed source `ba1844027c06e59f3d27294d4516a7c0ea4eb35c` was reviewed independently of the separate numerical integration/global-matrix audit. Scope: cross-group intersections/contacts, face assignment, snapshot limits and load rederivation. **No mandatory source fix was found.** Four independent explicit-geometry/persistence regressions were added without modifying product source. The [JSON](../evidence/2026-10-27-grouped-temperature-boundary-audit.json) distinguishes Git blob SHA1/SHA256 from the CRLF worktree hash.

Distinct-ID coplanar point/edge contacts, noncoplanar vertex-on-face and partial-edge contacts were refused. Exact shared-global-node/edge-only contact succeeded; sharing a vertex did not authorize an intersection extending into the face. Fixtures directly declare coordinates/IDs rather than calling production clipping/intersection functions as an oracle.

Duplicate/missing/out-of-range/unknown face assignments, changes to unused nodes, nonfinite/nonnumeric coordinates, excess node/face/group counts, sparse arrays and inherited records were refused. Nested getters were not invoked, and post-call input mutation did not alter the load snapshot. Self-rehashed changes to geometry/local-operator identities, group assignment, M/R coefficients and source IDs were rejected by complete rederivation. Raw-byte and depth overflow were also refused.

All four new tests passed with zero failures/skips. This is a bounded explicit-triangle audit under documented numerical tolerances, not a proof of general CAD classification, smooth-surface accuracy or coupled physics. No solver/GUI/codec/CI execution, publication claim or parent status promotion occurred.
