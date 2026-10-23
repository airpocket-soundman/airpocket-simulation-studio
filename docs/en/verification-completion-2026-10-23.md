# Pending verification execution (2026-10-23)

[日本語](../verification-completion-2026-10-23.md) / [Full inventory](verification-inventory-2026-10-23.md)

Existing implementation checks ran in parallel. Missing recovery explanations and ignored unsupported inputs were repaired. Unimplemented features, measured calibration, authentication and an undeployed candidate remain distinct. The original 37 unfinished progress IDs are unchanged.

## Restart and curve output

The formal stdio MCP success→stop→restart→discovery→explicit rerun loop passed again. Restored jobs are metadata-only. Empty artifact listings now carry recovery information; individual retrieval returns stable code `ANALYSIS_JOB_ARTIFACT_NOT_RESTORED` and instructions to use a new requestId and explicit input/output paths. Existing output preservation, identical/changed startup rejection and reuse after release passed. Of 24 related tests, 23 passed and one existing symlink test was skipped because Windows could not create symlinks. Full automatic result restoration was not implemented.

New curve UI tests cover stale file success/rejection after a newer selection and disposal during reading. Complete CSV/JSON/SVG Blob bytes and SHA-256 from the DOM fixture match the output of a separate formal stdio MCP process for public A/B inputs. All 23 related tests passed. These are not browser download observations.

## Browser and deployment limits

Chrome opened the target localhost page and curve panel, but file-chooser notification and subsequent DOM Runtime.evaluate operations timed out. This run produced no new successful plot or downloaded artifact. Previous JA/EN, keyboard and inline-preview evidence remains historical. The 390px viewport, full Blob downloads, full-size tab inspection, real recording expiry, second browser and live project-revision equality remain unverified. No alternate route to the rejected Blob URL was attempted. The owned development server stopped.

The public check ran but stopped because its manifest reports main `fe98ca3e60b4f5dfd65c02f00b33b0f76059e9cb`, rather than the working candidate. Local/CI validation does not establish deployment. Other contributors retain separate Windows, numerical, recording-expiry and independent-Skill evidence. Final integration CI, deployment identity and general physical accuracy require their own evidence.
