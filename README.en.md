# Airpocket Simulation Studio

[日本語](README.md)

A browser application for defining regions directly on 3D models and running structural, thermal, fluid and acoustic simulations with validated open-source engines.

Current prototype: browser-local STEP import through WASM, STL display, orbit/zoom/pan, CAD-face and visible partial-surface selection, constraints and directional force setup, validated material-property input, JSON project roundtrips, a shared command API and headless tests. Volume meshing and analysis solvers are not integrated yet. Display triangles are not analysis elements. Exact CAD editing and region transfer after remeshing remain planned.

- [App](https://airpocket-soundman.github.io/airpocket-simulation-studio/?lang=en)
- [Live development board](https://airpocket-soundman.github.io/airpocket-simulation-studio/development.html?lang=en)
- [Features](docs/en/features.md), [solvers](docs/en/solvers.md), [materials](docs/en/materials.md)
- [Architecture](docs/en/architecture.md), [roadmap](docs/en/roadmap.md), [browser runtime](docs/en/browser-runtime.md)
- [API and testing](docs/en/testing.md), [acoustics](docs/en/acoustics.md)
- [Adaptive meshing](docs/en/adaptive-meshing.md), [optional printed-parts mode](docs/en/printed-parts.md)

Development: `npm ci`, `npm run build`, `npm run dev`. Tests: `npm test`. Pushes to main build and deploy to GitHub Pages. Model data is processed locally. The repository is public as requested by the owner. See [third-party notices](THIRD_PARTY.md).

Progress is stored in src/progress.json; the board fetches updates every 20 seconds while visible. Work status is updated at milestones, not continuously inferred from code. Notes on the board are local to each browser and can be exported.
