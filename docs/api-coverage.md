# 利用者機能とAPI・MCP対応表

[English](en/api-coverage.md)

2026-10-14時点。最大の差別化要因はユーザーのLLMが専門SKILLから全機能を扱えること。以下の不足を最優先で解消する。対応は機能群単位の初期棚卸しであり、全操作の網羅率は未測定。

| 機能群 | 現行共通/ブラウザAPI | 現行MCP | 次の作業 |
|---|---|---|---|
| ライブ接続 | browser-sessionと共有API | 接続モードのstudio_browser_sessions/studio_browser_call（49操作、許可範囲付き） | 公開HTTPS接続・再接続・GUIジョブ監視の実画面確認 |
| 対応能力 | studioApi.getCapabilities | studio_capabilities | 必要入力・有効範囲・全組合せへ拡張 |
| 実行組合せ診断 | studioApi.diagnoseExecution | studio_diagnose_execution | 単位・必須値・拘束・メッシュの構造化診断へ拡張 |
| 解析前検査・根拠 | studioApi.preflight/setInputProvenance/setAnalysisIntent、analysis実行ゲート | studio_preflight_project、studio_edit_project（根拠とintentの保存） | 静的等方線形構造以外の必須入力契約、メッシュ後検査との統合 |
| 保存入力の検査・復元 | studioApi.loadProject/exportProject/getSummary/getRevision/applyOperations | studio_inspect_project（検査・revision・寸法要約・最大50面ページ）、studio_edit_project（原子的編集・新規保存）、studio_create_builtin_project（組込み形状） | 操作細分化と全作成経路の網羅性確認 |
| STEP/STL取込 | UI/CAD Worker、project-import共通作成関数 | studio_import_project（STEP/STP、明示単位倍率付きSTL、新規JSON保存） | ブラウザ側の共通取込経路拡充、対応形状の範囲拡大 |
| 領域・条件・材料・解析設定 | studioApiの選択・条件・材料・study操作、selectCadFace、applyOperations | studio_edit_project（17種、根拠・intent・表示面ID選択を含む、revision競合検出） | 全物理モデルの根拠・入力契約、選択・設定操作の残りの網羅性確認 |
| 体積メッシュ・解析 | guiAnalysisJobs.run、analysisApi.startJob/listJobs/getJob/getJobResult/releaseJob（旧generateMesh/analyzeも互換維持） | studio_analyze、studio_start_analysis/studio_job_status/studio_release_job（CPU・保存JSON） | 公開HTTPS接続・再起動後のジョブ復元 |
| 中間情報 | analysisApi.jobEvents/getJobArtifact（任意のブラウザ内場保持） | studio_job_events、studio_job_artifact（登録済み成果物のハッシュ照合・要約・点補間・最大200ノード/値のページ） | 全ソルバー観測範囲の拡充、操作細分化・配信契約の完成 |
| 中止 | analysisApi.cancel/cancelJob | studio_cancel_job（runningのみ、saving不可） | 接続モードのcancelJobを提供。GUIジョブ監視の実画面確認を継続 |
| 点測定 | analysisApi.probe、resultViewApi.probe（結果版・表示時刻/モード付き） | studio_probe、接続モードのprobe | 測定履歴と固定結果参照の永続化 |
| ケース・比較 | caseApi/caseOperations/caseArchiveTransfer（ID・内容版・根拠照合・分割転送） | studio_validate_cases、接続モードのcaseList/caseSave/caseView/caseRestoreInput/caseRename/caseRemove、caseArchiveExport/caseArchiveRead/caseArchiveImport/caseArchiveWrite/caseArchiveCommit/caseArchiveRelease | 名前付きビューのケース同梱 |
| 断面・部品表示 | viewApi | 接続モードのgetView/setView | ビュー設定・レイヤー・カメラの共通契約 |
| 結果表示・時刻・モード・カメラ | resultViewApi.get/set/probe、固定色範囲・表示レイヤー | 接続モードのgetResultView/setResultView/probe | 熱の保存時刻場、異なる結果へのビュー同期 |
| 名前付きビュー | namedViewApi.list/save/apply/remove/export/import | 接続モードのnamedViewList/namedViewSave/namedViewApply/namedViewRemove/namedViewExport/namedViewImport | ケース集への同梱、異なる結果への適用 |
| PNG/WebM・アニメーション | visualExportApi、共有レンダラー | 接続モードのexportCapabilities/startExport/exportStatus/exportArtifact/cancelExport/releaseExport | 永続保存、MP4/GIF、決定的な固定フレーム書き出し |
| CAD更新 | cadUpdateApi.preview/apply（入力・置換版照合）、studioApiの既存操作 | studio_preview_cad_update / studio_apply_cad_update、ライブpreviewCadUpdate / applyCadUpdate | 大きなCADのライブ分割転送、更新後の領域再選択と根拠再確認 |
| 材料カタログ | カタログUIと共通データ | studio_material_catalog | 仮定と適用条件を含む共通適用操作 |
| 疲労・破壊評価 | resultAssessmentApi.evaluate/get | studio_assess_result/studio_assessment、接続モードevaluateAssessment/getAssessment | 対応物理範囲の拡張、実画面の検証 |
| 3MF/G-code | printOperationsのinspect/import/get/set/exportとUI | studio_import_print/studio_inspect_print、接続printInspect/importPrint/getPrintData/setPrintView | 大きなライブ入力の分割転送、積層・インフィル物性との解析連携 |

専門SKILLは`skills/airpocket-studio/SKILL.md`で現行能力・診断・出典・制限を案内する。新しい操作の追加と同時にSKILLを更新し、例題の成功経路と拒否・修復経路を検証する。現MCPは保存入力のCPUジョブについて中間要約と任意のメッシュ/時刻場ファイルを取得できるが、接続モードでは許可されたブラウザの49操作も扱う。保持は同一Nodeプロセス内、既定32ジョブ・各256イベント。カーソルの欠落通知、`requestId`の保持中冪等性、暫定ラベル、保存中の中止不可、場保存64 MB上限は[操作仕様](automation.md)を参照。目標仕様を現行操作として案内しない。

P0は実装中。全行の操作細分化、必要入力/有効範囲、単位付き診断、日英操作対応表、画面での確認は残作業。

面IDは表示メッシュのSHA-256版に限定され、STEP/STLとも永続CAD IDではない。CAD更新後の既存根拠は未確認へ戻し、仮定と確認記録を解除して再確認する。

出力ジョブは表示範囲で開始・取消・解放し、確認範囲で能力・状態・base64成果物を取得します。合計32 MiB・4件、最大65,536バイトの分割取得とSHA-256照合を使います。自動ダウンロード・永続保存は行いません。WebMは実時間録画で24 fpsを要求するが実フレーム数は保証せず、保存過渡音響フレームの再生に対応し、固定フレームの決定的出力とMP4/GIFは未対応です。詳細は[操作仕様](automation.md)を参照。

ライブCAD置換JSONは正規の取込済みSTEP表示メッシュに限定し、`kind:"cad"`、`positions`・`faceIds`・`kind`・任意の空でない`sourceHash`だけを許可します。座標はすべてFloat32で正確に表現可能である必要があり、丸めや追加メタデータの削除による自動補正は行いません。保存JSON用MCPはこの制限の対象外です。工学用途では実際のSTEPパスを優先します。
