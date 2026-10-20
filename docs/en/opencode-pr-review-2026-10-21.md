# OpenCode PR review — 2026-10-21

[日本語](../opencode-pr-review-2026-10-21.md)

[Exact reviewed heads and reproductions](../evidence/2026-10-21-opencode-pr-review.json) / [Twenty next work orders](../opencode-work-orders-2026-10-21/README.md)

Eighteen exact PR heads were independently reviewed: eleven accepted for integration and seven requiring changes. PRs144 and145 remain untouched as potentially in progress. Passing original PR CI is distinguished from code correctness.

## Eleven integration candidates

PRs126,127,128,129,130,132,135,136,137,138 and142. Exact heads are recorded in the JSON. These are bounded increments, not completed parent epics. Rendering stubs are not evidence of real-Chrome pixel output.

Conflicts among126/132/137 preserve required-pointer actions, JSON Pointer precedence and the common analysis-options reader.129 integrated targeted tests and five type declarations pass. Final combined CI, normal protected merge and publication verification remain separate gates.

## Seven changes required

| PR | Location | Reproduction | Work order |
|---|---|---|---|
| [#131](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/131) | `scripts/analysis-job-service.mjs:104` | Concurrent valid A and invalid B using one requestId can persist B startupDigest on successful A. | [34](../opencode-work-orders-2026-10-21/34-P3.md) |
| [#133](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/133) | `scripts/acp-client-process.mjs:328` | JSON-RPC response with jsonrpc WRONG and id 1 is accepted as initialized/ready. | [27](../opencode-work-orders-2026-10-21/27-AGENTACP1.md) |
| [#134](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/134) | `src/increment-curve-data.js:160` | Controlled force 999 N with applied force 100 N and reaction -100 N is accepted as a converged row. | [28](../opencode-work-orders-2026-10-21/28-RESULTCURVE1.md) |
| [#139](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/139) | `src/opening-loop-candidates.js:51` | Two identical same-winding triangles produce closedShell true with no rejection. | [29](../opencode-work-orders-2026-10-21/29-CFDPORT1.md) |
| [#140](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/140) | `src/planar-heat-transfer.js:76` | Finite 1e6 mm edges and 1e308 W/m2 flux overflow into sourceW Infinity and target/balance NaN returned as success. | [30](../opencode-work-orders-2026-10-21/30-COUPLE3.md) |
| [#141](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/141) | `src/ui/spherical-region-ui.js:63` | English-generated dynamic status stays English after switching to Japanese. | [37](../opencode-work-orders-2026-10-21/37-REG2.md) |
| [#143](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/143) | `src/unilateral-contact-reference.js:54` | Tolerance 1e-30 and maxIterations 1e20 permit stagnation at residual 8.5265e-14 without bounded termination. | [38](../opencode-work-orders-2026-10-21/38-CONTACT1.md) |

Recheck differences and regression reproductions after a PR head changes. Do not include excluded heads in the integration candidate.

## Verification limits

- Reviewers did not establish new general physical accuracy or real/public browser verification.
- One ACP test initially hit a three-second timeout and passed alone; this is not a stability fix.
- One local P3 symlink test was skipped due to permissions; CI is distinct.
- Preserve the five original user files, each OpenCode workspace and the two potentially unfinished PRs.
