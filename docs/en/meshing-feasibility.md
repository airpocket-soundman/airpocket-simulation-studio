# Meshing runtime feasibility

[日本語](../meshing-feasibility.md)

Package metadata and primary documentation checked on 2026-10-13.

- `@loumalouomega/gmsh-wasm` 0.3.0: independent WASM packaging of the Gmsh C API, including STEP/CAD import and volume meshing. Approximately 43 MB unpacked. Browser execution needs SharedArrayBuffer and cross-origin isolation; the Pages Service Worker workaround requires validation. Not integrated in this app yet.
- `@loumalouomega/mmg-wasm` 0.1.0: candidate surface/volume remeshing engine, approximately 2 MB unpacked. Validate adaptation driven by a size field derived from solution-error indicators. Not integrated yet.

Package licenses are GPL-2.0-or-later for Gmsh and LGPL-3.0-or-later for MMG. Review app/distribution obligations, corresponding sources, notices and reproducible builds before adoption. A public repository alone does not satisfy every obligation.

Next checks: tetrahedralize a small cube; compare summed element volume to geometry volume; verify positive volume, quality and boundary identities; test Worker cancellation, Pages startup and unsupported-browser diagnostics. Then test actual STEP inputs and conformity to partial regions.

References: [Gmsh browser requirements](https://loumalouomega.github.io/GMSH-JS/guide/browser/), [Gmsh WASM source](https://github.com/loumalouomega/GMSH-JS), [MMG WASM source](https://github.com/loumalouomega/MMG-WASM).
