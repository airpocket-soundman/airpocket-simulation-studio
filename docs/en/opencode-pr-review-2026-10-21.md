# OpenCode PR review — 2026-10-21

[日本語](../opencode-pr-review-2026-10-21.md)

[Exact reviewed heads and reproductions](../evidence/2026-10-21-opencode-pr-review.json) / [Twenty next work orders](../opencode-work-orders-2026-10-21/README.md)

All twenty PRs were reviewed after the user confirmed readiness: eleven accepted for integration and nine requiring changes. Passing original PR CI is distinct from code correctness.

## Eleven integration candidates

#126, #127, #128, #129, #130, #132, #135, #136, #137, #138, #142。

Shared UI conflicts preserve required-pointer correction, JSON Pointer precedence and common options.129 integrated targeted tests and five type declarations pass. The unchanged accepted code also passed full CI at a366:1641 total,1638 passed,3 skipped. Final updated-head CI and normal merge/publication remain required.

## Nine changes required

| PR | Location | Reproduction | Work order |
|---|---|---|---|
| [#131](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/131) | `scripts/analysis-job-service.mjs:104` | Concurrent valid A and invalid B using one requestId can persist B startupDigest on successful A. | [34](../opencode-work-orders-2026-10-21/34-P3.md) |
| [#133](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/133) | `scripts/acp-client-process.mjs:328` | JSON-RPC response with jsonrpc WRONG and id 1 is accepted as initialized/ready. | [27](../opencode-work-orders-2026-10-21/27-AGENTACP1.md) |
| [#134](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/134) | `src/increment-curve-data.js:160` | Controlled force 999 N with applied force 100 N and reaction -100 N is accepted as a converged row. | [28](../opencode-work-orders-2026-10-21/28-RESULTCURVE1.md) |
| [#139](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/139) | `src/opening-loop-candidates.js:51` | Two identical same-winding triangles produce closedShell true with no rejection. | [29](../opencode-work-orders-2026-10-21/29-CFDPORT1.md) |
| [#140](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/140) | `src/planar-heat-transfer.js:76` | Finite 1e6 mm edges and 1e308 W/m2 flux overflow into sourceW Infinity and target/balance NaN returned as success. | [30](../opencode-work-orders-2026-10-21/30-COUPLE3.md) |
| [#141](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/141) | `src/ui/spherical-region-ui.js:63` | English-generated dynamic status stays English after switching to Japanese. | [37](../opencode-work-orders-2026-10-21/37-REG2.md) |
| [#143](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/143) | `src/unilateral-contact-reference.js:54` | Tolerance 1e-30 and maxIterations 1e20 permit stagnation at residual 8.5265e-14 without bounded termination. | [38](../opencode-work-orders-2026-10-21/38-CONTACT1.md) |
| [#144](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/144) | `src/curved-pressure-transfer.js:48` | Finite 1e6 mm triangle edges and pressure real1e308 Pa return resultant -Infinity and NaN moment. A 10 mm triangle with finite uz1e308 m returns volume Infinity although expected5e303 m3 is finite, and virtual-work relativeError NaN. | [39](../opencode-work-orders-2026-10-21/39-COUPLE4B.md) |
| [#145](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/145) | `src/ui/agent-connection-status-ui.js:96` | With the actual installLanguage scanner, English-start aria-label Connection status notifications switches to Japanese briefly but returns to English on the next scan. | [40](../opencode-work-orders-2026-10-21/40-AGENTCHAT1.md) |

Recheck changed heads. Excluded commits are not included. Twenty next work orders comprise nine repairs and eleven next steps.

## Verification limits

- Bounded prototypes and rendering stubs do not establish real browser or general physical accuracy. Parents remain incomplete.
- One ACP focused timeout passed alone; it is not a stability fix. A local P3 symlink test was skipped for permissions.
- Initial integration CI failed only because this new review document lacked its English counterpart. Fixed with reciprocal links; the next full CI succeeded.
- Preserve original user files and other owners workspaces.
