# Explicit prepared Tet4 boundary selections

[日本語](../native-tet4-boundary-selection.md)

Work order62, base `3dd4281`. `createNativeTet4RecordFromBoundarySelections` in `scripts/native-tet4-boundary-selection.mjs` converts caller-selected boundary node sets and explicit nodal forces on an already-prepared Tet4 mesh into the existing record. This is not CAD condition transfer or a product backend.

Exact input fields are `input` (saved project), `mesh` (mm coordinates and Tet4), `fixedNodeSets` and `nodalLoads`. Fixed sets use `{id,nodeIds}`, loads `{nodeId,forceN:[fx,fy,fz]}`. Only full translational fixation and global nodal forces in N are accepted. Traction/pressure integration, local frames, partial supports, gravity and other material models are never inferred; unsupported fields are rejected.

Duplicate set IDs/nodes, intersecting sets, fixed/loaded intersections, repeated loaded nodes, nonmember IDs, interior nodes, nonfinite and oversized inputs are rejected. Boundary membership comes from external triangles with incidence1 after authoritative Tet4 validation; incidence above2 is also refused. Existing `createNativeTet4Record` retains material-key, mesh orientation/connectivity, rigid-body support and force-range checks. No supports or forces are invented.

Input is snapshotted before any hash await and never mutated, including failures. Fixed IDs are sorted. For the translated20×15×60 mm bar at±75/0 N, records, hashes and wire match the original fixtures exactly. The current-source WASM CLI solves the same records; authoritative verification checks displacement, reactions, force and moment balance against analytical75 N displacement7.5e-6 m. A false reaction couple preserving net force is rejected.

No Windows host executable is available, so host checks remain unexecuted. WASM success does not establish host success. New selection tests are added to the mandatory list in `scripts/check-native-proof.mjs`. Existing Linux `native-proof.yml` builds actual host/WASM executables and invokes this checker, thereby running selected-record host tests there. Linux results are not yet available. No SDK was downloaded; this run reused the current-source WASM linked from existing cache in the preceding audit.

Run `node --test tests/native-tet4-boundary-selection.test.mjs tests/native-tet4-contract.test.mjs`, setting `AIRPOCKET_NATIVE_PROOF_WASM` and/or `AIRPOCKET_NATIVE_PROOF` to actual binaries. Local result:11 passed,3 host-only skipped,0 failed. Types and diff checks passed. Measurements, automatic CAD transfer, face loads, product backend and overall P6 remain incomplete.
