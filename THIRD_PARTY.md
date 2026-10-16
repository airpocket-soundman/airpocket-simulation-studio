# Third party components

[日本語](THIRD_PARTY.ja.md)

- Three.js — MIT — https://github.com/mrdoob/three.js
- Vite — MIT — https://github.com/vitejs/vite
- Gmsh WASM 0.3.0 — GPL-2.0-or-later — source and reproducible build scripts: https://github.com/loumalouomega/GMSH-JS/tree/3fdabeeb1dac2417446cefb9f75ecb6645315cd6 . The pinned Gmsh and OpenCASCADE sources are identified by that repository's submodule and build scripts. The unmodified runtime is served separately under gmsh/; its license is provided under licenses/. This application is distributed under GPL-2.0-or-later; its matching source and dependency lockfile are in this repository.
- coi-serviceworker 0.1.7 — MIT — https://github.com/gzuidhof/coi-serviceworker . Enables browser isolation for threaded Gmsh on Pages.
- occt-import-js — LGPL-2.1 — https://github.com/kovacsv/occt-import-js (version 0.0.23). Unmodified JavaScript and WASM files are served separately under cad/. The source and build instructions are available at the upstream repository. Open CASCADE notices and license are included in the upstream source distribution: https://github.com/Open-Cascade-SAS/OCCT .
- SU2 v8.5.0 — LGPL-2.1 — https://su2code.github.io . Experimental, opt-in native external-flow execution only. SU2 binaries are NOT bundled in this repository or in the Pages build. `scripts/setup-su2.mjs` downloads the official v8.5.0 Windows release zip only when the user runs it explicitly, and verifies a pinned size and SHA-256 before use; the downloaded files are used unmodified as a separate local process. The `.vtu` reader in `src/su2-vtu.js` is project code for a narrow uncompressed format; no VTK library is included.

The CAD runtime is replaceable: replace public/cad/occt-import-js.js and public/cad/occt-import-js.wasm after the copy step, before building. Third-party package license texts are included under public/licenses during the build.
