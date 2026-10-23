# Persistable planar heat-flux transfer operator

[日本語](../planar-heat-operator.md)

Limited COUPLE3 follow-up, base `8c902f3`. `src/planar-heat-operator.js` compiles existing nonmatching planar integration into a version1 operator that can be saved, reloaded and reapplied. It does not implement coupled temperature/flow iteration, arbitrary source nodal fields, material identification, GUI/API integration or experimental validation.

Geometry is exactly `{units:'mm',mesh:{nodes},sourceFaces,targetFaces}`. Faces are `{nodes:[a,b,c]}`. Sides require separate node sets and opposite outward normals. Full coincident planar coverage is required. Partial coverage, gaps, overlap, same-facing normals, nonplanarity, invalid units and unsupported fields are rejected. Existing plane tolerance1e-6 mm and relative coverage tolerance1e-6 are fixed and cannot be relaxed through saved records.

`buildPlanarHeatTransferOperator(geometry)` integrates four global basis fields `1,x_m,y_m,z_m` using the existing integrator, producing four coefficients for every target node and four source-total coefficients. Supported flux is a constant or global affine `q=base+gradient·position_m`, with baseW/m² and gradientW/m³. Output is nodal heat loadW, not flux density. No quadratic field, local frame or missing interpolation is inferred.

The record carries schemaVersion, kind, units, basis, tolerances, area, separate geometry revisions, coefficients and operatorRevision. Each side's SHA-256 identity includes selected face order/winding, node IDs and referenced coordinates; unrelated unused nodes are excluded. operatorRevision hashes canonical JSON excluding itself. Hashes identify content, not authorship or signatures.

`serializePlanarHeatTransferOperator(op)` saves a validated deeply frozen operator as canonical JSON. `loadPlanarHeatTransferOperator(raw,geometry)` checks bounds/hash/version and rederives coefficients from the supplied geometry before comparing the entire record. Rehashing tampered coefficients does not bypass validation. Arbitrary JSON-parsed objects cannot be applied; callers must build or load first. Rebuilding happens once on reload; subsequent applications use only coefficient multiplication and accumulation, without overlap integration.

`applyPlanarHeatTransferOperator(op,geometry,flux)` checks both geometry identities on every use, rejecting stale interfaces. Inputs are snapshotted before hash awaits. Source-outward plus target-outward heat must balance within absolute1e-18 W plus relative1e-12 times the sum of absolute coefficient contributions. Zero totals and sign-changing fields require neither relative division by zero nor forced normalization. Nonfinite intermediate arithmetic is rejected.

Hard bounds:4,096 nodes,512 faces per side, absolute coordinates1e6 mm, geometry and saved JSON each1 MiB. Before enumeration, whole-interface source/target bounding boxes must match within tolerance. This prevents equal-area but extremely elongated mismatched shapes from forcing enormous legacy overlap-grid enumeration. Saved records cannot raise limits.

Synthetic1 mm² with mean2 W/m² is transferred across different partitions. Every target node matches independent exact P1 integration `A(2qi+qj+qk)/12`, with total2e-6 W. Tests cover save/reload, rigid transforms, sign/zero total, geometry changes, rehashed tampering, capacity and overflow.17 focused tests, declaration/actual-module type checks, bilingual documentation and diff checks pass. [Evidence](../evidence/2026-10-23-couple3-persisted-operator.json) retains actual records and nodal loads. Browser, complete coupling and experimental acceptance remain unverified.
