# 全体タスク監査と完了への経路

[English](en/task-critical-path.md)

2026-10-18時点、167件のうち公開済み130件、未完37件。以下は優先判断であり、実装/検証なしに状態を進める根拠ではない。

| 分類 | 既存ID | 条件 |
|---|---|---|
| 自律実装・検証可能（17） | REG2, CFDMESH1, COUPLE3, CONTACT1, COUPLE4B, CFDPORT1, PERF1, UIRESEARCH1, UIIMPROVE1, AGENTINPUT1, VIEWCOMPARE, VIEWTIME, BROWSEREXPORT1, CFDRESEARCH2, CFDRESEARCH3, EXPORTBACKGROUND1, BROWSERRESET1 | 物理分野の大規模実装も含むため、1回で完了できる意味ではない。実機測定条件が不足すれば未完を維持。 |
| 外部・実機等の条件あり（7） | PRINT2, PRINTMEASURE1, PRINTMEASURE2, PRINTMEASURE3, RUNTIMEWASM1, MCPARGUMENTTYPES1, PUBLICHTTPS1 | 試作/材料実測、V8再現/上流修正、登録済SDK確認、ブラウザ版を含む公開接続証拠が必要。ソフト側で独立して進められる部分は待たず進める。 |
| 親エピック（15） | MESH1, CFD1, COUPLE1, FAIL1, CFD2, CFD3, COUPLE5, MOD1, P0, P1, P2, P3, P4, P5, P6 | 子機能の公開だけで全体完了にしない。既存受入条件と共通完了判定を維持。 |

## 依存と今回のまとまり

P0→P1→P3、およびP0→P4が公開ワークフローの主要経路。P5はP1/P2/P3/P4すべてに依存する。公開マイルストーンは6ゲート中5ゲートが未完で、完了済みゲートも候補固有の証拠である。最終候補を揃えず製品全体の公開完了とはしない。

今回は比較の小機能追加を止め、接続resetの有界診断/明示復旧（BROWSERRESET1）、背景動画の有限取消/解放（EXPORTBACKGROUND1）、実Chromeでの性能/メモリ観測可能性/取消実測（PERF1）を並行準備し、CPU負荷のある検証は直列実施する。終了条件を満たす項目だけを閉じる。他ブラウザ・peak RAM・対応上限が未測定ならPERF1全完了にしない。

次のまとまりはP3の再起動requestId冪等性/実MCP再起動と、P0/P1/Skill一巡の残条件。背景出力とresetの原因は同一視せず、成功した再試行だけで根治扱いしない。今回タスクは増設せず、完了数は受入証拠に従う。

今回結果: BROWSERRESET1とPUBLICHTTPS1は8c57e16の公開証跡と実Chromeの確認専用接続の合格によりreleased。内訳は公開済130/queued20/building12/checking5/ready0。EXPORTBACKGROUND1は実hidden操作をCUAで実証できず、利用者の手動協力回答待ちでchecking。PERF1は構造3サイズのみ測定、熱reset/timeoutとメモリ/他browser未測定でbuilding。RUNTIMEWASM1は初回全体試験のNode24 V8 fatalと単独成功を分離してchecking維持。最終CIの成功は根治証明ではありません。[公開記録](evidence/2026-10-18-publication-8c57e16.json)を参照。親と公開ゲートは閉じません。
