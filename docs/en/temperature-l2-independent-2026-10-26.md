# Independent temperature L2 projection audit

[日本語](../temperature-l2-independent-2026-10-26.md)

Owner `fe30a121716735bc1ca217b674aaf7cafa339205` is fixed. A non-affine center-one/corners-zero four-triangle fan is projected onto two triangles sharing diagonal AC. Independent exact formulas are `M=(A/24)[[4,1,2,1],[1,2,1,0],[2,1,4,1],[1,0,1,2]]` and `b=A[1/8,1/24,1/8,1/24]`. The solution is `[.5,0,.5,0]`, with integral A/3. This distinguishes consistent projection from zero point sampling and lumped values `[.375,.25,.375,.25]`.

The tests compare M/b directly, then verify tenfold length and hundredfold area, translation and oblique-plane rotation, a 273.15 constant offset on a non-affine field, and m2 integrals. Re-derivation rejects self-rehashed mass, cross-load, conditioning and source/target-weight tampering. Three new plus ten owner tests passed: thirteen total, zero failures or skips. Both documentation checks passed. Source hashes are in the [evidence JSON](../evidence/2026-10-26-temperature-l2-independent.json). No source fix was needed.

This is limited to fully covered planar continuous-P1 scalar temperatures. It does not establish a coupled solve, measured calibration or positivity-preserving projection. Existing coverage and conditioning boundaries remain unchanged. Additional solver/GUI/codec runs and progress changes: zero.

Replay: `node --test tests/planar-temperature-operator-independent.test.mjs tests/planar-temperature-operator.test.mjs`.
