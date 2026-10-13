# Airpocket Simulation Studio

[日本語](README.md)

A browser application for defining regions directly on 3D models and running structural, thermal, fluid and acoustic simulations with validated open-source engines.

v0.33 supports STEP/built-in volume meshes, linear structure/displacement/thermal stress, monotonic small-strain J2 plasticity with positive isotropic hardening, compressible Neo-Hookean finite strain, steady/transient conduction, convection/radiation/planar thermal contact, local/adaptive refinement and convergence diagnostics, frequency/transient acoustics, exterior radiation/directivity/WAV, natural modes and one-way box-mode acoustics, CAD seed/box-cap internal fluid extraction and CAD-verified developed round/rectangular channels, section viewing, probes and case comparisons. Structure can use Airpocket or independent MFEM 4.10 WASM; Airpocket also has experimental WebGPU with CPU correction. J2 plasticity uses Airpocket CPU only; combinations with MFEM/WebGPU, adaptation, modal analysis and thermal stress are unsupported. [Usage and scope](docs/en/analysis-guide.md), [J2 plasticity setup and limits](docs/en/plasticity.md). General 3D flow, finite-strain plasticity, cyclic FE loading, fatigue/fracture, mechanical contact, near-incompressible rubber, general curved/two-way acoustics and other candidate solver ports remain outstanding.

- [App](https://airpocket-soundman.github.io/airpocket-simulation-studio/?lang=en)
- [Live development board](https://airpocket-soundman.github.io/airpocket-simulation-studio/development.html?lang=en)
- [Features](docs/en/features.md), [solvers](docs/en/solvers.md), [materials](docs/en/materials.md)
- [Architecture](docs/en/architecture.md), [roadmap](docs/en/roadmap.md), [browser runtime](docs/en/browser-runtime.md)
- [API and testing](docs/en/testing.md), [acoustics](docs/en/acoustics.md)
- [Adaptive meshing](docs/en/adaptive-meshing.md), [optional printed-parts mode](docs/en/printed-parts.md)

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
