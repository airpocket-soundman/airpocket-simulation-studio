# 全体タスク監査と完了への経路

[English](en/task-critical-path.md)

2026-10-18時点、167件のうち公開済み130件、未完37件。以下は優先判断であり、実装/検証なしに状態を進める根拠ではない。

| 分類 | 既存ID | 条件 |
|---|---|---|
| 自律実装・検証可能（15） | REG2, CFDMESH1, COUPLE3, CONTACT1, COUPLE4B, CFDPORT1, PERF1, UIRESEARCH1, UIIMPROVE1, AGENTINPUT1, VIEWCOMPARE, VIEWTIME, BROWSEREXPORT1, CFDRESEARCH2, CFDRESEARCH3 | 物理分野の大規模実装も含むため、1回で完了できる意味ではない。実機測定条件が不足すれば未完を維持。 |
| 外部・実機等の条件あり（7） | PRINT2, PRINTMEASURE1, PRINTMEASURE2, PRINTMEASURE3, RUNTIMEWASM1, MCPARGUMENTTYPES1, EXPORTBACKGROUND1 | 試作/材料実測、V8再現/上流修正、登録済SDK確認、ブラウザ版を含む公開接続証拠が必要。ソフト側で独立して進められる部分は待たず進める。 |
| 親エピック（15） | MESH1, CFD1, COUPLE1, FAIL1, CFD2, CFD3, COUPLE5, MOD1, P0, P1, P2, P3, P4, P5, P6 | 子機能の公開だけで全体完了にしない。既存受入条件と共通完了判定を維持。 |

## 依存と今回のまとまり

P0→P1→P3、およびP0→P4が公開ワークフローの主要経路。P5はP1/P2/P3/P4すべてに依存する。公開マイルストーンは6ゲート中5ゲートが未完で、完了済みゲートも候補固有の証拠である。最終候補を揃えず製品全体の公開完了とはしない。

今回は比較の小機能追加を止め、接続resetの有界診断/明示復旧（BROWSERRESET1）、背景動画の有限取消/解放（EXPORTBACKGROUND1）、実Chromeでの性能/メモリ観測可能性/取消実測（PERF1）を並行準備し、CPU負荷のある検証は直列実施する。終了条件を満たす項目だけを閉じる。他ブラウザ・peak RAM・対応上限が未測定ならPERF1全完了にしない。

次のまとまりはP3の再起動requestId冪等性/実MCP再起動と、P0/P1/Skill一巡の残条件。背景出力とresetの原因は同一視せず、成功した再試行だけで根治扱いしない。今回タスクは増設せず、完了数は受入証拠に従う。

今回結果: BROWSERRESET1とPUBLICHTTPS1は8c57e16の公開証跡と実Chromeの確認専用接続の合格によりreleased。内訳は公開済130/queued20/building12/checking5/ready0。EXPORTBACKGROUND1は実hidden操作をCUAで実証できず、利用者は今は操作不可のため手動検証待ちでchecking。PERF1は構造3サイズのみ測定、熱reset/timeoutとメモリ/他browser未測定でbuilding。RUNTIMEWASM1は初回全体試験のNode24 V8 fatalと単独成功を分離してchecking維持。最終CIの成功は根治証明ではありません。[公開記録](evidence/2026-10-18-publication-8c57e16.json)を参照。親と公開ゲートは閉じません。

## 2026-10-18 次バッチの実装・実行証拠

P3は復元requestIdの安全拒否を追加し、実MCP再起動後の同一/変更再送、新ID、明示解放後の再利用を検証しました。[証拠](evidence/2026-10-18-mcp-restart-request.json)。これは結果復元や要求内容照合の完全冪等性ではありません。P0/P1/P4は[一巡手順](../skills/airpocket-studio/references/skill-loop.md)と[実MCP証拠](evidence/2026-10-18-skill-loop-real-mcp.json)を追加。100/200 Nの変位0.04/0.08 mm、比較PNG/ケース集のhash、出力後4状態保持を確認しました。初稿の設定補完と応答wrapper不足を修復した実行で、最終手順の独立fresh再現は残作業です。既存親ID内の進展として計上し、総数167・公開済み130・残37と各親の未完状態を維持します。

独立fresh評価ではローカル画面起動の記載不足を検出して修復。修正版でVite起動と実MCP33ツール発見まで進みましたが、Windowsの対象URL確認ができず画面操作の自動承認で停止しました。製品操作0・所有サービス停止済みで、[独立評価](evidence/2026-10-18-skill-loop-independent.json)は未合格です。接続準備を完了した後の独立一巡を残作業として維持します。

## 2026-10-18: 入力検査と復旧導線の実装

モーダルの不正局所frame/方向不一致を事前拒否し、モーダル/直交異方性で無効支持を数えないようsolver規則に整合しました。復元jobIdを失ってもstudio_restored_jobsで有界再発見し、取得可能性と明示nextStepsを返します。保存caseの仮定詳細はstudio_inspect_caseでarchive/case/input版を固定してbounded取得します。[検証](evidence/2026-10-18-input-recovery-verification.json)、[再測定](evidence/2026-10-18-saved-case-remeasurement.json)、[正式MCPの32仮定取得](evidence/2026-10-18-saved-case-input-stdio.json)。新たな物理閾値を追加せず親/gate未完を維持。ブラウザへのcase復元、不明build版、Skill独立一巡は未完。背景手動確認は利用者が今は操作不可のため待機です。

現在の残37件は自律15・外部/手動条件7・親15。EXPORTBACKGROUND1は実hidden確認に手動操作が必要で利用者が今は対応不可のため外部/手動群へ移し、停止監視の公開と受入未完を分離します。

## 2026-10-18: 保存入力復元と再解析

studio_restore_case_inputは全archive検証・archive/case/input版固定・元bytes再照合の後、元入力を新projectへ原子的/上書き禁止で書出します。[正式MCP一巡](evidence/2026-10-18-case-input-restore-real-mcp.json)で2caseの入力/根拠保持と別解析を確認し、同一点vector/magnitudeは0.04/0.08mmで元保存値と厳密一致。旧browser build不明を維持し新Node dirty実行版と分離記録。ブラウザscene/結果復元・一般物理精度の証明ではありません。

熱のinitialTemperature/放射反復数を既存solver拒否と整合し、関連4分野31試験成功。MCPの全tool名期待を共通化し件数だけの重複保守を解消。full entry既定34/接続36、live91は不変。既存P0/P1/P4/MOD1/AGENTINPUT1内の進展として公開済130/残37を維持し、背景手動・Skill独立一巡・公開gateは未完を追跡します。

## 2026-10-18: 新解析結果の保存と再読込

[正式MCP証拠](evidence/2026-10-18-result-archive-real-mcp.json)で入力復元→2Node解析→SHA固定studio_archive_results保存→別process検証/一覧/同一点比較を一巡。[新archive](evidence/2026-10-18-node-result-archive.json)は241900bytes・rawSHA8f01a5332d1cb7891cca693c1b54c4eb60f60fef102004a156f9eec9540ded31、0.04/0.08mm・比2。元SHA不変、上書き/旧SHA拒否を確認。保存元build不明と新Node dirty版を分離。合計/生成100MB境界は未実測、既存case-store予算も適用。一般精度・ブラウザ復元・親/gate完了の証明ではありません。

音響の明示刻みで60000step超が確定する場合はsolver規則でmesh前に拒否し、overflowもJSON-safe診断。自動刻み/mesh依存仕事量は別確認。既定35/接続37、live91、公開130/残37を維持し背景手動確認は待機です。
