# 利用者機能とAPI・MCP対応表

2026-10-14時点。最大の差別化要因はユーザーのLLMが専門SKILLから全機能を扱えること。以下の不足を最優先で解消する。対応は機能群単位の初期棚卸しであり、全操作の網羅率は未測定。

| 機能群 | 現行共通/ブラウザAPI | 現行MCP | 次の作業 |
|---|---|---|---|
| 対応能力 | studioApi.getCapabilities | studio_capabilities | 必要入力・有効範囲・全組合せへ拡張 |
| 実行組合せ診断 | studioApi.diagnoseExecution | studio_diagnose_execution | 単位・必須値・拘束・メッシュの構造化診断へ拡張 |
| 保存入力の検査・復元 | studioApi.loadProject/exportProject/getSummary | studio_inspect_project（検査） | MCPからの作成・変更・保存 |
| STEP/STL取込 | UIとCAD Worker | 未対応 | ファイル/バイト入力の共通操作 |
| 領域・条件・材料・解析設定 | studioApiの選択・条件・材料・study操作 | 未対応 | 意味的選択と原子的編集・根拠保存 |
| 体積メッシュ・解析 | analysisApi.generateMesh/analyze | studio_analyze（CPU・保存JSON） | 非同期ジョブ・進捗取得・中止 |
| 中間情報 | Worker進捗をUIへ通知 | 未対応 | ジョブID・入力版・連番付きイベント/成果物参照 |
| 中止 | analysisApi.cancel | 未対応 | 独立したMCP中止操作と状態取得 |
| 点測定 | analysisApi.probe | studio_probe（保存結果） | ライブ結果版・暫定値との対応 |
| ケース・比較 | caseApi | studio_validate_cases（保存ケース検査・比較） | MCPの保存・復元・追加・削除・表示 |
| 断面・部品表示 | viewApi | 未対応 | ビュー設定・レイヤー・カメラの共通契約 |
| 時刻・モード選択 | UI | 未対応 | 結果版付きの意味的操作 |
| PNG/WebM・アニメーション | visual-exportのUI処理 | 未対応 | 出力APIとジョブ・中止・成果物取得 |
| CAD更新 | studioApi.previewCadUpdate/applyCadUpdate | 未対応 | MCP取込・照合・再選択 |
| 材料カタログ | カタログUIと共通データ | studio_material_catalog | 仮定と適用条件を含む共通適用操作 |
| 疲労・破壊評価 | analysisApi.evaluateFatigue/evaluateFracture | 専用操作は未対応 | 評価入力と結果の共通契約 |
| 3MF/G-code | printImportApiとUI | 未対応 | 取込・層選択・出力の共通契約 |

専門SKILLは`skills/airpocket-studio/SKILL.md`で現行能力・診断・出典・制限を案内する。新しい操作の追加と同時にSKILLを更新し、例題の成功経路と拒否・修復経路を検証する。現MCPは中間結果や開いているブラウザを取得できない。目標仕様を現行操作として案内しない。

P0は実装中。全行の操作細分化、必要入力/有効範囲、単位付き診断、日英操作対応表、画面での確認は残作業。
