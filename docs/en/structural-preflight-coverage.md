# Static isotropic linear preflight coverage

[日本語](../structural-preflight-coverage.md)

Solve responses from `preflightProject` use one contract identity for `requiredInputContract` and `physicsCoverage.contract`. Previously static isotropic linear input reported `static-isotropic-linear-structure` in the former and null in the latter. Legacy, quantitative and exploratory modes now agree. Mesh-only retains `requiredInputContract:mesh-only` and null coverage identity; it does not advertise solve checks.

Static isotropic metadata lists actual input checks: project/material validation, execution settings, units/magnitudes, required values, boundary discipline/support presence and unresolved CAD refusal. Required-pointer provenance applies to quantitative/exploratory modes; legacy gains no provenance requirement.

`postMeshImplemented` describes the separate `preflightMeshBoundaryTransfer` call using a successful settled mesh-only job: finite Tet4 nodes/connectivity/volume/gradients and available quality data; boundary transfer/area/projection reports; connected-component rigid-body rank for fixed/prescribed-displacement supports. Input preflight does not execute these checks. Existing structural allowed behavior is unchanged by rigid-body diagnostics. Spring/elastic-support rank, general quality thresholds, source applicability, convergence, mesh dependence and physical accuracy remain incomplete; `completePreflight:false` is retained.

Advanced contracts retain their exact identity but do not borrow static-isotropic implemented coverage. Unregistered coverage returns an empty implemented list and remaining checks. Legacy advanced inputs retain unsupported/warning behavior; unsupported quantitative studies retain unsupported/error behavior. Steady thermal component anchors including thermal contacts and acoustic wavelength checks already exist and were not reimplemented.

This is metadata only: allowed values, diagnostic severity, provisional flags, permissions, solver execution and saved schemas are unchanged. The [evidence](../evidence/2026-10-24-structural-preflight-coverage.json) records31 pure input-check tests, with no solver, GUI or CI execution, full-physics completion or publication claim.
