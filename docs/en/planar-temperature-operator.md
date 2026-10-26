# Planar P1 temperature L2 projection

[日本語](../planar-temperature-operator.md) · [P1 heat flux operator](planar-p1-heat-operator.md)

The pure API in `planar-temperature-operator.js` projects nodal scalar temperatures between fully covered planar interfaces. `solverConnected:false` remains explicit. No GUI, thermal-contact solve, iterative coupled solver, measurement or calibration is added.

The existing P1 overlap operator supplies `T_ji=∫N_Bj N_Ai dA` and its unchanged geometry validation. Assemble the target consistent mass with each triangle's `A/12 [[2,1,1],[1,2,1],[1,1,2]]`. Convert mm² to m² by 1e-6 and normalize both matrices by covered area. Cholesky compilation gives `R=M_B^-1 T`; application computes `θ_B=R θ_A` and checks the matrix residual. Scalar temperature never changes sign with opposing normals. Existing flux API, 4096-node/512-face limits, full coverage, opposing normals and same-side overlap rejection remain unchanged.

Only this new API limits each side to 128 active nodes (16384 dense coefficients), JSON to 1MiB, graphs to 200000 values/depth20. Compute κ∞ of the normalized mass using triangular solves for its inverse; reject values above 1e10. Reject nonpositive pivots, nonfinite arithmetic and overflow, without regularization/fallback. Compilation residual is bounded by 1e-12×max(1,|Tij|); application residual by 1e-10×max(1,|θ|), and integral difference by this scale times covered area.

Fields use `{units:'degC'|'K',values:[{nodeId,value}]}` with exactly one value per active source node. Reject mixed row units, implicit conversions, unknown/duplicate nodes and input temperatures below absolute zero. For arithmetic headroom, require absolute temperature magnitude no greater than `Number.MAX_VALUE/(128*1e10)`. L2 projection does not guarantee source min/max bounds or positivity. At the projected absolute-zero bound only 1e-10 rounding error is permitted; no clamp or physical validity claim for tiny negative kelvin values is made. Greater excursions are refused.

The returned area-temperature integrals have units degC*m2 or K*m2. Their conservation is **not energy conservation**: no heat capacity, density, volume or time is supplied. Tests verify constants, global affine fields and the Celsius-to-kelvin constant offset. Reverse projection is generally not an inverse.

Build, load and apply snapshot plain records/dense arrays before their first await, without executing accessors. A private WeakSet restricts apply/serialize to issued operators. Loading rederives every T/M/factor/R/revision from geometry and compares the entire canonical record. Self-rehashed coefficient changes are rejected. rawIdentity is the input JSON UTF8 SHA, not authentication.

[Evidence](../evidence/2026-10-26-planar-temperature-operator.json) uses independent fixed oracles: crossing-diagonal corner hat→[0,.25,1,.25], and fan-center hat→[.5,0,.5,0]. The latter differs from all-zero point sampling and lumped [.375,.25,.375,.25]. No solver, GUI, codec or SDK is launched. This is limited synthetic verification, not completion of COUPLE3 or a product-accuracy claim.
