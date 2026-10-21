# OpenCode PRレビュー（2026-10-21）

追記: 前回要修正9件は修正版を再レビューして合格。#139の位置依存判定を統合側で追加修正。[修正版のレビュー記録](evidence/2026-10-21-repaired-pr-review.json)。以下は初回レビュー時点の記録。

[English](en/opencode-pr-review-2026-10-21.md)

[固定headと再現条件](evidence/2026-10-21-opencode-pr-review.json) / [次の20作業](opencode-work-orders-2026-10-21/README.md)

利用者が20件すべてレビュー可能と確認したため、全20件を独立レビュー。11件を統合候補、9件を修正待ちとした。個別CI成功とコードの正しさは区別した。

## 統合候補11件

#126, #127, #128, #129, #130, #132, #135, #136, #137, #138, #142。

共通UIの競合は必要入力の導線、JSON Pointer優先、共通options読取を全て保持。統合129試験と型5宣言が成功。同じ採用コードはa366の全体CIでも1641件中1638成功・3skip・失敗0。レビュー範囲更新後headの最終CI、通常merge、公開検証は別段階。

## 修正待ち9件

| PR | 場所 | 問題と再現 | 修正指示 |
|---|---|---|---|
| [#131](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/131) | `scripts/analysis-job-service.mjs:104` | Concurrent valid A and invalid B using one requestId can persist B startupDigest on successful A. | [34](opencode-work-orders-2026-10-21/34-P3.md) |
| [#133](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/133) | `scripts/acp-client-process.mjs:328` | JSON-RPC response with jsonrpc WRONG and id 1 is accepted as initialized/ready. | [27](opencode-work-orders-2026-10-21/27-AGENTACP1.md) |
| [#134](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/134) | `src/increment-curve-data.js:160` | Controlled force 999 N with applied force 100 N and reaction -100 N is accepted as a converged row. | [28](opencode-work-orders-2026-10-21/28-RESULTCURVE1.md) |
| [#139](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/139) | `src/opening-loop-candidates.js:51` | Two identical same-winding triangles produce closedShell true with no rejection. | [29](opencode-work-orders-2026-10-21/29-CFDPORT1.md) |
| [#140](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/140) | `src/planar-heat-transfer.js:76` | Finite 1e6 mm edges and 1e308 W/m2 flux overflow into sourceW Infinity and target/balance NaN returned as success. | [30](opencode-work-orders-2026-10-21/30-COUPLE3.md) |
| [#141](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/141) | `src/ui/spherical-region-ui.js:63` | English-generated dynamic status stays English after switching to Japanese. | [37](opencode-work-orders-2026-10-21/37-REG2.md) |
| [#143](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/143) | `src/unilateral-contact-reference.js:54` | Tolerance 1e-30 and maxIterations 1e20 permit stagnation at residual 8.5265e-14 without bounded termination. | [38](opencode-work-orders-2026-10-21/38-CONTACT1.md) |
| [#144](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/144) | `src/curved-pressure-transfer.js:48` | Finite 1e6 mm triangle edges and pressure real1e308 Pa return resultant -Infinity and NaN moment. A 10 mm triangle with finite uz1e308 m returns volume Infinity although expected5e303 m3 is finite, and virtual-work relativeError NaN. | [39](opencode-work-orders-2026-10-21/39-COUPLE4B.md) |
| [#145](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/145) | `src/ui/agent-connection-status-ui.js:96` | With the actual installLanguage scanner, English-start aria-label Connection status notifications switches to Japanese briefly but returns to English on the next scan. | [40](opencode-work-orders-2026-10-21/40-AGENTCHAT1.md) |

head更新時は反例と差分を再確認する。要修正9件のcommitは統合しない。次の20指示は修正9件と次段階11件。

## 検証上の限界

- 限定prototypeと描画stubを実Chrome・一般物理精度の証明としない。親タスクは未完を維持。
- ACPの単独再実行成功を安定性の根治としない。P3のローカルsymlink権限skipはCIと区別。
- 統合初回CIは新資料の英語対不足で1件失敗。相互リンク付き英語版を追加し、次の全体CIは成功。
- 元の利用者ファイルと各ownerの作業場所は変更しない。
