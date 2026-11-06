# Independent saved holdout entry audit

[日本語](../printed-holdout-entry-audit-2026-11-07.md)

The CLI, saved-file service, formal stdio MCP and capability declarations at `4bc0a9f` were independently reviewed without product-source changes. Real CLI/MCP checks compare an invented noisy oracle across m/kN and mm/N normalization: E=7e8Pa, SE=√((50000/4)/(55e-6)), signed residuals[-300,100,-50]Pa and independent statistics. Changing validation observations leaves training-fit coefficients unchanged.

Both datasets accept exactly2000000 bytes; one extra byte produces a refusal without model values. Checks cover raw UTF-8 hashes/lengths, input preservation, link/junction rejection, existing-directory preservation, bounded MCP summaries, SHA refusal artifacts and unknown-field rejection. Capability availability is Node-only; the publishing tool correctly has false readOnly/idempotent hints.

Six owner tests and four independent real entry tests were run. These synthetic checks do not verify measurements, physical independence, calibration, material accuracy or GUI behavior. Pa errors have no pass threshold and preserve the training-only pure contract. The file policy is not an OS sandbox against hostile parent-directory replacement. See [dated evidence](../evidence/2026-11-07-printed-holdout-entry-independent.json).
