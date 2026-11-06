# Independent saved Tet10 point-query audit (2026-11-07)

[日本語](../tet10-native-query-independent-audit.md)

The [dedicated query](tet10-native-query.md) at `af24992` was audited read-only using only the existing39044-byte raw fixture. No FEM, worker, GUI or new physical solve was run. Three new independent regressions cover saved-structure refusals, an analytic quadratic field and same-content FD-path replacement.

A mandatory snapshot-contract gap was found: a non-index numeric-string key could compensate the own-key count of a sparse array. Placing it in physical-hash-excluded `result.performance` was accepted by the original implementation. Owner fix `7985b0f` checks every own indexed descriptor. Follow-up `604d5ab` captures the own data length descriptor once and uses that same admitted length throughout, preventing array Proxy length traps from redirecting allocation after capacity checks. No huge allocation was executed; a bounded fourth-read16385 counterexample confirms zero length get-trap calls.

The independent oracle is `u=[.0007xy,-.0004yz,.0011zx]` mm in local coordinates, ν=.31 and E=1e9Pa. Nodes/display box are translated by `[100000,-200000,300000]` mm. Analytic normal/engineering-shear derivatives and isotropic stresses agree at nonnodal points, faces, corners and the shared center. Constructed polynomial records test interpolation, not the original load solution or a new FEM solve. The shared center chooses minimum index0; clearly external points are refused.

An independent FD test replaces the opened path with identical bytes in a different inode. It is rejected as `input-changed` even though raw SHA remains identical. The original fixture is unchanged. [Dated evidence](../evidence/2026-11-07-tet10-native-query-independent.json) records final checks/hashes. No mandatory findings remain after the owner fixes. Content consistency establishes no signature, equilibrium, calibration, general Tet10/CAD or common case/view/compare support.
