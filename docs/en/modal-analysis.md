# Natural vibration analysis

[日本語](../modal-analysis.md)

**Natural vibration example** solves low-order modes of a 10 × 10 × 80 mm cantilever. Geometry, homogeneous supports, linear elastic constants and density determine natural frequencies and mode shapes. Select a mode, orbit it in 3D and save it as an analysis case.

## Method and verification

Solve `K φ = ω² M φ`. K is the existing linear-elastic Tet4 stiffness; lumped M assigns `ρV/4` per node equally in three directions. Local support bases are shared with static elasticity. Nonzero loads/prescribed motion, gravity, thermal stress, hyperelasticity and adaptation are rejected. Models retaining unconstrained rigid motion are also rejected.

Block inverse iteration uses two-pass mass-inner-product orthogonalization and a small symmetric Rayleigh–Ritz eigenproblem. Two additional vectors track nearby modes. Double-precision PCG at 1e−10 computes inverse stiffness action. Every reported free-DOF eigenpair satisfies `||Kφ−λMφ|| / ||λMφ|| ≤ 1e−5`; unconverged modes are never returned.

Tests compare low-order cantilever bending against the Euler–Bernoulli reference `β₁²/(2πL²) √(EI/(ρA))` and verify refinement reduces error, nearby bending modes, doubled frequency under 4× E, halved frequency under 4× density, and JS/WASM agreement. The beam reference is not exactly the 3D solid solution. Eigenpair residuals verify the discrete problem, not spatial accuracy.

For the generalized vibration eigenproblem, see [MFEM 4.10 Example 12](https://docs.mfem.org/4.10/ex12p_8cpp_source.html). This feature uses Airpocket block inverse iteration; it does not port MFEM/HYPRE LOBPCG.

## API, output and scope

Set `study.kind: 'structural'`, `modalAnalysis: true`, `modeCount` (1–6), and `modalIterations` (1–100, default 60). Linear properties require positive `density` (kg/m³). Register UI material values before solving. Results have kind `modal`; each `modes` item includes `frequencyHz`, `residual`, `displacement` and `magnitudes`.

Display shapes are normalized to maximum displacement 1 mm. Eigenvector sign and bases within exactly repeated eigenspaces are arbitrary. This is not a forced-response amplitude. Acoustic coupling, forced vibration, damping, prestress, free-support rigid modes, contact and mixed incompressible elements are not implemented. CPU/JS and CPU/WASM only; limits are 2,000 nodes and 8,000 tetrahedra. MFEM/GPU eigenvalue solvers are not connected.
