# Architecture and project boundaries

[日本語](../architecture.md)

Start with one repository and one product, with independent structural/thermal/fluid/acoustic modules. Share CAD viewing, partial surface regions, materials, projects, jobs and result presentation. Use discipline-specific workflows for fluid domains, boundary layers and convergence settings rather than overloading structural screens. Split repositories only when independent teams/releases or concrete licensing requirements justify it.

Static web UI uses TypeScript/JavaScript and Three.js; the current prototype is vanilla JavaScript. CAD import uses an OpenCASCADE-based WASM library. Investigate browser-compatible volume meshing separately. Run computation in Web Workers/WASM on the local CPU; do not require Python, WSL or a daemon. GPU rendering and WebGPU solver computation are separate capabilities, with CPU fallback.

Adapter contract: capabilities, validate, export, run, cancel and collectResults, including engine version, convergence and diagnostics. Normalize displacement, stress, temperature, velocity and pressure fields while retaining node/element/integration-point distinctions.

Data model: Geometry → Region → Material/BoundaryCondition → Study → Mesh → SolverRun → Result. Regions retain CAD references and definitions rather than only node numbers. Runs freeze input snapshots and units. Proposed modules: UI/viewer/model, workers, solver adapters and benchmarks.

Validate standalone analyses first, then one-way thermal-to-structural transfer and conjugate heat transfer. Check temperature interpolation and conservative force/heat transfers across meshes. Two-way fluid/structure coupling requires synchronization/stability tests and is not achieved by simply running engines in sequence.
