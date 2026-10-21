# Host-native MFEM proof harness

This independent target reuses `../mfem-adapter/adapter.cpp` without changing the
browser build. It is a deliberately narrow axial bar proof, not an arbitrary
project runner or a completed P6 backend. A host C++17 toolchain and the pinned
MFEM 4.10 source are required. No downloads are performed by this target.

```powershell
cmake -S native/native-proof -B .native-cache/native-proof -G Ninja -DCMAKE_BUILD_TYPE=Release -DMFEM_SOURCE_DIR=<absolute-pinned-mfem-source-directory>
cmake --build .native-cache/native-proof --target airpocket-native-proof -j 4
$env:AIRPOCKET_NATIVE_PROOF = (Resolve-Path .native-cache/native-proof/airpocket-native-proof.exe).Path
node --test tests/native-proof.test.mjs
```

Input is one whitespace-delimited record on stdin, terminated by EOF:
`airpocket-native-proof-v1 <youngPa> <loadN>`. The fixed fixture is a
10 × 10 × 40 mm bar represented by six Tet4 elements, Poisson ratio zero,
fixed bottom and uniform axial top traction. All adapter coordinates and
displacements are in m; modulus is Pa; nodal forces and reactions are N.
Negative and zero loads are supported. Young modulus must be positive.

Successful stdout is one JSON object with schema version, engine, runtime,
MFEM version, displacement, reference error, reaction, balance error and
verified free-degree residual. Invalid input or failed verification returns
nonzero status and an error on stderr. The fixture verifies the complete
displacement field against `u_z = F z / (E A)`, sums the support reaction from
the MFEM stiffness matrix and checks it against `-F`. It also uses the shared
adapter's independent residual check. No fallback engine is used.

The current development machine lacks host C++ standard library headers;
the SDK clang host probe fails on `cstdint`. Therefore host execution remains
unverified. The same C++ fixture was built and run with the existing Emscripten
cache for development verification. Such output explicitly reports
`runtime: "wasm-development-check"`; it is not host-native evidence.

To reproduce that development check using only the existing SDK and MFEM build
caches, run `python scripts/native-proof-wasm.py`. It reads
`.native-cache/paths.json`, builds the two C++ sources against the cached
`build-mfem/mfem-core/libmfem.a`, writes ignored output to
`.native-cache/native-proof-wasm.cjs`, and runs the optional tests. Missing caches
produce an actionable error; the script never invokes setup or downloads.
This opt-in script recompiles the small proof executable each time, reusing the
MFEM library and Emscripten caches. Normal `npm test` does not invoke this script
or compile the proof executable.

Without `AIRPOCKET_NATIVE_PROOF`, the two optional native tests are skipped.
Supplying a `.cjs` or `.mjs` runs an explicitly named WASM development check;
supplying a host executable requires `runtime: "host-native"`.

## Reproducible host / WASM CI gate

The `Verify host-native MFEM proof` workflow uses Linux g++ with C++17,
the same `.native-cache` key and pinned SDK/MFEM setup as the application build.
It runs the existing setup/build scripts, then:

```text
node scripts/check-native-proof.mjs --build
```

This command requires the existing caches and does not download anything itself.
It verifies the SHA-256 of the pinned MFEM archive and compares all 1594 original
source files to that archive, builds the host CMake target and the same-source
WASM proof, runs `tests/native-proof.test.mjs` against the actual host executable,
and runs the contract and host/WASM parity tests. A platform-native executable
header and the exact `host-native` runtime marker are mandatory; a WASM or script
substitute fails the gate. Five positive/negative/zero-load fixtures and eight
malformed-input cases check finite result fields, units through analytical
references, residual, force balance, empty failure stdout and stderr diagnostics.

For previously built executables, omit `--build`. Override their locations with
`AIRPOCKET_NATIVE_PROOF` and `AIRPOCKET_NATIVE_PROOF_WASM` if needed. Running
`node --test tests/native-proof-contract.test.mjs` alone runs the portable contract
checks and skips the actual cross-runtime check unless both paths are supplied.

A completed gate writes `.native-cache/native-proof-report.json`, uploaded as
`native-proof-evidence`, containing the source pin, source/binary hashes and each
runtime's numerical outputs. Workflow creation alone is not evidence of a passed
host run: inspect the completed Actions run and its artifact. This gate only proves
the axial fixture; it does not complete the saved-project native backend or P6.

## Prepared Tet4 record (v2)

The same executable additionally accepts `airpocket-native-tet4-v2`: bounded
isotropic Tet4 mesh/support/nodal-force records with validated saved input
identity. See [the contract](../../docs/en/native-tet4-proof.md). No CAD condition
transfer or arbitrary saved-project execution is implied. The mandatory CI also
runs translated-bar v2 references and invalid records in host/WASM processes.
