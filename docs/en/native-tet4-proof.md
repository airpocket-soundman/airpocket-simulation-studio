# Prepared Tet4 host/WASM proof

[日本語](../native-tet4-proof.md)

2026-10-21. P6 gains a bounded prepared-record entry beside the unchanged v1 fixed-bar CLI. This is static isotropic Tet4 support, not a production backend or general saved-project runner.

`createNativeTet4Record({input,mesh,fixedNodes,forces})` in `scripts/native-tet4-contract.mjs` snapshots the arguments, validates saved input through the real `createStudioApi.loadProject/exportProject` path, then hashes the validated saved input and explicit mesh. `mesh.nodes` is flat XYZ in mm; `mesh.tets` contains four node indices per positive tetrahedron. `fixedNodes` fully fixes three translations at each vertex; three noncollinear vertices are required. `forces` contains three components in N per node. Prepared mesh and boundary arrays are caller-supplied: they are not inferred or authenticated from saved CAD condition selections.

The record contains canonical saved-input/mesh SHA-256 revisions and material constants. `serializeNativeTet4Record` snapshots before asynchronous hashing, then returns `wire` and `recordRevision`. C++ echoes those identity strings; the caller must check them against the expected record with `verifyNativeTet4Output`. This does not authenticate arbitrary caller-supplied wire data. Preserve the expected record while the child executes.

Limits: 512 nodes,1024 elements,262144 wire bytes; coordinate magnitude≤1e6 mm,force component≤1e12 N,E≤1e15 Pa; -1<nu<0.49. Invalid indices,duplicate/inverted/degenerate elements,unused/disconnected vertices,repeated/insufficient/collinear supports and nonfinite data are rejected. Gravity,thermal stress,modes,orthotropy,plasticity and hyperelasticity are unsupported. Nonzero prescribed displacements,local frames,surface-load integration,CAD remeshing and general mesh validity/overlap checks remain outside this contract.

C++ converts mm to m once and calls the existing `solve_elastic` adapter. Independent stiffness application measures support reactions. Versioned JSON returns full displacement in m,reaction in N,applied/balance vectors,iterations and verified free-DOF residual. Caller verification requires matching identity/runtime,finite arrays,zero support displacement and force balance. Browser backends and case archives remain unchanged.

```js
import {createNativeTet4Record,serializeNativeTet4Record,verifyNativeTet4Output} from './scripts/native-tet4-contract.mjs';
const record=await createNativeTet4Record({input,mesh,fixedNodes,forces});
const {wire,recordRevision}=await serializeNativeTet4Record(record);
// Send wire to the proof executable on stdin, terminated by EOF.
// Verify parsed JSON before use:
verifyNativeTet4Output(output,{record,recordRevision,runtime:'host-native'});
```

`node scripts/check-native-proof.mjs --build` uses existing pinned MFEM/SDK caches and a host C++17 toolchain; it downloads no native executable. Mandatory Linux native-proof CI checks real executable headers,legacy v1 and prepared v2 results,host/WASM agreement and malformed records. `.native-cache/native-proof-report.json` retains source/binary hashes and actual v2 outputs. Runtime-dependent local skips are not host successes. The existing child deadline is30 seconds with bounded output buffers; input bytes and geometry counts are bounded separately.

Synthetic reference: translated20×15×60 mm bar,E2e9 Pa,nu0,loads+75/-75/0 N. At75 N,analytical extension=7.5e-6 m. Tolerances: displacement1e-10 m+1e-7 relative;force balance1e-8 N+1e-7 relative;residual<2e-8. Additional nu0.3 WASM execution checks convergence without claiming the uniform analytical solution. [Local evidence](../evidence/2026-10-21-native-tet4-prepared-record.json) distinguishes actual WASM from unverified local host execution.

P6 remains unfinished. General saved-project preparation,CAD condition transfer,broader physics/material contracts,mesh/physical validation and a production backend remain outside this increment. Numerical runtime agreement is not general physical accuracy.

The material allowlist is exactly `youngModulus`, `poissonRatio`, `source`, `grade`, `notes`. All other material fields (including dependence, validity temperatures, density, failure and future phase models) are refused. Study allows only `kind`, disabled `modalAnalysis`/`thermalStress`, disabled gravity and an optional zero gravity vector. Temperature/evaluation fields and unknown study keys are refused rather than ignored.
