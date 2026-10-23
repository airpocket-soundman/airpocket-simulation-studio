# Persisted planar P1 nodal heat-flux operator

[日本語](../planar-p1-heat-operator.md)

`src/planar-p1-heat-operator.js` adds the separate `planar-p1-heat-transfer` kind without changing the existing global-affine API/kind/serialization. It handles continuous source-nodal P1 flux on coincident planar interfaces with opposite outward normals and full coverage within existing tolerances. No curved/partial coverage,temperature transfer,thermal-fluid iterative solver,UI/API/MCP integration is added.

Geometry uses the existing `{units:'mm',mesh:{nodes},sourceFaces,targetFaces}` contract. Source and target IDs are distinct; triangle winding defines each outward normal. Compilation first reuses the existing affine builder's AABB, same-side overlap,per-face coverage,planarity and opposing-normal validation. Plane1e-6mm and relative coverage1e-6 remain unchanged. Gaps cannot cancel overlapping faces.

Flux input is `{units:'W/m2',values:[{nodeId,value},...]}`, exactly one finite value per used source node. Missing/duplicate/unknown IDs,nodal loads in W,global-affine objects and discontinuous per-face fields are refused. Values are sorted privately for semantic flux identity; caller objects remain unchanged.

The matrix is `T_ji=∫N_Bj N_Ai dA` in m²; target inward load is `b_j=Σ_i T_ji q_i` in W. Source weights are `w_i=∫N_Ai dA`, with sourceW=Σw_iq_i,targetW=Σb_j and targetOutwardW=−targetW. Both column and row partitions of unity are checked. Each common-refinement triangle uses the three-edge-midpoint quadratic-exact rule for the P1 product; no averaging or global-affine fit replaces it. mm² becomes m² exactly once via1e-6. Absolute1e-18+relative1e-12 checks use coefficient m² or result W as appropriate. Cancellation-dominated fields use absolute term magnitudes, never division by the net total. Tiny signed roundoff coefficients are not clamped; finite/barycentric/partition checks remain.

APIs are `buildPlanarP1HeatTransferOperator(geometry)`, `serializePlanarP1HeatTransferOperator(operator)`, `loadPlanarP1HeatTransferOperator(raw,geometry)` returning `{operator,source}`, and `applyPlanarP1HeatTransferOperator(operator,geometry,flux)`. Compiled records are deeply frozen and issued-object checked. Rows/terms are sorted by target/source ID. Persisted geometry revisions,weights,coefficients,units,kind/schema and operatorRevision are rederived from supplied geometry on load; a forged coefficient with a recomputed hash is still refused. The source descriptor carries raw UTF8 byte count/SHA256, not authentication,calibration or accuracy proof.

Geometry and field snapshots precede all hash awaits. Interface geometry identity binds used IDs/coordinates and ordered face lists; unrelated unused coordinates are not part of that identity. Flux identity binds normalized source IDs/values and units. Changed used geometry is refused at apply. Concurrent caller mutation cannot split identity from computation; failures preserve caller input and existing operators.

Budgets:4096 geometry nodes,512 faces per side,at most512² source-target pair visits,16384 unique sparse node pairs,1MiB per geometry/record,200000 values,depth20,coordinates within±1e6mm. The16385th sparse pair is refused before insertion. Final byte checks supplement bounded work, not replace it. Oversized/deep/nonfinite/accessor/sparse/subclass/unknown-field inputs and numerical overflow are refused.

[Independent evidence](../evidence/2026-10-23-planar-p1-heat-operator.json) checks all16 coefficients for crossing source A–C/target B–D square diagonals against a separately hand-integrated four-triangle refinement. Source q=[0,0,1,0] produces[1,5,5,5]/48×1e-6W,total1e-6/3W. A source center6/corners0 non-global-affine hat produces[.75,.25,.75,.25]×1e-6W,total2e-6W. The independent formula `∫fg=A/12[(Σf)(Σg)+Σf_i g_i]` uses neither production clipping nor barycentric helpers.

Mixed signs q=[1,0,−1,0] retain nonzero target loads[1/12,0,−1/12,0]×1e-6W at zero net heat. Tests also cover sign reversal,rotation/translation,old-affine agreement,persistence/rehashed tampering,mutation,capacity and runtime type fixtures. A128-face fan accepts4672 terms;a256-face fan reaches the sparse refusal. A4096-node/512-face conforming case succeeds. Exactly1MiB raw JSON succeeds and one additional byte is refused.

This is bounded synthetic planar-reference acceptance, not material identification,experimental calibration,general curved transfer,iterative coupling,publication or completion of the COUPLE3 parent.

The inherited geometry validator retains its1e-6 coverage tolerance, but P1 additionally requires row/column moment balance at1e-18+1e-12·scale. A geometry passing the looser coverage test can still be refused by the stricter P1 coefficient acceptance; no gap heat is invented.

Independent review reproduced apply accepting null,boolean or string coordinates on unused nodes while build refused them. The fix requires every coordinate to be explicitly numeric and finite before identity checks, including unused nodes. An independently constructed reverse transfer matches all16 coefficients of the transpose crossing matrix; flux entry order preserves revision and nodal loads. [Audit evidence](../evidence/2026-10-23-planar-p1-independent-audit.json).
