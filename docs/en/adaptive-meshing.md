# Adaptive meshing and reanalysis

[日本語](../adaptive-meshing.md)

Gmsh volume mesh → structural solve → recovered stress, strain and displacement indicators → local refinement → boundary transfer → reanalysis, for at most five rounds. All completed meshes, boundaries and results are retained without changing materials or loads.

Compare the latest two changes across at least three increasingly refined meshes. Default tolerances are 1% displacement and 5% peak von Mises stress. Stop when both are stable and recovered stress variation is below 0.2. This is output stability, not a certified error bound.

Stop with a suspected singularity if displacement is stable while peak-element cube-root volume decreases by at least 5% twice, stress grows above tolerance twice, and growth does not decay. This cannot mathematically distinguish all singularities from unresolved stress concentrations. Changes in peak location need further examination.

Element and between-stage time limits, or stalled refinement, return the last completed analysis with unconfirmed convergence. An oversized initial mesh fails. Time limits do not interrupt a synchronous mesher or solve immediately; the worker also has a 120-second hard timeout and a cancel button.

The UI displays elements, displacement, stress, peak-element size and elapsed time. API options `maxAdaptiveElements`, `maxAdaptiveSeconds`, `tolerance` and `stressTolerance` are retained in saved cases. Coarsening, mechanical contact and certified error estimation remain unsupported.

Reference: [COMSOL mesh refinement guidance](https://www.comsol.com/support/knowledgebase/1261.). Displacement and local stress require separate convergence checks; this app's thresholds are implementation diagnostics.
