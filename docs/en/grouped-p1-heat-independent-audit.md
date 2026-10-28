# Independent audit of grouped P1 heat-flux transfer

[日本語](../grouped-p1-heat-independent-audit.md) · [API contract](grouped-p1-heat-operator.md)

Owner `ec46a7b439367ec250ccf1f47959686d084570b0` was reviewed read-only. Only four independent regressions and their record are added on this branch; production source is unchanged. Related checks include extraction compatibility and old201 serialized goldens. See [machine-readable record](../evidence/2026-10-27-grouped-p1-heat-independent.json).

The independent fixture has two unit squares XY/XZ sharing creaseAB. Each source square uses a four-triangle center fan; each target uses two diagonal triangles with distinct source/target global IDs. XY uses q=6h for center hat h, while XZ uses q=-2W/m², including different group-local values at shared source nodes. On the unit square, ∫Ntarget h=[1/8,1/24,1/8,1/24]; constant weights on the other face are[1/3,1/6,1/3,1/6]. Scattering onto six target nodes gives[1/12,-1/12,3/4,1/4,-2/3,-1/3]microW: zero total does not erase local loads.

For the independent affine test functionθ=1+2x+3y+4z, XY integrates to7 and XZ to-8microW·K, so its nodal-load inner product is-1microW·K. This is a heat-flux weak-form weighted functional, not physical work inJ or proof of a coupled solver/heat capacity. The mm²→m² factor is explicitly1e-6. Point interpolation or averaging shared group values cannot satisfy this nonmatching case.

Additional checks refuse duplicate-coordinate edges with distinct IDs and nonconforming midpoint T-junctions on both source and target. A2×2 coefficient perturbation preserves row/column sums and total constant flux; reload still refuses after recomputing local and global hashes. For q0=1,q1=3 it misallocates±2δ W to two nodes, showing why total conservation is insufficient. Reload snapshots caller geometry before its first await and retained coefficients are frozen.

Additional solver/GUI/codec/measurement/calibration execution is zero. This does not establish COUPLE3 completion, a coupled solver, general curved geometry, physical accuracy or publication. Numerical oracles use hand-integrated shape functions, not production coefficient helpers. Reproduce with `node --test tests/grouped-p1-heat-independent.test.mjs tests/grouped-p1-heat-operator.test.mjs tests/grouped-temperature-operator.test.mjs tests/grouped-temperature-operator-independent.test.mjs tests/grouped-temperature-boundary-audit.test.mjs tests/planar-p1-heat-operator.test.mjs tests/contracts-types.test.mjs tests/module-boundaries.test.mjs tests/docs.test.mjs`.
