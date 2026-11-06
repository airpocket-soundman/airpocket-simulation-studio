[日本語](../tet10-native-job.md)

# Tet10 saved-file jobs (2026-11-07)

Explicit `elementOrder: 2` selects a limited static isotropic saved-file job: `pcg-strict`, `adaptive: false`, gravity disabled, one box and complete face fixed/total-force conditions. Both worker-thread and process isolation are supported. Omitted/explicit1 preserve the existing Tet4 startup digest; only2 adds elementOrder to that descriptor.

The result kind is `elastic-tet10`, representation `straight-affine-Tet10-native-v1`. Raw output retains every displacement, 10-node element, 6-node boundary face and four stress/volume/von-Mises Gauss records per element. Coordinates/displacements are mm, force N, stress Pa and volume mm³. Reactions are not calculated. Consistent uniform face forces have zero corner weights and mid-edge weights. Mesh quality refers to the parent corner Tet4, without curved geometry claims.

Limits:512 parent cells,4096 quadratic nodes,20000 PCG iterations and1e-10 relative tolerance. Observed mesh artifacts are generated parent Tet4 geometry, not intermediate Tet10 solution fields. The final mesh contains only native Tet10. `nativeResultRevision` uses the existing canonical physical-output hash before adding that revision and the job envelope. Published JSON byte SHA follows the existing job contract. Native output remains provisional.

Case registration, view, point and compare reject with `TET10_NATIVE_RESULT_UNSUPPORTED`. P5B/98 comparison acceptance remains open. Arbitrary CAD/non-box geometry, displacement control, gravity/thermal/anisotropy, nonlinear/modal and adaptive execution are excluded. This increment does not complete its parent work order.

Regressions use a10mm cube, E=1GPa,ν=0 and100N: independent exact u_z=0.001z at every node and σzz=1MPa at every Gauss point. They exercise real thread/process jobs, native hash reconstruction, unchanged input, order conflicts and view refusal. See [evidence](../evidence/2026-11-07-tet10-native-job/report.json). No GUI/browser pairing or large12-design rerun is included.

Here native means the complete Tet10 saved representation, not a native machine-code backend. The existing JavaScript CPU numerical module performs the calculation.
