# Airpocket Simulation Studio

[日本語](README.md)

A browser application for defining regions directly on 3D models and running structural, thermal, fluid and acoustic simulations with validated open-source engines.

v0.5 implements STEP/built-in volume meshing, linear structural analysis, steady/transient conduction with convection and total heat input local refinement/reanalysis, frequency acoustics, sweeps and result probes. [Usage and supported scope](docs/en/analysis-guide.md). Fluid, absorbing boundaries, nonlinear behavior, failure and contact remain unimplemented. Partial regions use projection with a reported 15% area-error threshold; exact CAD splitting remains planned.

- [App](https://airpocket-soundman.github.io/airpocket-simulation-studio/?lang=en)
- [Live development board](https://airpocket-soundman.github.io/airpocket-simulation-studio/development.html?lang=en)
- [Features](docs/en/features.md), [solvers](docs/en/solvers.md), [materials](docs/en/materials.md)
- [Architecture](docs/en/architecture.md), [roadmap](docs/en/roadmap.md), [browser runtime](docs/en/browser-runtime.md)
- [API and testing](docs/en/testing.md), [acoustics](docs/en/acoustics.md)
- [Adaptive meshing](docs/en/adaptive-meshing.md), [optional printed-parts mode](docs/en/printed-parts.md)

Development: `npm ci`, `npm run build`, `npm run dev`. Tests: `npm test`. Pushes to main build and deploy to GitHub Pages. Model data is processed locally. The repository is public as requested by the owner. See [third-party notices](THIRD_PARTY.md).

Progress is stored in src/progress.json; the board fetches updates every 20 seconds while visible. Work status is updated at milestones, not continuously inferred from code. Notes on the board are local to each browser and can be exported.
