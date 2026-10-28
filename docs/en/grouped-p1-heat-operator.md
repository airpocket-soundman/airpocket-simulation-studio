# Explicit grouped P1 heat-flux transfer

[日本語](../grouped-p1-heat-operator.md) · [Grouped temperature L2](grouped-temperature-operator.md) · [Single-plane P1 flux](planar-p1-heat-operator.md)

`buildGroupedP1HeatTransferOperator` compiles an explicitly partitioned folded interface. `applyGroupedP1HeatTransferOperator` accepts `{units:'W/m2',groups:[{groupId,values:[{nodeId,value}]}]}`. Each group has its own continuous P1 source field. A shared global source node may have different outward normal flux in different groups; these values are not averaged. Each group's consistent cross integral `Tji=integral(NBj NAi)dA` is evaluated by the existing planar operator. Target nodal loads are summed by global node ID, including crease nodes.

Coordinates are mm; coefficients and areas are m². Positive source-outward flux gives positive applied target heat rate W; target-outward rate is its negative. `sourceOutwardW + targetOutwardW` is checked with absolute-product scaling, including zero-net mixed-sign fields. This is heat-rate conservation, not energy conservation, temperature projection, material identification or a coupled solver. Every result retains `solverConnected:false`.

The geometry contract is shared with [grouped temperature](grouped-temperature-operator.md): at most8 uniquely named explicit coplanar groups, each source/target face assigned exactly once, full coverage and opposing normals within every pair. Global IDs preserve shared nodes; coincident coordinates with different IDs are not welded. Cross-group intersection/contact checks retain the existing tolerance and support shared global vertices/edges only. Smooth curved interfaces, partial overlap and arbitrary nonmanifold intersections are outside this API.

Budgets:4096 mesh nodes,512 faces/side,128 active global nodes/side,8 groups,16384 retained coefficient terms,1024 group-local source values,1MiB serialized JSON. IDs match `[A-Za-z0-9_-]{1,64}`. Plain non-accessor dense records only; finite arithmetic is required. Flux integration does not inherit temperature matrix conditioning requirements. Each local operator is bounded before retention; the combined term count is checked before retaining another group. Geometry and flux snapshots precede asynchronous hashing.

Serialize only issued operators. Reload rebuilds every planar coefficient, assignment, area, weight and identity from supplied geometry; a self-rehashed changed record is rejected. Raw identity hashes the original input JSON text (including whitespace) through the repository hash contract; it is not authentication. All coordinates, including unused coordinates, belong to geometry identity. Existing planar flux APIs and grouped-temperature serialization remain unchanged; two pre-extraction temperature goldens enforce byte identity.

Independent tests use a folded unit pair: a6W/m² interior hat contributes1microW, a -2W/m² second facet contributes -1microW, leaving nonzero signed global nodal loads despite zero total. Unequal areas, closed-form affine3D loads, sign/scale/rotation, load tampering and exact capacity boundaries are covered. No real solver, measurement, calibration, UI or codec run is claimed. Evidence: [verification](../evidence/2026-10-27-grouped-p1-flux.json).



## Integration-candidate verification (2026-10-27)

Frozen root source `1b19f750640dca66644c43a78f869ff399fc83f9` integrates owner ec46a7b and the [four independent regressions](grouped-p1-heat-independent-audit.md). Root94focused tests already include those4; they are not added again. The29public declarations passed. The [integration record](../evidence/2026-10-27-grouped-p1-heat-integration.json) pins the source and build/local stages. The owner's initial documentation-location failure remains preserved rather than overwritten.

This feature integrates **group-local source-outward P1 flux** and scattersW to shared global target nodes. Old201 temperature L2 instead assembles global consistent mass/cross matrices and solves temperatures once. Averaging group flux or applying a temperature inverse is not equivalent. Checks retain old201 serialized-byte/result goldens and existing planar-path compatibility.

The independent two-unit-square fixture retains[1/12,-1/12,3/4,1/4,-2/3,-1/3]microW at six shared/global target nodes despite zero total. Positive source-outward rate means positive target applied load and negative target-outward rate. Conservation here concerns heat rateW, not material energyJ, temperature-dependent properties, a conjugate solver, general smooth/partial interfaces, GUI, measured calibration, COUPLE3 completion or publication. solverConnected:false remains explicit.


The pinned source built in3.89s and passed28local published-equivalent checks in69010.4474ms. Original focused/build/local logs and local-report bytes were preserved with copyFile and compared against staged Git bytes/SHA under scoped -text attributes. Recording adds zero solver/GUI/codec/export runs.
