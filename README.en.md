# Airpocket Simulation Studio

[日本語](README.md)

A browser application for defining regions directly on 3D models and running structural, thermal, fluid and acoustic simulations with validated open-source engines.

v0.24 implements STEP/built-in volume meshes, linear structure, prescribed displacement and thermal stress, steady/transient conduction, convection, radiation and planar contact resistance, adaptive refinement and convergence trends, frequency acoustics/impedance/sweeps, fully developed laminar channels, clipping/opacity/part visibility, probes and saved cases. [Usage and scope](docs/en/analysis-guide.md). General 3D flow, nonlinear behavior, failure, mechanical contact and native OSS solver WASM ports remain unimplemented.

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
