# Airpocket Simulation Studio

[日本語](README.md)

A browser application for defining regions directly on 3D models and running structural, thermal, fluid and acoustic simulations with validated open-source engines.

v0.37 supports STEP/built-in and single closed convex STL volume meshes, linear structure/displacement/thermal stress, small-strain J2 plasticity with positive isotropic hardening, prescribed load-factor histories and elastic unloading, compressible Neo-Hookean finite strain, S–N fatigue evaluation of proportional uniaxial linear-elastic loading, steady 3D low-Reynolds-number Stokes flow around external CAD solids, steady/transient conduction, convection/radiation/planar thermal contact, local/adaptive refinement and convergence diagnostics, frequency/transient acoustics, exterior radiation/directivity/WAV, natural modes and one-way box-mode acoustics, CAD seed/box-cap internal fluid extraction and CAD-verified developed round/rectangular channels, section viewing, probes and case comparisons. Structure can use Airpocket or independent MFEM 4.10 WASM; Airpocket also has experimental WebGPU with CPU correction. J2 plasticity uses Airpocket CPU only; combinations with MFEM/WebGPU, adaptation, modal analysis and thermal stress are unsupported. [Usage and scope](docs/en/analysis-guide.md), [J2 plasticity setup and limits](docs/en/plasticity.md), [closed STL volume meshing](docs/en/stl-meshing.md), [S–N fatigue setup and limits](docs/en/fatigue.md), [Stokes flow setup and accuracy limits](docs/en/stokes-flow.md). General Navier–Stokes flow with inertia, turbulence, finite-strain plasticity, plastic/multiaxial fatigue, experimental calibration for complex cyclic loading, crack growth, fracture, mechanical contact, near-incompressible rubber, general curved/two-way acoustics and other candidate solver ports remain outstanding.

Fatigue evaluation requires measured fully reversed (stress ratio −1) S–N amplitude data with test conditions and provenance. It supports tensile-mean Goodman correction and a single constant-amplitude Miner usage factor, without life extrapolation beyond the registered curve. Material names or tensile strength alone do not generate numeric life.

Stokes flow is a CPU GMRES prototype for external box domains at Re≤0.1, up to 2000 nodes and 8000 tetrahedra. Supply viscosity and density; outer velocity is uniform and the solid is no-slip. Inertia and turbulence are excluded. Finite-box drag differs from exact unbounded-sphere drag. v0.37 passed 209 source tests, 21 deployed runtime checks and 22 public browser checks.

- [App](https://airpocket-soundman.github.io/airpocket-simulation-studio/?lang=en)
- [Live development board](https://airpocket-soundman.github.io/airpocket-simulation-studio/development.html?lang=en)
- [Features](docs/en/features.md), [solvers](docs/en/solvers.md), [materials](docs/en/materials.md)
- [Architecture](docs/en/architecture.md), [roadmap](docs/en/roadmap.md), [browser runtime](docs/en/browser-runtime.md)
- [API and testing](docs/en/testing.md), [acoustics](docs/en/acoustics.md)
- [Adaptive meshing](docs/en/adaptive-meshing.md), [optional printed-parts mode](docs/en/printed-parts.md)

STL volume meshing is limited to one closed outward-facing convex shell with at most 2000 triangles. Holes, multiple shells, concavity and inconsistent facets are rejected without automatic repair. Conditions use triangle selection and approximate projection onto the volume mesh; area errors above 15% stop execution. STL adaptive refinement, exact CAD patches and fluid-domain construction are unsupported. STEP supports exact planar rectangles and cylindrical patches; other partial curved regions use projection. General CAD shape editing is unsupported.

Development: `npm ci`, `npm run build`, `npm run dev`. Tests: `npm test`. Pushes to main build and deploy to GitHub Pages. Model data is processed locally. The repository is public as requested by the owner. See [third-party notices](THIRD_PARTY.md).

Progress is stored in src/progress.json; the board fetches updates every 20 seconds while visible. Work status is updated at milestones, not continuously inferred from code. Notes on the board are local to each browser and can be exported.

[Exterior fluid-domain construction and limitations](docs/en/fluid-domains.md)

[WebGPU computation and CPU correction scope](docs/en/webgpu.md)

[Independent MFEM engine and build process](docs/en/native-solvers.md)

- [Material temperature, rate and direction data](docs/en/material-dependence.md)

- [Finite-strain rubber analysis](docs/en/hyperelasticity.md)

- [Exterior radiation and far-field directivity](docs/en/exterior-acoustics.md)

- [Transient acoustics](docs/en/transient-acoustics.md)

- [Natural vibration](docs/en/modal-analysis.md)

- [One-way vibration to exterior acoustics](docs/en/vibration-acoustics.md)

- [Extract internal fluid from CAD](docs/en/internal-fluid.md)

[Result sections and probes](docs/en/result-sections.md)

[Exact planar CAD rectangles](docs/en/planar-regions.md)

[Exact cylindrical CAD patches](docs/en/cylindrical-cad.md)

[Oblique planes and rotated rectangles](docs/en/oblique-planar.md)

[Images and animations](docs/en/visual-export.md) · [MCP and skill](docs/en/automation.md)
