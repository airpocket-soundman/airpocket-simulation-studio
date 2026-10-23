# 未完検証の再照合（2026-10-23）

[English](en/verification-followup-reconciliation-2026-10-23.md)

固定参照は 7df5c68。PR185〜188の記録済みCI成功までを照合し、PR189は進行中として扱う。PR184以降の限定実装・監査を含むが、公開成功や親タスク完了を意味しない。[機械可読証拠](evidence/2026-10-23-verification-followup-reconciliation.json)に原本hashと全37件の親受入条件を保持した。実行・ソルバー起動・進捗変更は行っていない。

## 閉じた限定検証

- 正式stdioの停止・再起動・metadata-only取得拒否・新要求、曲線DOM Blob全bytes/hashとstdioの一致、fresh Skill70保存曲線一巡。[実行結果](verification-completion-2026-10-23.md)。
- Windows全件と固定frame再実行、63/64/65の容量・独立数値・型検査。ランタイム原因解消や一般物理精度の保証ではない。[固定候補棚卸し](verification-inventory-2026-10-23.md)。
- MOD1の取消・所有権・再入修正と回帰。[export分離証拠](evidence/2026-10-23-export-isolation-validation.json)。
- PRINT2の実main390px、日英、project bytes/revision不変とBack/reload。実bfcacheは未観測。[実画面証拠](evidence/2026-10-23-print2-main-browser.json)。
- [PR185](evidence/2026-10-23-pr185-final-validation.json)・[PR186](evidence/2026-10-23-pr186-final-validation.json)・[PR187](evidence/2026-10-23-pr187-final-validation.json)・[PR188](evidence/2026-10-23-pr188-final-validation.json)の候補CI/build/local asset検査。PR187の旧失敗原因は未解消。PR185のnative証拠は対象source hashの範囲に限定し、後続headの新実行とは呼ばない。

## まだ実行していない既存機能の検証

| ID | 残る検証と証拠の限界 |
|---|---|
| EXPORTBACKGROUND1 | 実録画中の失効を日英×通常/背景/非選択で確認し、元表示/版の復元・部分成果物拒否・lock解放を照合。[10/23失効統合](evidence/2026-10-23-export-expiry-integration.json)は模擬recorder/hidden。[10/22実Chrome](evidence/2026-10-22-review45-real-chrome.json)の実hidden成功は失効行列全体ではない。 |
| VIEWCOMPARE | 新GIFのframe/panel時刻manifestの実画面照合、実音響time WebM、GUI保存完了bytes/hash、録画中実切断。[直近実Chrome](evidence/2026-10-22-review51-real-chrome.json)と tests/comparison-frame-timing.test.mjs を混同しない。 |
| VIEWTIME | 既存熱/音響履歴の全体peak RAM。[保存再読込/MCP一致](evidence/2026-10-21-review49-chrome-mcp.json)や[tiny計測](evidence/2026-10-23-perf-idle.json)だけでは満たさない。 |
| AGENTINPUT1 | 既存3成分警告案内の正式paired browser MCP照合と可視focus画像、入力作成→preflight→中間取得のSkill一巡。[旧実画面証拠](evidence/2026-10-21-review46-chrome.json)はMCP未使用・画素未取得を明示。Skill70は保存曲線に限定。 |
| REG2 | 円錐終端半径空欄の条件文。空欄は radiusAtMax 省略＝円筒指定であり円錐推測ではない。[旧実画面証拠](evidence/2026-10-16-ui-features-real-chrome.json)、[仕様](cylindrical-cad.md)。 |
| RESULTCURVE1 | 実保存全bytes/hash・拡大リンク遷移・main project/result/case版比較。[390px証拠](evidence/2026-10-23-curve-layout-browser.json)はisolated表示まで。 |
| PERF1 | 同条件の実Chrome2規模cold/warm/取消再計測と利用可能な第2browser。idle分離・UASM不足理由を保持。[既存計測](evidence/2026-10-23-perf-idle.json)。 |

REG2/AGENTINPUT1のroot担当IAB検証は予定段階で、成功を先取りしない。IAB証拠を得てもbranded Chrome・正式pairing・実録画の未確認条件を自動的に閉じない。

## 追加実装・実測・公開条件

solver離散面流束の取得機構、一般UV矩形、WebM個別panel時刻/MP4、本番AI transport/認証/接続、全物理preflight、一般非線形構造履歴は追加実装として区別する。一般形状精度・実測材料・装置校正・独立実験は数値研究/外部実測条件である。公開HTTPSは当該候補のmerge/配信manifest一致と実一巡を要し、候補CI/local検査を公開成功へ読み替えない。

## 全37未完IDを維持

171件中released134・queued12・building21・checking4。下記状態と親受入は原本のまま。[歴史inventory](verification-inventory-2026-10-23.md)は5647a6f、[旧候補照合](evidence/2026-10-23-order71-candidate-9594884.json)は9594884の固定記録であり、本追補で上書きしない。

| ID | 原本状態 |
|---|---|
| MESH1 | queued |
| REG2 | building |
| CFD1 | building |
| COUPLE1 | queued |
| FAIL1 | queued |
| CFDMESH1 | building |
| CFD2 | queued |
| CFD3 | queued |
| COUPLE3 | building |
| COUPLE5 | queued |
| CONTACT1 | building |
| PERF1 | building |
| PRINT2 | building |
| COUPLE4B | building |
| CFDPORT1 | building |
| MOD1 | building |
| P0 | building |
| P1 | building |
| P2 | queued |
| P3 | building |
| P4 | building |
| P5 | queued |
| P6 | building |
| UIIMPROVE1 | building |
| AGENTINPUT1 | checking |
| VIEWCOMPARE | building |
| VIEWTIME | building |
| PRINTMEASURE1 | queued |
| PRINTMEASURE2 | queued |
| PRINTMEASURE3 | queued |
| BROWSEREXPORT1 | checking |
| RUNTIMEWASM1 | checking |
| EXPORTBACKGROUND1 | checking |
| AGENTACP1 | building |
| AGENTCHAT1 | building |
| RESULTCURVE1 | building |
| FINITEVISCO1 | queued |
