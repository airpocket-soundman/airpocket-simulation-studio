# 利用者機能とAPI・MCP対応表

[English](en/api-coverage.md)

2026-10-14時点。最大の差別化要因はユーザーのLLMが専門SKILLから全機能を扱えること。以下の不足を最優先で解消する。対応は機能群単位の初期棚卸しであり、全操作の網羅率は未測定。

現行の入口は通常31/接続33 MCPツール・88ブラウザ操作、単体connectorは3ツール。後続の過去件数は当時の記録として保持する。今回比較の検証・実ブラウザ・公開完了は保留。

| 機能群 | 現行共通/ブラウザAPI | 現行MCP | 次の作業 |
|---|---|---|---|
| 操作契約の発見 | studioApi.getBrowserOperationContracts | studio_browser_contracts（session不要・最大10件/65,536 UTF-8バイト） | nested適用性・物理検証は実adapterで維持 |
| ライブ接続 | browser-sessionと共有API | 接続モードのstudio_browser_sessions/studio_browser_call（87操作、許可範囲付き） | ローカル実画面でGUIジョブ監視を確認。公開HTTPS接続・再接続を継続 |
| 対応能力 | studioApi.getCapabilities（`combinations`: 実行組合せ規則表から導出した非対応組合せの構造化一覧。id/code/phase/summary/applies/status）、diagnoseExecution/preflight.selectedObservation（観測profile選択） | studio_capabilities、診断/事前検査のselectedObservation・MCP限定runtime | 必要入力・有効範囲・全組合せへ拡張 |
| 実行組合せ診断 | studioApi.diagnoseExecution | studio_diagnose_execution | 単位・必須値・拘束・メッシュの構造化診断へ拡張 |
| 編集候補のプレビュー | studioApi.previewOperations | studio_preview_edit、inspect権限previewEdit | nested物理検証・全P0/P1/P3は継続 |
| 解析前検査・根拠 | studioApi.preflight/setInputProvenance/setAnalysisIntent、analysis実行ゲート | studio_preflight_project、studio_edit_project（根拠とintentの保存） | 残りの物理組合せの必須入力契約、メッシュ後検査との統合 |
| 保存入力の検査・復元 | studioApi.loadProject/exportProject/getSummary/getRevision/applyOperations、builtinProjectApi.create | studio_inspect_project（検査・revision・寸法要約・最大50面ページ）、studio_edit_project（原子的編集・新規保存）、studio_create_builtin_project、接続createBuiltinProject（組込み形状） | 操作細分化と全作成経路の網羅性確認 |
| STEP/STL取込 | UI/CAD Worker、project-import、inputImportApi/Transfer | studio_import_project（保存JSON）、接続inputImportBegin/Write/Commit/Release（STEP/STL） | 対応形状の範囲拡大・大容量実測 |
| 領域・条件・材料・解析設定 | studioApiの選択・条件・材料・study操作、selectCadFace、applyOperations | studio_edit_project（18種、根拠・intent・表示面ID選択を含む、revision競合検出） | 全物理モデルの根拠・入力契約、選択・設定操作の残りの網羅性確認 |
| 体積メッシュ・解析 | guiAnalysisJobs.run、analysisApi.startJob/listJobs/getJob/getJobResult/releaseJob（旧generateMesh/analyzeも互換維持） | studio_analyze、studio_start_analysis/studio_job_status/studio_release_job（CPU・保存JSON） | 公開HTTPS接続・再起動後のジョブ復元 |
| 進捗・メッシュ境界検査 | （MCP専用・保存ファイル基準） | studio_progress（既定は従来形、includeEstimate/includeHistoryは任意）、studio_preflight_mesh_boundaries（成功したmesh-onlyジョブの保持メッシュ、静的線形構造のみ、completePreflightは常にfalse） | 拘束階数・剛体モード・収束・物理精度の検査 |
| 中間情報 | analysisApi.jobEvents/listJobArtifacts/getJobArtifact（熱/音響スカラー・非線形ステップ変位の任意保持） | studio_job_events、studio_job_artifacts（メタデータ一覧）、studio_job_artifact（登録済み成果物のハッシュ照合・要約・部品指定点補間・nodeBodies付き最大200ノード/値のページ） | 全ソルバー観測範囲の拡充、操作細分化・配信契約の完成 |
| 中止 | analysisApi.cancel/cancelJob/isBusy/drainJobs/closeJobsAsync | studio_cancel_job（runningのみ、saving不可） | 接続モードのcancelJobを提供。ローカルGUI監視を確認、公開接続を継続 |
| 点測定 | analysisApi.probe、resultViewApi.probe、window.measurementApi（版・表示状態を固定した履歴） | studio_probe、接続probeとmeasurementの7操作、studio_verify_measurements | 履歴GUI・結果種の検証拡充 |
| ケース・比較 | caseApi/caseOperations/caseArchiveTransfer（ID・内容版・根拠照合・分割転送・v2測定同梱） | studio_validate_cases、接続モードのcaseList/caseSave/caseView/caseRestoreInput/caseRename/caseRemove、caseArchiveExport/caseArchiveRead/caseArchiveImport/caseArchiveWrite/caseArchiveCommit/caseArchiveRelease、caseBundleListと分割転送6操作、studio_validate_case_bundle | 結果間の対応付け・名前付きビューの拡張 |
| 断面・部品表示 | viewApi | 接続モードのgetView/setView | ビュー設定・レイヤー・カメラの共通契約 |
| 結果表示・時刻・モード・カメラ | resultViewApi.get/set/probe、固定色範囲・表示レイヤー | 接続モードのgetResultView/setResultView/probe | 熱の保存時刻場、異なる結果へのビュー同期 |
| 名前付きビュー | namedViewApi.list/save/apply/remove/export/import | 接続モードのnamedViewList/namedViewSave/namedViewApply/namedViewRemove/namedViewExport/namedViewImport | 異なる結果への適用 |
| PNG/WebM・アニメーション | visualExportApi、共有レンダラー | 接続モードのexportCapabilities/startExport/exportStatus/exportArtifact/cancelExport/releaseExport | 永続保存、MP4/GIF、決定的な固定フレーム書き出し |
| CAD更新 | cadUpdateApi.preview/apply（入力・置換版照合）、studioApiの既存操作 | studio_preview_cad_update / studio_apply_cad_update、ライブpreviewCadUpdate / applyCadUpdate | 大きなCADのライブ分割転送、更新後の領域再選択と根拠再確認 |
| 材料カタログ | studioApi.applyCatalogMaterial、適用条件必須のカタログUI | studio_material_catalog、studio_edit_project/接続editのapplyCatalogMaterial | 全材料モデルの適用条件・根拠契約の拡充 |
| 疲労・破壊評価 | resultAssessmentApi.evaluate/get | studio_assess_result/studio_assessment、接続モードevaluateAssessment/getAssessment | 対応物理範囲の拡張、実画面の検証 |
| 3MF/G-code | printOperationsのinspect/import/get/set/export、printTransfer分割転送とUI | studio_import_print/studio_inspect_print、接続printInspect/importPrint/getPrintData/setPrintViewとprintTransferの6操作 | 積層・インフィル物性との解析連携 |

専門SKILLは`skills/airpocket-studio/SKILL.md`で現行能力・診断・出典・制限を案内する。新しい操作の追加と同時にSKILLを更新し、例題の成功経路と拒否・修復経路を検証する。現MCPは保存入力のCPUジョブについて中間要約と任意のメッシュ/時刻場ファイルを取得できるが、接続モードでは許可されたブラウザの87操作も扱う。保持は同一Nodeプロセス内、既定32ジョブ・各256イベント。カーソルの欠落通知、`requestId`の保持中冪等性、暫定ラベル、保存中の中止不可、場保存64 MB上限は[操作仕様](automation.md)を参照。目標仕様を現行操作として案内しない。

P0は実装中。全行の操作細分化、必要入力/有効範囲、単位付き診断、画面での確認は残作業。日英の操作対応表は[操作対応表](operation-correspondence.md)に掲載する（ブラウザ操作とMCPツールを網羅し、テストで照合）。

面IDは表示メッシュのSHA-256版に限定され、STEP/STLとも永続CAD IDではない。CAD更新後の既存根拠は未確認へ戻し、仮定と確認記録を解除して再確認する。

出力ジョブは表示範囲で開始・取消・解放し、確認範囲で能力・状態・base64成果物を取得します。合計32 MiB・4件、最大65,536バイトの分割取得とSHA-256照合を使います。自動ダウンロード・永続保存は行いません。WebMは実時間録画で24 fpsを要求するが実フレーム数は保証せず、保存過渡音響フレームの再生に対応し、固定フレームの決定的出力とMP4/GIFは未対応です。詳細は[操作仕様](automation.md)を参照。

ライブCAD置換JSONは正規の取込済みSTEP表示メッシュに限定し、`kind:"cad"`、`positions`・`faceIds`・`kind`・任意の空でない`sourceHash`だけを許可します。座標はすべてFloat32で正確に表現可能である必要があり、丸めや追加メタデータの削除による自動補正は行いません。保存JSON用MCPはこの制限の対象外です。工学用途では実際のSTEPパスを優先します。

流体領域はwindow.fluidDomainApi.prepare/applyMeshと接続prepareFluidDomain/applyFluidDomainMeshで準備・mesh表示適用を共有する。物性・条件の設定と一般流体ソルバーの範囲は別に確認する。

保存熱/固有ケースの連成源はcaseSourceApi.apply/clearと接続applyCaseSource/clearCaseSourceで版・物理条件を照合する。領域や実振幅の推測は行わない。

表面検査は接続inspectSurfaceとstudio_inspect_project.surfaceInspectionで、版付き・全問題添字ページを取得できる。厳密CAD・自己交差・自動修復は範囲外。

Stokes P1/P2の構造化GMRES残差は既存jobEventsで取得でき、phase/residualKindで前処理実測・推定・最終数値検査を区別する。途中場は追加しない。

調和音響・sweepのBiCGStab残差とfrequency-step開始/完了、channel PCG残差は既存jobEventsで取得できる。profileは13/12件、ツール/ライブ操作数は不変。両経路はfieldsなしで、再帰残差収束を物理精度やジョブ成功と同一視しない。

保存入力ジョブには起動時--analysis-isolation=processの任意子プロセス分離経路を追加。既定workerとブラウザ経路は維持し、runtime失敗の封じ込めはV8根治と区別する。

非legacyの必須入力契約は静的等方・等方固有振動・静的直交異方構造と熱/音響/限定流体を対象とします。固有振動は明示した均一温度で弾性温度表を補間できます。モード数・反復上限は明示必須の数値設定で、物理根拠は要求しません。材料・境界・適用条件の根拠は[契約](automation.md)を参照。legacy挙動とcompletePreflight:falseは維持します。
単位の桁の警告: solve時のpreflightは、固定入力単位（Pa・kg/m3・W/(m*K)・J/(kg*K)・m/s・Hz・N）で妥当域外の0以外の有限値にwarning `UNIT_MAGNITUDE_SUSPECT`を返します（エラーではなく、値の変換・補正はしません。allowedは変わりません）。範囲（絶対値）: youngModulus 1e5〜1e13 Pa、density 0.01〜3e4、conductivity 0.005〜5000、specificHeat 10〜3e4、soundSpeed 50〜2e4、airDensity 0.01〜2e4、frequency 0.1〜1e7、referencePressurePa 1e-9〜1e6、条件値は force 1e-6〜1e9 N、pressure/normalTraction 1e-3〜1e11 Pa、heatFlux 1e-6〜1e9、convection 0.1〜1e6、acousticPressure 1e-9〜1e7。例: 210（GPaの値）は警告、2.1e11は警告なし。表は`src/preflight-unit-magnitude.js`が正本です。`preflight.physicsCoverage`は物理契約ごとの実装済み/未実装検査を列挙し、メッシュ後検査が未実装のためcompletePreflightは全物理でfalseです（熱: 連結成分の拘束、音響: 波長あたり要素数が残課題）。

温度評価・熱応力・小ひずみJ2・圧縮性Neo-Hookeanも非legacy根拠契約の対象です。温度sourceはcaseReferenceの有無によらずmesh/temperatureの値根拠が必要で、元結果の暫定状態が伝播します。荷重履歴と数値設定、対応CPU制限、場snapshotのサイズと真正性の限界は[契約](automation.md)を参照してください。

実行失敗はWorker/共有ホスト/GUIラッパー/ジョブ/MCPでfailure schema1（最大16,384 UTF-8バイト）を保持します。型付き拘束・境界診断と汎用stage fallbackを区別します。job.error.failure、executionError.failure、直接MCP structuredContent.error.failure、任意のdiagnostic eventに対応しますが、到着や原因修復・物理精度は保証しません。従来message/JOB_* codeを維持。profile13/12・ツール27/29・ライブ80操作は変更しません。[仕様](automation.md)を参照してください。

現行は通常30・接続32 MCPツール、ライブ87操作です。studio_browser_contractsでmethod/scope/offset/limitを指定し、schema1の宣言と引数envelope・版・単位・副作用・制限を接続前に取得できます。declarationOnlyであり権限付与・完全JSON Schema検証・adapter利用可能性の保証ではありません。直接操作throwのfailureもHTTP bridge経由で保持し、既存jobStatusと同じ診断形式を維持します。手順は[仕様](automation.md)を参照してください。以前の27/29は当時の追加範囲を示す記録です。

編集プレビューは入力を変えずに変更Pointer（最大100）と候補版・preflightを返し、ファイル保存・解析を行いません。edit/studio_edit_projectの任意expectedResultingRevisionで確認候補との一致を要求できます。通常29/接続31ツール・ライブ81操作。preflight.allowed:falseも診断結果として返し、計算中の設定案検査は実行中ジョブを変更しません。[手順](automation.md)を参照してください。以前の件数は各追加時の記録です。

プレビューは完全検査のallowed/provisionalを保ち、診断50件・根拠Pointer100件へ縮約し省略総数を明示します。返却value JSONは65,536 UTF-8バイトまで。ブラウザのnormalization.requiresReview時はGUI共用表現変換を確認し、最終候補版だけを確定してください。Node保存入力の候補版とは異なる場合があります。

入力値の検査はstudioApi.inspectInput/ライブinspectInput（inspect権限）とstudio_inspect_projectのsection opt-inに対応。section内Pointerと入力版で物性・study・条件・根拠・選択・source・mesh等を最大50 object/200 array・文字列UTF-16 unitsずつ取得し、nested payloadはcount/canonical-JSON hashへ要約します。応答valueは65,536 UTF-8バイト上限。既知単位のみ返し、旧section無しの無制限study応答とは混載しません。通常29/接続31ツール・ライブ82操作。CAS例と互換制限は[仕様](automation.md)を参照してください。

## 保存ケース比較の今回追加（検証記録は保留）

共通 `createCaseComparisonApi({cases}).compare`、ブラウザinspect操作 `caseCompare`、MCP `studio_compare_cases` で、保存ケースの同一点を表示変更せず比較する。1〜8件のcase revisionを固定し、任意のmm全体座標を測定する。モード/保存フレームを明示し、モード正規化形状の差分や時間補間は行わない。応力Pa・塑性ひずみ比率1など、生値のunitsを返す。kind/field/unit/time/frequencyの非互換は差分不能理由として返し、不正ケース・未知部品・stale lease/guardは全体拒否する。

MCPはversion 1保存ケースarchiveを対象とし、references省略のpath-only呼出でsnapshot内IDとcase/archive revisionを列挙する。比較ではexpectedArchiveRevision必須、元ファイルhashを読取前後で確認する。bundleは対象外。共通応答とMCP応答のJSON値は64KiB上限で、MCP wire包装全体の上限ではない。計算時runtimeIdentityの未記録を現在の環境で補完しない。詳細は[自動操作](automation.md)。今回の成功件数・実ブラウザ・公開完了は検証待ちで、P0〜P6の完了は未達。

過渡結果は保存物理時刻の完全一致のみ比較可能（補間・許容誤差なし）。SPLで `referencePressurePa` が異なる場合は `different-reference-pressure` で差分なし。Paの生圧力は基準圧が異なっても比較できる。
