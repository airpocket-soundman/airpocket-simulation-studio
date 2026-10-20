# OpenCode PRレビュー（2026-10-21）

[English](en/opencode-pr-review-2026-10-21.md)

[機械可読の固定head・再現条件](evidence/2026-10-21-opencode-pr-review.json) / [次の20作業](opencode-work-orders-2026-10-21/README.md)

18件を独立レビューし、11件を統合候補、7件を修正待ちとした。#144/#145は制作中の可能性があるため未レビュー・変更なし。PRの個別CI成功とコードの正しさを分離して判定した。

## 統合候補11件

#126、#127、#128、#129、#130、#132、#135、#136、#137、#138、#142。各固定headはJSONに記録。親タスクの全受入を完了したものではない。新しい試験の一部は描画stubであり、実Chrome描画の成功とは扱わない。

#126/#132/#137の共通UIとテストの競合は、requiredPointersの導線、JSON Pointer優先、共通options読取の全てを保持して解消した。統合対象129試験と型5宣言が成功。最終の全体CI・保護された通常merge・公開検証は別途必要。

## 修正待ち7件

| PR | 場所 | 問題と再現 | 修正指示 |
|---|---|---|---|
| [#131](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/131) | `scripts/analysis-job-service.mjs:104` | Concurrent valid A and invalid B using one requestId can persist B startupDigest on successful A. | [34](opencode-work-orders-2026-10-21/34-P3.md) |
| [#133](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/133) | `scripts/acp-client-process.mjs:328` | JSON-RPC response with jsonrpc WRONG and id 1 is accepted as initialized/ready. | [27](opencode-work-orders-2026-10-21/27-AGENTACP1.md) |
| [#134](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/134) | `src/increment-curve-data.js:160` | Controlled force 999 N with applied force 100 N and reaction -100 N is accepted as a converged row. | [28](opencode-work-orders-2026-10-21/28-RESULTCURVE1.md) |
| [#139](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/139) | `src/opening-loop-candidates.js:51` | Two identical same-winding triangles produce closedShell true with no rejection. | [29](opencode-work-orders-2026-10-21/29-CFDPORT1.md) |
| [#140](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/140) | `src/planar-heat-transfer.js:76` | Finite 1e6 mm edges and 1e308 W/m2 flux overflow into sourceW Infinity and target/balance NaN returned as success. | [30](opencode-work-orders-2026-10-21/30-COUPLE3.md) |
| [#141](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/141) | `src/ui/spherical-region-ui.js:63` | English-generated dynamic status stays English after switching to Japanese. | [37](opencode-work-orders-2026-10-21/37-REG2.md) |
| [#143](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/143) | `src/unilateral-contact-reference.js:54` | Tolerance 1e-30 and maxIterations 1e20 permit stagnation at residual 8.5265e-14 without bounded termination. | [38](opencode-work-orders-2026-10-21/38-CONTACT1.md) |

修正PRのheadが変わった場合、このレビュー結果を流用せず反例と差分を再確認する。修正待ちのcommitを統合候補へ混入させない。

## 検証上の限界

- 実ブラウザの追加確認と一般物理精度を、本レビューで新たに証明したものではない。
- ACPの1試験は最初3秒timeout、単独再実行で成功。安定性解決の根拠としない。
- P3のローカルsymlink試験は権限条件でskip。CIと区別する。
- 利用者の元の5ファイル、各OpenCode作業場所、制作中扱いの2件は変更しない。
