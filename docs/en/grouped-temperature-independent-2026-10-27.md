# Independent grouped temperature projection audit

[日本語](../grouped-temperature-independent-2026-10-27.md)

Source candidate `ba1844027c06e59f3d27294d4516a7c0ea4eb35c` required no fix. Each group retains existing full planar coverage and opposing-normal gates; M/T are scattered by global IDs before one global solve. Conditioning, capacity, plain snapshots and complete re-derivation on reload preserve self-rehash refusal.

The independent oracle uses unequal folded-facet areas .5/1mm². With `M=(1e-6/24)[[6,3,1,2],[3,6,1,2],[1,1,2,0],[2,2,0,4]]` and one center hat giving `b=(1e-6/18)[1,1,1,0]`, the temperature difference is `[1/9,1/9,5/9,-1/9]`. Fixed M/b formulas use no production integration/solve helper. Averaging local projections does not reproduce this result. A 20°C baseline integrates to 30e-6+1e-6/6; the 273.15 offset also conserves area-temperature.

Four regressions cover this oracle; an explicit shared-point DOF versus refused duplicate-ID contact; refused nonconforming partial-edge contact; and unused-coordinate revision binding with canonical field permutation. Two initial contact fixtures incorrectly reused IDs across source/target sides and were correctly refused by the existing planar gate; they were corrected to separate side IDs without relaxing contact assertions. Together with 16 owner tests, 20 passed with zero failures or skips. The [evidence JSON](../evidence/2026-10-27-grouped-temperature-independent.json) records source hashes and limitations.

This is a limited fully covered planar-group pure API, not surface inference, a coupled solver, GUI or calibration. Area-temperature conservation is not energy conservation. Additional solver/GUI/codec runs: zero. Replay: `node --test tests/grouped-temperature-operator-independent.test.mjs tests/grouped-temperature-operator.test.mjs`.
