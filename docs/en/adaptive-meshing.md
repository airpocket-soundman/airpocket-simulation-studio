# Adaptive meshing and repeated analysis

[日本語](../adaptive-meshing.md)

Generate a volume mesh for analysis. Refining display triangles alone does not satisfy this requirement.

Loop: initial mesh → solve → evaluate error, displacement, strain and stress → refine locally → transfer boundary conditions → solve again → assess convergence.

Allow displacement magnitude to guide refinement as requested. Also use displacement gradients, strain/stress gradients and residual or recovery-based error estimates: displacement magnitude alone can over-refine rigid motion or smooth bending. Support explicit local sizes around selected regions, contacts and thin features.

Stop on relative changes in selected outputs, estimated error, iteration/element limits, memory or time limits. Identify singularities where peak stress does not converge. Preserve every mesh, input snapshot, result and convergence history. Do not silently change materials or loads.

Start with refinement only. Add coarsening and mesh optimization after verifying conservation and region boundaries. The result-driven loop requires an integrated solver; this feature is currently planned.
