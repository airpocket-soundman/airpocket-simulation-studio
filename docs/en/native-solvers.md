# Independent OSS engine: MFEM 4.10

[日本語](../native-solvers.md)

The serial MFEM C++ library is compiled with Emscripten 6.0.12 to WASM and offered as a separate linear structural engine. MFEM H1 first-order elements and ElasticityIntegrator assemble stiffness, solved with symmetric Gauss-Seidel preconditioning and CG. This does not pass Airpocket's assembled matrix to MFEM.

Convert Tet4 nodes/elements to MFEM with coordinates in metres. Transform MFEM stiffness into each constraint's local basis and supply the same nodal loads, gravity and thermal-strain loads. Constraint validation, region transfer, reactions/stress postprocessing and display are shared. Check the returned solution against the common original float64 stiffness and require a free-DOF residual at most 2e-8. MFEM failures do not silently substitute another engine.

Tests compare the 0.04 mm / 100 N reference bar and rotated directional/prescribed constraints including thermal expansion and gravity. The UI can run the same inputs on both engines and retain comparable saved cases and views.

The current adapter supports linear isotropic Tet4 structure only, not all features of the MFEM library. CalculiX, Elmer, Code_Aster and OpenFOAM remain unported.

`npm test` / `npm run build` fetch pinned SDK/MFEM sources and compile when artifacts are absent. First build needs Python, CMake, Ninja and network access; the Windows SDK compressed distribution is around 700 MB. Subsequent runs reuse source hashes and caches. Tools live in ignored repository-local .native-cache without permanent system environment changes. GitHub Actions follows the same process. Outputs go to public/mfem and the published distribution includes MFEM's BSD-3 LICENSE and NOTICE.

Pins: MFEM v4.10 (16b0b814a3ba15a56c7a04e02d047188800cc0bf), emsdk 35ff8a6d150541276abbc6bae512ca90bcfbe220 / Emscripten 6.0.12.

References: [MFEM build instructions](https://mfem.org/building/), [Emscripten SDK](https://emscripten.org/docs/tools_reference/emsdk.html).
