# Third party components

[日本語](THIRD_PARTY.ja.md)

- Three.js — MIT — https://github.com/mrdoob/three.js
- Vite — MIT — https://github.com/vitejs/vite
- occt-import-js — LGPL-2.1 — https://github.com/kovacsv/occt-import-js (version 0.0.23). Unmodified JavaScript and WASM files are served separately under cad/. The source and build instructions are available at the upstream repository. Open CASCADE notices and license are included in the upstream source distribution: https://github.com/Open-Cascade-SAS/OCCT .

The CAD runtime is replaceable: replace public/cad/occt-import-js.js and public/cad/occt-import-js.wasm after the copy step, before building. Third-party package license texts are included under public/licenses during the build.
