# MCPと専用skill

[English](en/automation.md)

`npm run mcp`はローカル標準入出力のMCPサーバーを起動します。[MCP 2025-11-25のツール仕様](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/server/tools.mdx)に対応し追加ライブラリは不要です。初回は`npm ci`と`npm run build`でWASMを準備してください。

31ツール: `studio_capabilities`、`studio_browser_contracts`、`studio_preview_edit`、`studio_diagnose_execution`、`studio_material_catalog`、`studio_progress`、`studio_inspect_project`、`studio_edit_project`、`studio_import_project`、`studio_create_builtin_project`、`studio_preflight_project`、`studio_preflight_mesh_boundaries`、`studio_analyze`、`studio_probe`、`studio_validate_cases`、`studio_validate_case_bundle`、`studio_verify_measurements`、`studio_compare_cases`、`studio_job_artifact`、`studio_job_artifacts`、`studio_assess_result`、`studio_assessment`、`studio_preview_cad_update`、`studio_apply_cad_update`、`studio_import_print`、`studio_inspect_print`と、下記5つのジョブ操作。ファイルパスは絶対パスを使います。解析は新規`outputPath`へ完全な結果JSONを保存し、要約を返します。入力・既存出力は上書きしません。ブラウザと同じWorkerを独立したNode workerで実行し、計算は120秒の制限があります。Airpocket CPUとMFEMに対応し、WebGPUは対象外です。

現行の入口は通常31/接続33 MCPツール、88ブラウザ操作です。単体connectorは3ツールを維持し、後続の過去件数は当時の記録です。今回比較の検証・実ブラウザ・公開完了は保留です。

`studio_import_project({path,outputPath,scaleToMm?,name?})`はSTEP/STPをOCCTでmmへ正規化し、元STEPとCAD面対応を保持した入力JSONを新規保存します。STLには正の`scaleToMm`が必須で、現行は外向き・閉・凸の単一シェルと既存サイズ制限に従います。入力ファイル上限は50 MiBです。`studio_create_builtin_project({source,outputPath,name?})`はmm指定の`box`（bounds）、`boxes`（boxes）、固定寸法`cylinder`（kindのみ）、`sphere`（center/radius）、`tube`（center/axis/innerRadius/outerRadius/length）を作成します。材料値や支持・荷重は自動で確定しません。

## 保存入力の一括編集

`studio_inspect_project({path,meshIndex?,faceOffset?,faceLimit?})`は既定で全体のmm寸法・三角形数・面数を小さな要約として返します。`meshIndex`を指定すると、面ID順のページ（既定20、最大50）で面積・重心・境界寸法・平均法線を取得できます。面の分類は推測しません。`displayMeshRevision`（SHA-256）と面IDスコープを記録し、`selectCadFace(mesh,faceId)`で対応する表示面群を選択します。STEPを含め面IDは表示メッシュ版の範囲に限定され、形状/対応変更を越える永続CAD IDではありません。STLは三角形または再メッシュ面タグです。

`studio_inspect_project({path})`が返す`revision`を`expectedRevision`として、`studio_edit_project({path,outputPath,expectedRevision,operations:[{method,args}]})`へ渡します。1〜100操作を作業用コピーに一括適用し、すべて成功した場合だけ新規`outputPath`に保存します。古い版・未対応操作・不正入力は拒否し、元入力と既存出力は上書きしません。戻り値は新旧revisionと保存先・要約を含みます。検査revisionは入力JSONのキー順に依存しないハッシュで、ジョブの正規化入力`inputRevision`と同一とは限りません。

対応methodは`selectTriangles`、`selectCadFace`、`selectPlanarRegion`、`selectCylindricalRegion`、`clearSelection`、`addCondition`、`removeCondition`、`selectCondition`、`replaceConditionRegion`、`reapplyConditionRegion`、`setMaterial`、`setMaterialProperties`、`setMaterialPreset`、`applyCatalogMaterial`、`setStudy`、`setMeshSettings`、`addSelectedMeshRefinements`、`setInputProvenance`、`setAnalysisIntent`。`args`には同名の`studioApi`操作の位置引数を配列で渡します。例: `operations:[{"method":"setMeshSettings","args":[{"refinements":[{"center":[5,5,20],"radius":5,"size":2}]}]}]`。`setInputProvenance`は下記根拠document、`setAnalysisIntent`は`{mode:"quantitative"|"exploratory"}`を引数に取ります。全物理モデルの根拠・必須入力契約の網羅は未完了です。

追加の`selectCadFace`と`applyCatalogMaterial`を含め計18メソッドです。例: `operations:[{"method":"selectCadFace","args":[0,2]}]`。CAD更新では既存根拠entryを`unconfirmed`・`assumption:null`へ戻し、confirmationを削除します。更新後は領域と根拠を再確認してください。

ブラウザでは`await studioApi.getRevision()`と`await studioApi.applyOperations(operations,{expectedRevision})`を使います。検証完了後に一度だけ反映し、処理中に入力が変更された場合も競合として拒否します。MCPの保存入力編集は開いているブラウザを変更しません。

## 根拠・仮定と解析前検査

`studio_preflight_project({path,method?,operation?,mode?})`で実行前の診断、`requiredPointers`、`allowed`、`provisional`、残検査を取得します。ブラウザは`studioApi.preflight(options,runtime)`を使います。根拠とintentを一括編集で登録して再検査し、`allowed:true`になってから解析します。Node・ブラウザの実行も同じ検査でゲートします。保存結果の`output.analysisAssessment`と`result.analysisAssessment`にmode・暫定状態・残検査を引き継ぎます。

保存場所は`project.analysisIntent={mode:"quantitative"|"exploratory"}`と`project.inputProvenance={schemaVersion:1,entries:[...]}`です。根拠entryは`pointer`（JSON Pointer）、入力値の`value`スナップショット、`source:{kind,reference?,revision?}`、`rationale`、`applicability`、`assumption:null|string`、`status:"confirmed"|"unconfirmed"`を持ちます。出所kindは`user-input`、`measured-document`、`cad`、`agent-proposal`。資料・CADには参照先と版が必須です。エージェント提案の確認済み扱いには`confirmation:{by:"user",note:"..."}`も必要で、LLMの確信度は根拠になりません。値が変わった古い根拠は`PROVENANCE_STALE`として拒否します。

静的な等方線形構造の契約は、材料のヤング率・ポアソン比、study kind・重力有無、全支持/荷重条件のtype・value・direction・regionsと存在する局所座標/平面/円筒定義を必須根拠とします。重力有効時は加速度と密度も必要です。検査結果の`requiredPointers`を取得し、それぞれに実際の出所と値を記録してください。単位は形状/変位mm、ヤング率/圧力Pa、力N、密度kg/m3、重力m/s2です。自動的な単位変換や資料の真偽検証は行いません。

`quantitative`は未確認必須値を拒否します。`exploratory`は値と明示的な仮定が記録された未確認入力を暫定として扱えます。空値・不正入力・古い根拠は仮定で回避できません。根拠とintentのない旧入力は`legacy`として新しい根拠登録を必須にしませんが、不足物性を補完せず、確認済み定量評価にも昇格しません。legacyでも実行に必要なヤング率・ポアソン比等が欠ければ`MATERIAL_REQUIRED`エラーです。重力指定のない旧入力では従来通り重力ゼロです。他の物理/材料モデルの新モード契約は未整備なら`PREFLIGHT_CONTRACT_LIMITED`を返します。検査成功でも`completePreflight:false`で、メッシュ生成後の品質・境界転送・剛体モード/拘束ランクと物理的妥当性の確認が必要です。

ケース復元・保存結果の検査ではassessmentを保存入力から再検証します。modeや暫定状態を偽って非暫定にしたアーカイブは拒否します。旧アーカイブのassessmentなし互換は維持します。

## 非同期ジョブと中間結果

`studio_start_analysis`へ`path`、新規`outputPath`、必須`requestId`（1〜200文字）と任意の`operation: "solve" | "mesh"`、`size`、`method`、`adaptive`、`includeFields`を渡します。入力を固定し、`jobId`と正規化済み入力のSHA-256による`inputRevision`を即時返します。同じ`requestId`・同じ入力/設定/出力先の再送は保持中の同じジョブを返し、異なる内容での再利用は拒否します。

- `studio_job_status({jobId})`: `running`、`saving`、`succeeded`、`failed`、`cancelled`、`timed_out`と最終成果物の要約を取得。
- `studio_job_events({jobId,afterSequence,limit})`: 連番カーソル以降の差分イベントを取得（既定50、最大100件）。返された`nextSequence`を次回の`afterSequence`に使用し、`hasMore`なら残りを取得。空ページは完了を意味しません。
- `studio_cancel_job({jobId})`: 実行中Workerを中止。終端状態は変更せず、最終ファイル公開中の`saving`状態は中止できません。
- `studio_release_job({jobId})`: 終端ジョブのメタデータ・イベント・`requestId`を解放。保存ファイルは残ります。解放後の同じ`requestId`は新規実行になり得ます。

ジョブは既定では同一MCP/Nodeプロセス内だけ保持し、再起動を越えた再接続や復元は行いません。既定で最大32ジョブ・各256イベントを保持します。古いイベントが落ちると`truncated:true`と`firstAvailableSequence`を返します。欠落を推測で埋めず、状態と利用可能な成果物を確認してください。直接Nodeから呼ぶ場合も同一プロセスを維持します。`studio_analyze`は従来の最終応答型操作です。
任意の`node scripts/studio-mcp.mjs --job-store=<絶対パスのディレクトリ>`（既定は無効で挙動は不変）を指定すると、ジョブごとに小さな記録（jobId・inputRevision・operation・requestId・state・時刻・短縮したエラー要約・結果ファイルのサイズとSHA-256）を一時ファイル+renameで原子的に書き、起動時に読み込みます。ディレクトリは明示的な絶対パスで`..`を含まず、無ければ空で作成します。記録は1件8192バイト、最大256件で、破損・超過・ファイル名不一致の記録は診断（標準エラー）を出して無視し、起動は失敗しません。結果本体・イベント・中間成果物・プロジェクト・出力パスは保存しないため、再起動後のジョブは`restored:true`・`resultAvailable:false`のメタデータのみで、イベントは空、成果物とメッシュ出力は取得できません（終端状態は記録どおり）。再起動時に`running`/`saving`だった記録は`state:'interrupted'`（`error.code:ANALYSIS_JOB_INTERRUPTED_BY_RESTART`、`executionSettled:true`、`releaseAllowed:true`）になり、再開も再実行もしません。`studio_release_job`は記録も削除します。再起動後のrequestId冪等性は保証しません。ツール27/接続29・80操作は不変です。

イベントには`jobId`・`inputRevision`・`sequence`が付き、中間スナップショットは`provisional:true`です。メッシュ/品質、反復残差、対応解析の時刻場・適応段階等、実際に発生したイベントのみ取得できます。全ソルバーの全反復・全物理場を保証しません。`includeFields:true`では新規ディレクトリ`outputPath + ".intermediate"`に暫定メッシュ/時刻場JSONを保存し、イベントの成果物参照にパス・バイト数・SHA-256を含めます。場JSONには取得できた対応メッシュへの`meshArtifact`参照を含み、再メッシュで参照を更新します。既存ディレクトリは再利用しません。既定の合計上限64 MB（64,000,000バイト）以降は場保存を止め、`observation-limit`を通知して要約と解析を継続します。中止・失敗時も既に書いた暫定ファイルが残り得ます。`provisional:false`の最終保存結果でも物理精度・収束の確認は別途必要です。

ブラウザの`analysisApi.startJob`、`getJob`、`jobEvents`、`cancelJob`、`getJobResult`、`releaseJob`も同じライフサイクルを使います。`startJob`の`inputRevision`と`requestId`は呼出側が渡します。ブラウザのイベントは通常は要約のみです。includeFields:trueでは下記のメモリ内成果物を保持します。下記の接続モードで、このAPIをライブMCPへ公開できます。

`studio_job_artifact({jobId,artifactId,point?,bodyIndex?,elementIndex?,offset?,limit?})`はイベントにある登録済み`artifactId`から中間成果物を取得します。任意パスは受け付けず、ハッシュ・ジョブ入力版・対応メッシュを照合します。既定は要約のみ。現行の場は熱の温度・過渡音響の圧力スカラーと、塑性/超弾性の荷重ステップ変位ベクトルです。これらは`point:[x,y,z]`（mm）の補間、または`offset`と`limit`（最大200）のノード/値ページを必要に応じて取得できます。メッシュ単独では座標ページを取得でき、点補間には場が必要です。解放済みジョブの登録は利用できません。最終保存の`job.final:true`は保存完了を表し、仮定があれば`job.provisional:true`を維持します。最終保存と非暫定・物理検証済みを同一視しないでください。

例: `studio_analyze`へ`{"path":"D:/work/project.json","outputPath":"D:/work/result.json","size":5,"method":"wasm-pcg"}`を渡します。`studio_probe`の`point`はmm、結果は各解析の物理単位です。UIから保存した入力JSONを使い、材料の出典と有効範囲を確認してください。

Codexへの登録（位置が異なる場合は変更）:

```powershell
codex mcp add airpocket-studio -- node D:/github/airpocket-soundman/airpocket-simulation-studio/scripts/studio-mcp.mjs
```

[公式MCP設定手順](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)を参照。`skills/airpocket-studio`を個人の`.codex/skills/airpocket-studio`へコピーして専用skillを使えます。

通常モードのMCPは保存JSONを操作し、接続モードでは許可されたブラウザ操作も利用できます。画像・動画は接続モードの出力ジョブまたはブラウザUIを使います。MCP計算の成功は画面・GPU・任意形状の物理精度の検証とは別です。

`studio_material_catalog`で同梱した樹脂物性を検索できます。[材料ライブラリ](polymer-library.md)。

`studio_capabilities`でNode実行の能力と候補ソルバーを取得し、`studio_diagnose_execution`へ保存プロジェクトの`path`と任意の`method`・`adaptive`を渡して実行組合せの診断を取得できます。診断にはコード・重要度・対象・根拠・修正候補を含みます。現段階では単位・拘束・物性・メッシュ等を含む完全な解析前検査ではありません。ブラウザは`window.studioApi.getCapabilities()`と`diagnoseExecution(options)`を使います。

## 一時ローカル接続（初期実装）

`node scripts/studio-mcp.mjs --browser-origin=http://127.0.0.1:5174` と起動すると、通常の29ツールに加え `studio_browser_sessions` と `studio_browser_call` を公開します。Originは実際のページに合わせます。stdoutはMCP専用、stderrに接続先・接続コードを表示します。

ブラウザの「自分のLLMに接続する」で接続先とコードを入力し、確認・編集・計算・表示の共有範囲を選んで許可します。初期選択は確認のみ。コードをURL・保存入力・公開文書へ含めません。サーバーは127.0.0.1限定で、Origin/Host/Bearerを検査します。ブラウザのpollが10分途切れると失効し、プロセス終了で全セッションを失います。切断は、その接続が開始した計算を中止します。再接続は新規許可であり実行中ジョブの復元ではありません。

`studio_browser_call({sessionId,method,args})` の対応操作:

- 確認: `inspect`（revision・操作一覧）、`geometry`（面ページ）、`preflight`、`jobStatus`、`jobEvents`、`jobArtifact`、`probe`（表示結果の点値・暫定評価）。
- 編集: `edit({expectedRevision,operations})`。同じ18操作を原子的に適用。版不一致・途中の入力変更・実行中・接続解除を拒否。
- 計算: `startJob({inputRevision,requestId,operation,options})`、`cancelJob({jobId})`、`releaseJob({jobId})`、`showJob({jobId,name})`。showJobは入力版が一致する場合だけ保存ケースを作成し表示。メッシュ単独のshowJobは未対応。
- 表示: `getView`、`setView`。断面・透過・部品表示設定。結果カメラは下記の結果ビューAPIで操作できます。画像/動画出力は下記の出力ジョブを使います。

命令は最大16件、応答待ちは15秒。タイムアウトは未実行の保証ではないため、変更を再試行する前に状態を取得します。タイムアウトのエラー（code:BROWSER_COMMAND_TIMEOUT、messageは従来通り）は`delivered:true|false`を持ち、MCPでは`structuredContent.error.delivered`として返ります。`false`はブラウザが命令を一度も取得していないため再試行しても安全で、`true`は命令がページへ渡された後に返答がなかったため、再試行の前に必ず状態を取得してください。再起動復元、GUIジョブ全経路の実画面での確認、公開HTTPSページからのlocalhost接続・ブラウザ権限は未検証。ローカルChromeと実MCPで版照合編集→Worker解析→途中イベント→結果表示→0.04 mmの点値→表示変更→接続解除を確認しました。

### 単体browser connector配布（配信物確認済み・実接続未検証）

ブラウザ操作だけを使う軽量エントリは、ビルド時に `dist/assets/studio-browser-mcp.mjs` という単一ファイルになります。既存のNode 24が必要ですが、取得したファイルの実行にはリポジトリ、npm install、ネイティブソルバー、CAD/Gmsh/OCCTのローカル資産は不要です。Node自体を同梱した実行形式ではありません。ビルドには従来どおりリポジトリとnpm依存関係が必要です。

配布時は、信頼する完全なコミットrevisionまたはreleaseタグを先に固定し、その版の `runtime-manifest.json` を取得します。manifestの `revision` が固定したコミットと一致し、`dirty:false` であることを確認してください。タグの場合は信頼するタグから完全なコミットへ解決します。同じ配布場所のmanifestとファイルだけの一致は、配布元の信頼性の保証にはなりません。

manifestの任意フィールド `connector` は `{path:"assets/studio-browser-mcp.mjs",minimumNodeMajor:24,transport:"stdio"}` です。manifestのURLを基準に `connector.path` を解決し、取得したファイルのバイト長と生バイトのSHA-256を `files[connector.path].bytes` / `.sha256`（小文字16進数）と照合してから実行します。旧manifestにはconnectorが存在し得ないため、その場合はこの単体配布があると判断しません。公開パスは `/airpocket-simulation-studio/assets/studio-browser-mcp.mjs` です。

MCPクライアントには `node studio-browser-mcp.mjs --browser-origin=https://airpocket-soundman.github.io` のように登録します。引数は実ページの正確なOrigin一つだけで、パスを含めません。公開ページのURL全体は `/airpocket-simulation-studio/` を含みますが、Originには含みません。stderrの `Browser connector:` にendpoint・origin・pairingTokenを出し、stdoutはJSON-RPC専用です。接続情報は上記のアプリ接続UIに入力し、必要なscopeだけを許可します。初期選択はinspectです。ローカル接続先の制限、Origin/Host/Bearer検査、期限切れの条件は既存接続と同じです。

この単体版のツールは `studio_browser_contracts`、`studio_browser_sessions`、`studio_browser_call` の3個だけです。契約取得は権限を付与せず、呼出しには接続先の許可scopeが必要です。保存ファイル解析等を含む従来の29ツール／接続時31ツールのサーバーとは別のエントリです。終了時はアプリで切断して接続由来のジョブを中止し、MCPクライアントがstdinを閉じる（EOF）とサーバー・セッション・保留中の命令も終了します。再接続には新たな許可が必要です。

ソース実装と、単一ファイルだけを隔離ディレクトリへ置いたNode 24でのstdio・HTTP模擬ブラウザ接続・scope拒否・EOF終了のテストは完了しています。公開0e53638のmanifest版・バイト数・SHA-256照合、取得ファイルだけの隔離起動・3ツール発見・EOF終了を確認しました。[公開ファイル検証](evidence/2026-10-15-public-browser-connector.json)を参照。確認専用の実HTTPS接続は到達エラーで失敗し、セッションは作成されませんでした。[試験記録](evidence/2026-10-15-public-https-inspect-failure.json)を参照。

### ブラウザの途中の場を取得する

接続モードで `startJob` に `includeFields:true` を指定すると、中間メッシュと熱/過渡音響スカラー場・塑性/超弾性ステップ変位場をブラウザのメモリ内に保持します。`jobEvents` の `artifact.artifactId` を、`jobArtifact({jobId,artifactId,point?,bodyIndex?,elementIndex?,offset?,limit?})` または共通APIの `analysisApi.getJobArtifact(jobId,artifactId,options)` へ渡します。既定は要約のみ。ページ上限は200節点で、点測定には場を含む成果物が必要です。

取得時にSHA-256・入力版・対応メッシュを検査し、物理時刻（秒）・単位・provisional:trueを返します。再メッシュは新しいメッシュ参照へ切り替え、過去の場は元のメッシュと結び付けたまま保持します。既定64,000,000バイトの直列化データ予算は全ブラウザジョブで共有し、上限では要約と計算を続行。実ヒープ使用量の上限ではありません。観測が不正な場合はobservation-errorを返し、最終解析結果の判定と区別します。releaseJob/closeJobsで解放し、ページ終了で消失します。ファイルへの永続保存・全ソルバーの全反復場は提供しません。

## 結果ビューとケースの意味的操作

接続モードの`getResultView({frameOffset?,frameLimit?,modeOffset?,modeLimit?})`は、結果全体を送らず`resultRevision`、物理量と表示単位、現在の表示設定、保存時刻/モードのページ（各最大50件）を返します。`setResultView({expectedResultRevision,settings})`で変更します。

`settings`は`field`、`deformScale`、`surface`、`surfaceWire`、`volumeWire`、`section`、`modeIndex`、`frameIndex`または`timeSeconds`、`camera`、`colorRange`です。カメラはmmの`position`/`target`と`up`、度の`fov`。固定色は`{field,minimum,maximum}`、自動範囲はnull。値の単位は返却されたfield単位（応力はMPa、温度はdegC等）に従い、範囲外は端の色に固定します。物理量を変更して新範囲を指定しなければ自動範囲へ戻ります。

過渡音響は保存された時刻だけを選択し、未保存時刻は拒否します。熱の最終結果から途中場を表示する機能は未対応。固有モードは正規化形状で、実際の動的応答ではありません。`probe({point,expectedResultRevision?,options?})`は表示中の保存時刻/モードを測定し、結果版・選択状態・根拠評価を返します。変形表示倍率は物理値を変更しません。共通APIは`window.resultViewApi.get/set/probe`です。ビュー設定はJSONで取得・再適用できますが、ケース集に自動保存しません。

ケースは`caseList()`の`archiveRevision`と各ケースの`caseId`・`revision`を使用します。`caseView`、`caseRestoreInput`、`caseRemove`へ`{caseId,expectedRevision}`を、`caseRename`には追加で`name`を渡します。`caseSave({name,expectedResultRevision})`は現在の表示結果を最大8件の保存枠へ追加します。共通APIは`window.caseOperations.list/saveCurrent/view/restoreInput/rename/remove`です。caseIdはページ内だけで有効で、外部からケース集を変更すると古いIDは失効します。改名後も内容revisionを更新してから次の操作へ進みます。

共有範囲は、一覧/測定/結果ビュー取得が確認、表示設定変更が表示、保存が計算・結果保存、改名/削除/復元/ケース表示が入力・ケース編集です。ケース表示は保存時の入力も復元するため編集許可を要します。接続解除・命令期限・処理中の入力/結果/ケース変更・計算/動画再生との競合を実行直前に再検査します。ケース集のライブ入出力は以下の分割転送APIを使用します。ケースと名前付きビューの一体保存には下記のbundle形式を使用します。

## PNG/WebM/連番PNGの出力ジョブ

任意接続モードは82操作を公開します（通常29ツール、接続モード31ツール）。`exportCapabilities()`でPNG/WebMとアニメーション種別の実行可否を調べます。WebMは実行中ブラウザの録画対応に依存します。`formats["png-sequence"]`（`{supported,container:"zip",compression:"store",minFrames,maxFrames,defaultFrames,maxFrameBytes,maxTotalBytes,animations}`、追加項目）は固定フレーム書き出しの可否と上限を示します。MP4/GIFは未対応としてfalseを返し、`formats.mp4`/`formats.gif`に`{supported,reason,alternatives}`（代替はwebm/png）を付けます。MediaRecorderがMP4録画を報告しても書き出しは未実装のため`supported`はfalseのままです。完了した書き出しの成果物メタデータには、結果リビジョン・表示時間/物理時間・解像度（PNG）・コーデック・SHA-256を含む上限付き`manifest`が付きます。

`getResultView`で結果版を取得し、`startExport({requestId,expectedResultRevision,format,animation,seconds})`を呼びます。`format`は`png`または`webm`、`animation`は`orbit`、`deformation`、`time`、`slice`、`seconds`は1〜15の整数（省略時5）です。`format:"png-sequence"`は固定フレーム書き出しで、`frames`（2〜120の整数、省略時24）枚を実時間・タブの描画間引きに依存せず、フレームiを保存済みの表示状態（orbit/deformationは位相i/N、time/sliceは位相i/(N-1)、timeは保存済み過渡音響スナップショットに対応しNがその数を超えると拒否）から描画し、STORE方式（無圧縮）の単一ZIP（`manifest.json`と`frame-0000.png`…）として返します。`seconds`は指定できません。1フレーム4 MiB・全体24 MiB・フレーム数の上限超過は明示的に拒否され、取消・結果更新・失敗では成果物を作らずコントロールとカメラを元に戻します。ZIP内`manifest.json`（`schemaVersion` 2）は壁時計時間を含む`resultRevision`の代わりに`physicalRevision`（`performance`を除いた結果のハッシュ、`getResultView`も返す）を記録するため、同一計算なら同一バイトのZIPになり、フレームごとの位相/角度/物理時間/断面位置、解像度、SHA-256が入り、成果物メタデータの`manifest`には枚数・解像度・`manifest.json`のSHA-256を含む上限付き要約が付きます。開始時に結果版を照合し、結果表示・カメラ・層・断面等の設定を複製してジョブに固定します。同じrequestIdと同じ要求は保持中の同じジョブを返し、要求変更は競合として拒否します。

`exportStatus({jobId})`で進捗とrunning/completed/failed/cancelledを確認します。completedの成果物メタデータには`mimeType`、`name`、`totalBytes`、`sha256`が含まれます。`exportArtifact({jobId,offset:0,length:65536})`からbase64の`data`を復号し、返却された`nextOffset`がnullになるまでページを取得します。lengthは最大65,536バイトで、offsetは復号後のバイト位置です。結合したバイト数とSHA-256をメタデータに照合してから利用します。ブラウザ内の任意コード実行、任意パス読取、グローバルなファイルシステム操作は不要です。自動ダウンロードや永続保存は行いません。

`cancelExport({jobId})`で中止し、不要になったら`releaseExport({jobId})`で保持枠と成果物を解放します。取消・解放後に届いた録画結果は取得できません。既定の保持上限は合計32 MiBと4ジョブ、レンダラーは取消後の後処理を含め同時に1件です。切断はその接続が開始した出力ジョブも中止します。ページ終了で出力は消失し、再起動復元・ケース集への永続保存は提供しません。

共有範囲は能力・状態・成果物取得が確認（inspect）、開始・取消・解放が表示（view）です。動画は実時間の24 fps録画で、固定フレームの決定的な書き出しではありません。time再生は保存された過渡音響フレームに限り、動画の再生秒数と物理時刻は別です。変形アニメーションは表示倍率の周期変化で、負荷履歴の解析結果ではありません。

実時間録画は24 fpsを要求するがフレーム数を保証しない。背景タブや高負荷で欠落し得る。固定フレーム・決定的な動画出力は未対応。


## 名前付きビューの持ち運び

共通APIは`window.namedViewApi.list/save/apply/remove/export/import`です。GUIの名前付きビューパネルでも保存・復元・削除・JSON入出力を行います。接続MCPでは`namedViewList`と`namedViewExport`が確認（inspect）、`namedViewSave`、`namedViewApply`、`namedViewRemove`、`namedViewImport`が表示（view）許可です。名前付きビューの削除は表示設定の削除であり、解析ケースの削除とは別操作です。

まず`namedViewList()`で`archiveRevision`と`views`の`viewId/revision/name/resultRevision`を取得し、`getResultView()`で表示中の結果版を確認します。`namedViewSave({name,expectedResultRevision,expectedArchiveRevision})`は結果設定とカメラ、断面・部品等のsetupを保存します。fieldで定まる表示単位を使い、固定色範囲・選択フレーム/モードを保持しますが、物理場配列やモデルは含みません。名前は1〜100文字、最大16件です。

`namedViewApply({viewId,expectedRevision,expectedResultRevision})`は保存時と同じ結果版だけに適用します。異なる計算結果への同期プリセットではありません。`namedViewRemove({viewId,expectedRevision})`で削除します。競合時は一覧と表示結果を読み直し、古い版をそのまま再送しないでください。

`namedViewExport()`は`{version:1,views:[{id,name,resultRevision,result,setup}]}`のJSONを返します。明示的に保存し、`namedViewImport({archive,expectedArchiveRevision})`で再取込すると持ち運べます。取込は現在のビュー一覧全体を置き換えます。未知キー、非有限値、不正なカメラ・範囲・形式、重複IDは拒否します。適用の途中失敗では以前の状態への復元を試みます。自動localStorage保存は行いません。ケース同梱には下記のbundle形式を使います。ページを閉じる前に必要なビューを明示的に書き出してください。

## ケース集の分割入出力

接続モードの`caseArchiveExport({})`は`transferId`、`archiveRevision`、`totalBytes`、`sha256`、`maxChunkBytes`を返します。`caseArchiveRead({transferId,offset,length})`でbase64の`data`と`nextOffset`を取得し、`nextOffset:null`が終端です。全バイトを組み立ててSHA-256を照合してから、許可された保存先へ保存します。物理結果を省略・切り詰めない既存version 1ケース集JSONです。名前付きビューは別途書き出します。

取込前に`caseList()`の`archiveRevision`を取得し、UTF-8 JSONのバイト数とSHA-256を計算します。`sha256`と版は`sha256:`に続く小文字64桁の16進数です。`caseArchiveImport({expectedArchiveRevision,totalBytes,sha256})`で転送を作成し、`caseArchiveWrite({transferId,offset,data})`へbase64を順に送ります。1チャンクは復号後最大65,536バイトです。全体送信後、`caseArchiveCommit({transferId})`で完全性・ハッシュ・UTF-8・JSON・ケース内容を検証し、版が一致した場合だけケース集全体を置き換えます。最大8ケースで、取込後は既存の実行時caseIdが失効するため`caseList()`を再取得します。

書出・読取・解放は確認権限、取込開始・書込・確定は編集権限を要します。共通APIは`window.caseArchiveTransfer.beginExport/read/beginImport/write/commit/release`です。共通の保持上限は100,000,000バイト、同時転送は最大4件。不完全・不正・ハッシュ不一致・版競合・期限切れの取込は既存ケースを維持して拒否します。不要・失敗した転送は`caseArchiveRelease({transferId})`で解放してください。ページ終了で未保存転送を失い、接続解除ではその接続の取込を破棄します。ファイルシステム操作や任意のブラウザコード実行は提供しません。

性能の注記（測定値、n=1、単一マシン）: ブリッジの`/poll`は空のとき最大約1秒（`pollWaitMs`、上限5秒）だけ保留して、コマンドが積まれた時点で即座に返す短いロングポーリングで、切断・シャットダウン・中断時に保留を解放し、認証・Origin/Host検査は従来どおり保留前に行います。ページ側は応答直後と、保留された空ポーリングの後は待ち時間なしで再ポーリングし、即座に返った空ポーリングの後だけ間隔を空けます（模擬ブリッジで、ドライバ間隔20 msの逐次20コマンドは約13.9 s → 約0.7 s、実Chromeでの再測定は未実施）。以前の記述: コネクタはコマンドを処理して応答した直後に待ち時間なしで再ポーリングし、空のポーリングの後だけ間隔（既定750 ms）を空けます（以前は各コマンドが最大でこの間隔ぶん待ち、約34 MB（518チャンク）の転送が数分かかっていました。模擬ブリッジでの20コマンドは約14.4 s → 約0.3 s、実Chromeでの再測定は未実施）。Node内の共有モジュール単体ではチャンクの読取・書込は1チャンクあたり数ミリ秒でチャンク番号に依存しません（`node scripts/measure-case-archive-transfer.mjs`）。`caseList`/`caseSave`/取込確定はケース集全体を直列化・ハッシュするため、保存済みケースの総量に比例して遅くなります。数値は[検証記録](testing.md)の実測を参照し、保証値ではありません。

100,000,000バイトは保持する転送バッファの合計上限であり、JSON解析・複製・検証を含むブラウザのヒープ上限ではありません。確定済み取込も再送時の重複適用を避けるため、解放するまで転送枠とバイトを保持します。

## 疲労・破壊評価の版付きAPI

`studio_assess_result({path,outputPath,expectedResultRevision,kind,options})`は保存済み解析JSONを検証し、`kind:"fatigue"|"fracture"`の評価を追加した完全な解析JSONを新規パスへ保存します。既存出力の上書きは拒否します。`studio_assessment({path,kind,expectedResultRevision?,offset?,limit?})`は読取専用で、評価の要約・出典・単位・制限と要素別データを返します。ページは既定50、最大200要素です。保存結果ではまず`studio_assessment({path,kind})`を呼び、返された`resultRevision`を評価時の`expectedResultRevision`へ渡します。対象となる構造線形弾性結果にまだ評価がない場合も、`available:false`、現在の結果版、空の要素ページを返します。保存済み評価がある場合は`available:true`です。

ブラウザでは`window.resultAssessmentApi.evaluate({expectedResultRevision,kind,options})`と`get({kind,expectedResultRevision?,offset:0,limit:50})`を使います。MCP接続の`evaluateAssessment`はanalyze権限、`getAssessment`はinspect権限です。MCP`studio_assess_result`は`options`必須で出力パスの上書きも拒否しますが、ブラウザ側`evaluate`は現行結果版で同じkindを再評価すると保存済み評価を置換し(上書き拒否はなし)、疲労の`options`省略は既定値(minLoadFactor0・maxLoadFactor1・meanStressCorrection none・appliedCycles1)で受理します。古い結果版は拒否します。評価応答には変更前・変更後の結果版、要約、材料出典、制限、要素数が含まれます。入力・変位・応力配列は変更しませんが、評価と計算設定を含む出力全体の版は変わります。保存ビューや古い結果版の参照を適用する前に、新しい版を取得してください。

材料データは元の保存入力の`materialProperties.fatigueData`または`fractureData`だけを使用します。欠けたS-N曲線・強度・破壊靱性を名前やLLMの推測で補いません。既存評価も元入力から数値を再計算して検証し、別種の有効な評価を保持します。

疲労optionsは`minLoadFactor`、`maxLoadFactor`、`appliedCycles`、`meanStressCorrection:"none"|"goodman"`です。比例単軸の等方線形弾性応力に対する測定S-N範囲内のスクリーニングで、範囲外外挿・変動振幅履歴・多軸評価は対応しません。Miner損傷は決定論的な使用率で、破損確率ではありません。

破壊optionsは`flawSizeRangeMm`、`geometryFactorRange`、`geometrySource`、単位ベクトル`crackNormal:[x,y,z]`、`residualNormalStressRangePa`、`stressAssumption`です。未亀裂の公称応力によるモードI線形破壊力学のスクリーニングで、混合モードのせん断、亀裂進展、疲労亀裂進展、余寿命予測は対応しません。区間は決定論的な上下限で、信頼区間ではありません。両評価とも熱応力・塑性・超弾性・直交異方性など対応外の結果は拒否します。APIの実装は任意モデルの物理妥当性や実画面での検証を保証しません。

## CAD更新のプレビューと確定

`studio_preview_cad_update({path,replacementPath,expectedRevision,offset?,limit?})`で保存入力へのSTEP置換をプレビューします。先に`studio_inspect_project({path})`で入力の`revision`を取得します。`replacementPath`は絶対パスのSTEP/STP（上限50 MiB、埋込単位をmmへ正規化）またはSTEPを保持した保存プロジェクトJSONです。入力・置換ファイルは別パスを指定してください。プレビューはファイルを変更せず、入力版・`replacementRevision`・照合/保留件数と条件別レポートのページを返します。`offset`は0以上、`limit`は既定50、1〜50です。全三角形配列を応答に含めません。

確認後に`studio_apply_cad_update({path,replacementPath,outputPath,expectedRevision,expectedReplacementRevision})`へプレビューの両版を渡します。入力と置換の内容を再照合し、新しい完全な入力JSONを別の`outputPath`へ排他的に保存します。入力・置換・既存出力を上書きしません。照合は面の幾何に基づく保守的な既存方式で、永続CAD IDではありません。変更・分割・欠落・曖昧な領域は未解決として残し、再選択まで実行を止めます。条件値は保持しますが、既存根拠を未確認へ戻し、仮定とユーザー確認記録を解除します。更新後に領域を再選択し、出典・適用範囲・値を再確認してからpreflightと再計算を行ってください。

ブラウザ共通APIは`window.cadUpdateApi.preview({expectedRevision,replacement,offset:0,limit:50})`と`apply({expectedRevision,replacement,expectedReplacementRevision})`です。`replacement`には取込済みSTEPプロジェクトJSONを渡します。接続MCPの`previewCadUpdate`は確認（inspect）、`applyCadUpdate`は編集（edit）許可を要します。プレビューは現在の入力を変更せず、確定時に入力・置換ハッシュと競合・許可状態を照合します。ライブ命令は既存のJSON 500,000文字上限に従い、CAD専用の分割転送は未対応です。大きなSTEPは上記保存ファイル用MCP経路を使ってください。APIの提供は任意CADでの照合や実画面検証の完了を意味しません。

ライブの置換JSONは正規の取込済みSTEP表示メッシュを必要とします。各メッシュは`kind:"cad"`で、キーは`positions`・`faceIds`・`kind`と任意の空でない`sourceHash`に限り、全座標はFloat32で正確に表現可能でなければなりません。非正規メッシュは座標の丸めや余分なメタデータの削除で補正せず拒否します。この制限は保存JSON用のMCP経路には適用しません。工学用途の更新では実際のSTEPファイルパスを使う経路を優先してください。

## 3MF/G-codeの取込と層データAPI

`studio_import_print({path,outputPath})`は元の`.3mf`または`.gcode`を読み、GUI書出と同じ`{version:1,filename,data}`を別の新規JSONへ排他的に保存し、版とコンパクトな要約を返します。入力と既存出力は上書きしません。元入力は50,000,000バイト以下です。`studio_inspect_print({path,expectedRevision?,viewId?,kind?,offset?,limit?,layerIndex?})`はこの保存JSONを確認し、要約または配列のページを返します。

ブラウザ共通APIは`window.printOperations.inspect/import/get/set/export`です。接続MCPでは`printInspect`と`getPrintData`がinspect、`importPrint`がedit、`setPrintView`がview権限を要します。未読込のinspectは`revision:null`を返します。読込後の版はGUIのversion 1書出全体のハッシュで、要約には`geometry`、`plate:N`のviewIdと層数を含みます。層番号の添字は表示言語から独立しています。

`importPrint({expectedRevision,format,filename,text?,base64?})`のformatは`gcode`または`3mf`です。前者はtext、後者はbase64を渡します。expectedRevisionは未読込時null、既読込時は直前の版を指定します。不正入力・古い版・処理中・期限切れは既存データを保持して拒否します。ライブ命令全体はJSON 500,000文字以内で、大きな印刷入力には下記の分割転送を使います。

`getPrintData({expectedRevision,viewId?,kind,offset:0,limit:200,layerIndex?})`は`kind:"segments"|"triangles"`の有限ページを返し、limitの上限は200です。`setPrintView({expectedRevision,settings:{viewId,allLayers,layerIndex}})`はプレビューだけを変更し、文書版は変更しません。保存する全データは共通APIのexportまたは保存ファイル経路を使って取得します。

パーサの警告・参照情報を保持し、CAEモデルへの座標系の自動位置合わせは行いません。G-codeを装置へ送信・実行せず、読込だけから強度やインフィルの物性を推定しません。円弧押出や未対応コマンドは既存パーサの制限に従って拒否されます。

## GUIから開始したメッシュ・解析ジョブの監視

GUIの4つのメッシュ・解析開始経路は`guiAnalysisJobs.run`から共通の`analysisApi.startJob`を使用します。開始時に入力を複製しSHA-256で版を固定し、完了時は現在の入力版と照合して適用します。GUIジョブは`includeFields:true`で対応する中間場を保持します。旧`analysisApi.analyze/generateMesh`は直接実行の互換APIとして残ります。

確認権限の接続操作`listJobs({offset:0,limit:50})`（limit上限100）は`{jobs,total,nextOffset}`を返します。GUIとAPIの保持中ジョブを`origin:"gui"|"api"`付きの小さなメタデータとして列挙し、完全な結果配列を含みません。共有APIは`analysisApi.listJobs`です。返されたIDに既存の`jobStatus`、`jobEvents`、`jobArtifact`を使用して状態・中間結果を読み取ります。GUIの履歴表示は直近8件を保持し、次のGUI開始時に最も古い終了済みかつ実行終了確認済みのGUIジョブを解放します。MCP側のジョブをこの整理で解放しません。

接続解除で中止するのはその接続が開始したジョブのみで、GUIジョブは継続します。ページ終了・再起動後の復元は提供しません。ローカルのアプリ内ブラウザで構造・熱GUIジョブを実Worker/WASMとMCPから確認しました（[検証記録](testing.md)）。全GUI経路と公開HTTPS接続を確認した記録ではありません。

## 材料カタログの版付き適用

`studioApi.applyCatalogMaterial({id,expectedCatalogVersion,poissonRatio,isotropicApproximation:true,allowExperimental:false,applicability})`は1つのオブジェクトを受け取り、同梱カタログの参照値を入力へ適用します。`id`と`expectedCatalogVersion`は`studio_material_catalog`で取得した値を使います。`poissonRatio`は呼出側が明示し、`isotropicApproximation:true`で等方近似を明示的に受け入れます。`applicability`には対象の成形・温度・方向などへの適用条件を空でない文字列で記録します。GUIでもこの入力が必須です。実験配合には`allowExperimental:true`の明示が必要で、既定falseです。

保存ファイルMCPでは`studio_edit_project`の`operations:[{method:"applyCatalogMaterial",args:[{id,expectedCatalogVersion,poissonRatio,isotropicApproximation:true,applicability}]}]`を使います。接続MCPの`edit`でも同じ18操作の1つとして使用でき、通常の入力版照合を要します。カタログの出典、測定条件、欠測項目、適用条件のスナップショットを保持します。適用時は`/material`・`/materialProperties`とその子Pointerの既存根拠を、数値が同じ場合も`unconfirmed`へ戻し、`assumption:null`としてconfirmationを解除します。旧source・value・rationale・applicabilityは再確認用に保持します。その他の根拠とanalysisIntentは維持し、新しい確認済み根拠は生成しません。既存の非線形材料プリセットを置き換える既存挙動も伴うため、適用後の材料モデルと必要入力を確認してください。

## 大きな印刷入力のライブ分割転送

確認権限の`printTransferExport({expectedRevision})`は、GUIのversion 1書出全体を固定したJSON転送として保持します。応答は`transferId`、`direction`、`totalBytes`、`sha256`、`maxChunkBytes:65536`、`revision`の小さなメタデータです。`printTransferRead({transferId,offset,length})`も確認権限で、lengthは最大65,536バイト。取得した全バイトを結合し、SHA-256を照合してからUTF-8 JSONを読みます。全配列を1回の大きな応答には含めません。書出JSONは100,000,000バイト以下です。

編集権限の`printTransferImport({expectedRevision,format,filename,totalBytes,sha256})`で元のG-code/3MFバイトを取り込む枠を作ります。expectedRevisionは未読込時null、既読込時は現在の版。totalBytesは最大50,000,000バイトです。`printTransferWrite({transferId,offset,data})`へ最大65,536バイトのbase64を先頭から順番に送り、`printTransferCommit({transferId})`で全体のバイト数・ハッシュとG-codeのUTF-8を検査して既存のprintOperations.importへ渡します。確定は編集権限で、版・busy・失効を再確認し、不正な入力では旧データを維持します。

`printTransferRelease({transferId})`は確認権限で保持を解放します。全転送で合計100,000,000バイト・最大4件の保持枠を共有します。この値は転送バッファの予算であり、JSON/パース/複製を含めたピークヒープの上限ではありません。接続解除でその接続の転送を解放し、ページ終了で失われます。500,000文字の命令上限は維持され、各チャンクはその中で扱います。ソルバー・物性・装置制御の機能追加ではありません。

共通転送APIは`window.printTransfer.beginExport/read/beginImport/write/commit/release`です。writeは直前のチャンクと同じoffset・dataの再送を受理します。確定済み・失敗した転送も解放まで保持枠を占有するため、不要時にreleaseしてください。ローカル実ブラウザでの検証範囲は[検証記録](testing.md)を参照。最大容量・ピークヒープ・公開HTTPSは未確認です。

転送上限はパーサの対応範囲を広げません。G-codeは既存の25,000,000文字・200,000区間上限、3MFは既存のZIP・三角形等の上限を引き続き適用します。

## ケースと名前付きビューの一体保存

旧v1形式は`{version:1,kind:"case-view-bundle",caseArchive:{version:1,cases},namedViewArchive:{version:1,views}}`のまま維持します。通常の保存はv2の`{version:2,kind:"case-view-bundle",caseArchive,namedViewArchive,measurementArchive}`でケース・ビュー・測定履歴を同梱します。各子アーカイブは既存のversion 1形式です。既存のケース単独・ビュー単独形式は維持します。`studio_validate_case_bundle({path})`は読取専用でケースの物理結果とビューの参照を検証し、件数と版の要約を返します。

接続の`caseBundleList()`は確認権限で`archiveRevision`とケース/ビュー/測定件数を返します。確認権限の`caseBundleExport()`、`caseBundleRead({transferId,offset,length})`、`caseBundleRelease({transferId})`と、編集権限の`caseBundleImport({expectedArchiveRevision,totalBytes,sha256})`、`caseBundleWrite({transferId,offset,data})`、`caseBundleCommit({transferId})`はケース集転送と同じ引数・分割契約を使用します。bundle転送内で合計100,000,000バイト・最大4枠を共有します。これは保持バッファ予算で、ピークヒープの上限ではありません。

各ビューのresultRevisionは同梱ケースを`prepareCaseView`で表示用に正規化したoutput全体のSHA-256と一致する必要があります。旧ケースでは表示時にmesh.summaryを再計算するため、生の保存JSONのハッシュとは異なることがあります。保存ケースの物理データを書き換えたり、指定ビューの版を自動で対応付け直したりしません。生JSONの版だけを参照する旧ビューは拒否し、ケースを表示して名前付きビューを保存し直してください。対応する結果がないビューは書出を拒否し、対応するケースを保存するかビューを削除して修復します。自動で孤立ビューを捨てません。不正な表示量・モード・フレーム・setupのメッシュ数も拒否します。

取込はハッシュ・現在の関連アーカイブの版・入力スナップショットを検査してから、v2ではケース・ビュー・測定履歴の3ストアを同期的に一括確定します。v1を取り込む場合は履歴がファイルに含まれないため、既存の測定履歴を明示的に空へ置換します。必要な履歴は取込前に保存してください。現在の入力・表示への自動適用は行いません。名前付きビューIDは維持し、実行時ケースIDは内容変更により再発行される場合があるためcaseListで取得し直します。別結果への対応付けや版の置換は行いません。GUIにも一体形式専用の書出・取込操作を追加します。

共有APIは`window.caseBundleApi.list/exportArchive/importArchive`、分割転送は`window.caseBundleTransfer`（既存caseArchiveTransferと同じbeginExport/read/beginImport/write/commit/release）です。GUIの専用操作は`installCaseBundleUi`で組み込みます。

ローカル実ブラウザ・実WASM・実MCPで、GUIダウンロードとMCP分割書出の同一性、GUI再取込、ケースと表示設定の復元を確認しました（[検証記録](testing.md)）。公開HTTPS・最大容量・全結果種の実GUI確認は含みません。

## 結果版と表示状態を固定した測定履歴

共有の`window.measurementApi`は`list/get/save/remove/exportArchive/importArchive`を提供します。接続の`measurementList`・`measurementGet`・`measurementExport`は確認権限、`measurementSave`・`measurementRemove`・`measurementImport`は編集権限です。保存時のresultRevision、点、options、表示中の時刻/モードなどのdisplay、測定値と根拠評価を固定します。optionsは`bodyIndex`・`elementIndex`のみで、modeIndex/frameIndexの上書きは受け付けず表示中のresultView文脈を使います。

履歴は最大100件、アーカイブ全体で300,000 UTF-8バイト以内の厳密なJSONです。履歴に結果本体を含めず、インライン転送の命令・応答上限内で扱います。取込で型や構造を検査しても、値を元結果から独立に再計算して検証した扱いにはしません。現在の結果を切り替えても過去の版・測定値を置き換えません。今回GUIは追加しません。必要な履歴は明示的に書き出して保存してください。

`measurementList()`は`archiveRevision`と各`measurementId`・内容`revision`・name・resultRevisionを返します。保存は`measurementSave({name,expectedResultRevision,expectedArchiveRevision,point,options})`で、先に結果ビューと履歴一覧から両版を取得してください。`measurementGet({measurementId,expectedRevision?})`で記録を読み、`measurementRemove({measurementId,expectedRevision,expectedArchiveRevision?})`で削除します。削除時は両版の指定を推奨します。返却には`recordedEvidence:true,independentlyVerified:false`を明示します。

`measurementExport()`は`{archiveRevision,archive:{version:1,measurements:[{id,name,resultRevision,point,options,evidence}]}}`を返します。`measurementImport({archive,expectedArchiveRevision})`で一覧全体を置換し、imported:trueを返します。IDはアーカイブで保持し、重複IDを拒否します。日時は記録しません。guardはホスト内部用で、公開JSON引数へ指定しません。

## 保存結果からの測定履歴の再計算照合

`studio_verify_measurements({casesPath,measurementsPath})`は保存ケース集と測定アーカイブを読み、履歴を保存結果から再計算して照合します。両入力を厳密に検証し、各resultRevisionと一致する表示用正規化結果を探して、表示量・時刻/モード・点・optionsから実resultView.probeで補間します。記録のevidence全体とcanonical JSONで一致する必要があり、不一致や対応結果のない履歴は拒否します。

成功は`{schemaVersion:1,caseCount,measurementCount,verified:true,verification:"recomputed-from-saved-results",physicalAccuracyVerified:false,matches:[{measurementId,resultRevision,caseIndexes}]}`という要約で返します。これは保存場と記録の一致を示し、独立ソルバーとの一致や実物の精度を保証しません。既存履歴のrecordedEvidence/independentlyVerifiedフラグを書き換えません。

接続の`measurementVerify({expectedArchiveRevision,expectedCaseArchiveRevision})`は現在の履歴とケース集を版照合します。expectedCaseArchiveRevisionは生のcaseArchive JSON全体のSHA-256で、各記録の表示用結果版とは異なります。共有APIは`window.measurementApi.verify`です。

ライブ照合では先に`caseList()`と`measurementList()`を呼び、前者のarchiveRevisionをexpectedCaseArchiveRevision、後者のarchiveRevisionをexpectedArchiveRevisionへ渡します。ケース転送は不要です。verify応答は照合した履歴のarchiveRevisionとcaseArchiveRevisionも返します。

v2の検証・書出・取込は、同梱した全測定履歴を対応する表示用結果版のケースから再補間し、evidence全体の一致を必要とします。改変や孤立履歴は拒否し、自動で捨てません。既存のbundle7操作と100 MB分割転送を使い、GUIの一体保存操作もケース・ビュー・測定を扱います。保存場との一致は独立ソルバーや実物精度の証拠ではなく、履歴フラグは変更しません。

v2ホストのv1取込応答は`measurementsCleared:true`と、空履歴を含む実効v2の版を返します。v2の件数要約にはmeasurementCountを含みます。ローカル実画面でv1履歴クリア・v2再取込・書出バイト一致を確認した範囲は[検証記録](testing.md)を参照してください。

`caseBundleExport()`は読取専用で現在のスナップショットを固定し、その版を返します。呼出時expectedArchiveRevisionによる版の条件指定は行いません。取込開始のexpectedArchiveRevisionと確定時のCAS検査は必須のままです。

## ジョブ状態と実行資源の終了確認

既存のstatus・一覧・イベントに`executionSettled`と`resourceState:"pending"|"settled"`を追加します。cancel/timeoutは要求の終端状態を先に返せるため、stateがterminalでもexecutionSettled:falseなら実行終了を待つ必要があります。executeチェーンのfinallyで`resource-state`イベントを発行します。解放はterminalかつexecutionSettled:trueの場合だけ可能で、pendingの間は保持枠とrequestIdの冪等性を維持します。

内部`drain()`は呼出時点でpendingのジョブだけをスナップショットとして待ち、後から開始したジョブを含めません。`close()`は同期的な取消を維持します。これらは新しいMCP操作を追加せず、既存の状態・イベント・一覧から観測します。headlessのWorker終了待機と組み合わせた資源契約であり、V8クラッシュの根治を意味しません。

各view/list/eventは`releaseAllowed`も返し、terminalかつexecutionSettledのときだけtrueです。resourceStateのsettledはexecutor Promiseの終了を示します。executorは自己cleanup後に確定する契約ですが、ブラウザWorker.terminate()がvoidの場合はOSスレッド終了を確認した意味ではありません。終端後の拒否は通常Abortとcleanup異常をcoreで識別できないため、元の取消/期限切れerrorを維持し、`executionError:{code:"JOB_EXECUTION_REJECTED_AFTER_TERMINAL",message}`へ別記します。サービスのdrain/closeAsyncとMCP正常EOFの終了待機を追加し、同期closeは互換維持します。

ブラウザのanalysis-clientは終了要求後もactiveと遅着応答無視を維持し、terminateのvoid完了またはthenableの確定後に解きます。Worker作成後にもabortを再確認します。共通`analysisApi.isBusy()/drainJobs()/closeJobsAsync()`を追加し、接続の変更系は全体のisBusyも検査します。新しいwire操作は追加しません。GUIのrunはterminalかつexecutionSettledまで待ち、直近8件の整理はreleaseAllowedのジョブだけを対象にします。

## イベント履歴から独立した成果物カタログ

`studio_job_artifacts({jobId,offset:0,limit:50})`は保持中ジョブの登録済み成果物メタデータを列挙します。limitは最大100、応答はページとtotal/nextOffsetを含み、場の配列本体は含めません。NodeサービスのlistArtifacts、ブラウザ共通`analysisApi.listJobArtifacts`と、確認権限の接続`jobArtifacts({jobId,offset:0,limit:50})`でも同じ一覧を取得します。

イベントが切り詰められても、カタログから必要なartifactIdを再発見し、既存のstudio_job_artifact/jobArtifactで取得できます。一覧はファイルの再ハッシュを行わず、取得時に既存のハッシュ・版・メッシュ等の検証を実行します。release後の一覧・取得は拒否します。同一プロセス内のジョブ・メモリ保持上限は維持され、再起動からの永続復元を提供する機能ではありません。

## 中間場の部品境界を指定した点測定

中間メッシュは利用可能なnodeBodiesを保持し、節点ページにもnodeBodiesを含めます。`studio_job_artifact`と接続`jobArtifact`の点取得は`bodyIndex`・`elementIndex`を任意指定できます。これらはpointと併用し、複数部品の界面で未指定の点は最終結果のprobeと同じく曖昧として拒否します。bodyまたはelementを明示して対象を選んでください。最終`studio_probe`もbodyIndexを受け付けます。

部品IDを保持しない旧中間メッシュへbody指定はできません。欠けたnodeBodiesを自動復元・推定しません。版・メッシュ・ハッシュと既存の点補間検証を維持し、明示選択は物理的な接合条件の正しさを保証しません。

中間メッシュ要約は`bodyIdentifiersAvailable:boolean`と`bodyCount:number|null`を返します。旧IDなしメッシュのbodyCountは不明としてnull。節点ページのnodeBodiesはIDを保持する場合だけ含みます。

## ライブ入力の組込み形状作成

編集権限の`createBuiltinProject({expectedRevision,source,name?})`は現在の入力版を照合し、保存MCPのstudio_create_builtin_projectと同じ形状契約で新入力を作成します。mm指定のbox(bounds)、boxes（最大10、重複なし）、固定cylinder（半径12 mm・Y方向長さ60 mm）、sphere(center/radius)、tube(center/axis/innerRadius/outerRadius/length)に対応します。

作成候補と新しい版の計算を適用前に完了し、busy・期限切れ・許可失効・入力の途中変更は拒否します。conditionsは空配列、materialPropertiesは空オブジェクトの新入力で、既存条件や物性を黙って継承しません。通常の入力読込と同じく現在の結果を無効化します。既存ケース・ビュー・測定・印刷データの履歴を変更する操作ではありません。材料・支持・荷重などを設定し、必要な根拠とpreflightを確認してから解析してください。

ブラウザ共通APIは`window.builtinProjectApi.create({expectedRevision,source,name?})`です。接続MCPはこの同じアダプターを使用します。

## ソルバー別の中間観測能力

`capabilities.observation.profiles`はソルバー・モデル・実行method別に実装済みの中間観測を宣言し、`diagnoseExecution`とpreflightの`selectedObservation`で選択結果を確認できます。線形CPU PCGの反復、固有値残差、塑性/超弾性の荷重ステップ、熱の定常time0と過渡温度、過渡音響の間引いた圧力などを区別します。内部Newton残差や全反復の場を公開する宣言ではありません。

MFEM・WebGPUなど数値反復observerのない経路はstage/textの進行情報に限ります。調和音響・周波数sweepはBiCGStab、channelFlowはPCGの構造化残差を通知します。反復ゼロなら対応イベントが出ない場合があります。場が対応してもincludeFields保持off、共有64 MB予算、観測/計算失敗などにより取得は保証しません。観測宣言は実行可能性・物理妥当性とは別で、診断/preflightのallowedと必要入力・検証を引き続き確認してください。

各profileは`id/models/methods/events/textProgress/fields/limitations`を持ち、eventsはstage・任意solver・cadence・metrics(name/unit)、fieldsはkind/name/unit/timeUnit/cadenceを宣言します。selectedObservationはschemaVersion、target/operation/supported、profileIdとprofile、reasons、adaptive、fieldRetentionを返し、declarationOnly:true・physicalAccuracyVerified:falseです。fieldRetentionはrequested/available/maxBytes:64000000/eventRetention:256を含みます。adaptiveはenabled/structuredRoundEvents:false/meshPerRound/textProgressOnlyを返します。acousticSweepは構造化frequency-stepを通知します。adaptiveSolveはonObserveを受けず、構造化adaptive-round数値イベントは宣言しません。

カタログはブラウザ13プロファイル、Node12（WebGPUを除外）。共通eventsはpreparation/mesh/progressを宣言し、progressはWorker文字列をクライアントが変換するstageです。fieldRetentionはscalarFieldsSupported/meshSupported/meshAvailable/availabilityIsGuarantee:falseも含みます。availableはスカラーまたはベクトル場の保持要求が対応経路と一致することだけを示し、取得保証ではありません。数値場のないCPU経路でもmeshAvailable:trueになり得ます。診断MCPはincludeFields:boolean、preflightはadaptive/includeFieldsを受け付けます。不正な診断optionsはisError、preflightは構造化診断とselectedObservation.supported:falseを返します。保存analysisAssessment形式は変更しません。

## Node実行環境の読取メタデータ

MCPのstudio_capabilities・studio_diagnose_execution・studio_preflight_projectはトップレベルruntimeにNodeホスト情報を付けます。schemaVersion:1、kind:"node"と、allowlistのnode（process.version）・v8・platform・archの4値だけを報告し、欠落値はnullです。環境変数・実行ファイルパス・PID・hostnameは含めません。純粋なstudioApi.getCapabilitiesは引き続きportableな能力情報だけを返します。

既知のWindows x64・Node v24.11.1・V8 13.6.233.10-node.28と完全一致する環境だけ、knownIssueAssessment:observed-risk、warningコードNODE_WASM_ALLOCATION_FATAL_OBSERVED、status:unresolvedと保存証拠を案内します。他の環境はnot-assessedで、安全・非該当と判定しません。compatibilityVerified:false・rootFixProven:falseです。読取報告は実行拒否や既定runtimeの自動変更を行わず、入力診断allowedや保存analysisAssessmentを変えません。

knownIssueAssessmentは文字列で、diagnostics配列の該当1件にcode/severity:"warning"/status:"unresolved"/message/evidence/suggestionsを含みます。evidenceは`docs/evidence/2026-10-14-observation-profiles-v8-failure.json`の配列です。未評価環境のdiagnosticsは空で、Node26比較の成功を安全証明へ変換しません。

## ライブSTEP/STLの分割取込

共有`inputImportApi.import({expectedRevision,format,bytes,name?,scaleToMm?})`はformat:"step"|"stl"とArrayBuffer/Uint8Arrayを受け取り、新しい入力を作ります。接続は編集権限の4操作を使います。`inputImportBegin({expectedRevision,format,name?,scaleToMm?,totalBytes,sha256})`で元ファイルの版・サイズ・`sha256:64hex`を宣言し、`inputImportWrite({transferId,offset,data})`へ先頭から最大65,536復号バイトのcanonical base64を送ります。直前の同一チャンク再送を受理し、`inputImportCommit({transferId})`の重複確定も冪等です。`inputImportRelease({transferId})`で保持を解放します。共有転送は`inputImportTransfer.beginImport/write/commit/release`です。

1ファイル50 MiB、全体で100,000,000バイト・4件のstagingを保持します。これはピークヒープ制限ではなく、50 MiBの任意STEPを処理可能と保証しません。STEPは元バイトを保持しmmへ正規化。STLは正のscaleToMmを明示し、既存の閉・外向き・凸の単一シェル、最大2,000三角形の制限に従います。

候補を事前検証し、ブラウザの正規化と新入力版計算を済ませてからCASで適用します。既存の物性・条件は継承せず、通常の新規入力と同じく現在結果を無効化します。ケース・ビュー・測定・印刷の別ストアは維持します。入力変更・busy・失効・release・切断により遅いパース結果の確定を拒否します。

接続の取込transferは所有する接続だけが利用でき、他sessionからの利用は拒否します。命令期限は15秒で、任意の50 MiB STEPがその時間内に完了する保証はありません。取消中はCAD Workerの終了処理までlockを保持し、void terminateはOSスレッド終了の証明とは扱いません。

## 流体領域の準備とメッシュの表示適用

共有`window.fluidDomainApi.prepare(args)`と編集権限の`prepareFluidDomain`は`{expectedRevision,mode,enclosure,paddingMm?,seedPoint?,portPlanes?,name?}`を受け取ります。modeはexterior/internal。外部は元solidから作り、enclosure:"box"|"sphere"とpaddingMmで囲いを指定します。内部は明示したenclosure:[x,y,z,dx,dy,dz]、seedPoint:[x,y,z]、portPlanesを使い、既存domainから元solidを取り出すこともできます。座標はmm。元形状はSTEPまたは対応組込みsolidで、STLは対象外です。

新しい入力としてstudy.kind:"fluidDomain"を設定し、物性・条件・選択・根拠・解析intentをクリアします。元設定を流体へ推測で移しません。通常の新入力と同様に現在結果を無効化し、別保存の履歴は維持します。現在の入力版・busy・失効を検査します。

更新された入力版でstartJobのmeshを実行し、成功かつexecutionSettledを確認後、`window.fluidDomainApi.applyMesh({expectedRevision,jobId})`または編集権限の`applyFluidDomainMesh`へ渡します。入力版とcanonical入力、source fingerprint、meshを検証し、sourceHash付きgmsh-surfaceを表示入力へ適用。studyはfluidDomainを維持し、流体物性や解析種別を自動推定しません。応答のdomainSelectionはports最大100件/truncated、壁件数とchannelなどの有界な要約です。反映後は新しい入力版を取得してください。

内部ポート番号は0/1/2がX/Y/Z最小、3/4/5が最大です。軸平行の箱面と単一のseed連結領域という既存制限を維持します。一般3D流体・任意方向の開口蓋・境界層・乱流の追加ではありません。詳細は[外部領域](fluid-domains.md)と[内部領域](internal-fluid.md)を参照。

## 保存ケースを温度・振動の連成源へ設定

共有`window.caseSourceApi.apply({expectedRevision,caseId,caseRevision,kind,modeIndex?,amplitudeMm?,phaseDeg?})`と編集権限の`applyCaseSource`は、現在入力とcaseListで読んだ保存ケースの両版を照合します。kindはtemperature/vibration。保存元を固定して候補を検証し、最終同期照合後にだけ適用します。別ケースへの暗黙の置換や物理条件の推測は行いません。

温度源は現在study.kind:structuralかつthermalStress:trueを明示しておく必要があります。熱ケースのsolidと現在solidは完全一致し、接触メッシュのnodeBodiesも検証します。振動源は現在acoustic・exteriorRadiation:true、非過渡・非sweep、fluidDomain.solidが保存した直方体solidと一致し、現在周波数が選択モードの周波数と一致する必要があります。modeIndex/amplitudeMm/phaseDegの3値を全て明示し、既存振幅制限に従います。音圧境界との競合は拒否します。固有モードから実応答振幅を推定しません。

`window.caseSourceApi.clear({expectedRevision,kind})`と接続`clearCaseSource`は指定したsourceだけを除去し、studyの他の数値・物理設定・条件は維持します。既存の物性根拠は従来の値スナップショット照合のままで、自動確認や昇格を行いません。既存GUIの熱/モード連成を共通化する機能で、新しいソルバーではありません。

sourceとその祖先`/study`の既存根拠entryは、場の数値が同じでも出典が変わるためunconfirmedへ戻し、assumption:null・confirmation除去とします。他の根拠とanalysisIntentは保持します。source内に`caseReference:{schemaVersion:1,caseId,revision}`を保存し、revisionは内容ハッシュで追跡します。caseIdは実行時IDで、再読込後の永続lookupを保証しません。保存熱場を使う構造熱応力は下記のnonlegacy根拠契約に対応します。モード音響連成は別の適用制限に従います。適用成功は定量妥当性の保証ではありません。

温度源は接触だけでなく複数boxesのsolidでもnodeBodiesを必要とし、部品IDのない旧ケースを拒否します。振動源の境界競合には手動音圧だけでなくインピーダンス条件も含みます。

## 表示表面の版付き検査

確認権限の`inspectSurface({meshIndex,toleranceMm?,problemOffset?,problemLimit?})`と保存MCPの`studio_inspect_project({path,surfaceInspection:{meshIndex,toleranceMm?,problemOffset?,problemLimit?}})`は、単一の明示meshIndexを対象に表面を読み取ります。保存MCPではreport.surfaceInspectionへ結果を追加します。problemLimitは既定100・最大200です。problemTriangleCountは全問題数、problemTrianglesは全体からのページで、problemOffset/problemLimit/nextProblemOffsetを返します。nextProblemOffset:nullは末尾、problemTrianglesTruncatedは後続があることを示します。旧検査関数の既定1,000件prefixからページを切る方式ではありません。

境界辺・非多様体辺・向き不一致・退化/重複三角形・成分・閉鎖辺トポロジーと、可能な場合の符号付き体積mm³を返します。toleranceMmは正の有限値で、指定しない場合は表示寸法に基づく既存許容差を使います。元source/表示データは変更しません。問題三角形の添字は返却したプロジェクトrevisionに限定され、必要ならその版をeditのexpectedRevisionとしてselectTrianglesを使います。

自己交差・厳密CADは未検査で、自動修復はしません。closedEdgeTopologyがtrueでも単一の外向き・妥当な実形状や体積メッシュ生成を保証しません。穴・重複・向きは元CAD/メッシュで修正して再読込してください。

新reportはflat形式でrevision（全projectのSHA-256）、meshIndex、units:{geometry:"mm",volume:"mm3"}、basis:"display-triangles"、cadExactGeometryChecked:false、geometryModified:false、limitationsも含みます。共有の検査関数はinspectProjectSurface(project,options)です。

有限な各三角形でも符号付き体積の全体集計が数値範囲を超える場合は拒否し、InfinityをJSONのnullへ変換して返しません。

ページを結合するときはrevisionだけでなくmeshIndexとtoleranceMmも同一に固定してください。初回に返ったtoleranceMmを後続呼出へ明示すると再現できます。許容差を変えると同じ入力版でも問題集合が変わるため、revision一致だけでは検査条件の一致を保証しません。

## 非線形構造の荷重ステップ変位場

塑性・超弾性の収束した荷重ステップは、includeFields:trueのときだけ`kind:"structuralDisplacement"`の変位場を観測・転送します。保持offでは新しい変位ベクトルの生成・転送を行わず、最終resultの数値は変えません。fieldRetention.availableはスカラーまたはベクトル場の保持適格性を示し、scalarFieldsSupportedとvectorFieldsSupportedを別に返します。取得保証ではありません。

field要約はsolver:"plasticity"|"hyperelastic"、step/steps、実際のloadFactor（除荷を含む0〜1）、minimumMagnitudeMm/maximumMagnitudeMmとdisplacement/mmを返します。stepは物理時刻ではなく、timeを含めません。ページの変位は`displacementMm:[[x,y,z],...]`で、既存スカラーpage.valuesとは別です。pointの測定はdisplacementMm・magnitudeMm・step/steps/loadFactorを返します。応力・内部Newton残差を含まず、ステップ収束はジョブ全体の最終収束・数値精度・物理妥当性を保証しません。中間成果物は常にprovisionalです。

既存のnodeBodiesとbodyIndex/elementIndexの曖昧点拒否、入力/メッシュ/ハッシュ照合、共有64 MB・256イベント保持、解放条件を維持します。形式・単位・3Nベクトル・step範囲・変位の大きさの有限性を検査し、不正なtime/応力項目や数値オーバーフローを拒否します。

## 熱伝導の確認済み入力・仮定契約

quantitative/exploratoryの熱伝導は`thermal-conduction`契約を使います。conductivity、study.transient、volumetricSourceを明示し、過渡ではdensity/specificHeat/timeStep/steps/initialTemperatureも必要です。各temperature/heatFlux/heatPower/convection/radiation/thermalContactのtype/value/regions、存在するCAD平面/円筒等の指定、対流・放射のambientTemperatureに根拠を登録します。接触は2部品の対領域と正のconductanceを必要とします。温度は絶対零度以上、定常は温度/対流/放射のanchorを必要とし、メッシュ後に各連結成分の境界転送を検証します。

quantitativeは必須根拠の確認済み状態、exploratoryは明示した値と仮定を要求し暫定とします。未入力値を仮定だけで補うことはできません。runtimeのtransient/volumetricSource/timeStep/steps/initialTemperatureは保存studyと同値の場合だけ受け付け、不一致の物理上書きを拒否します。放射反復の初期seedや数値反復上限は新しい必須根拠に含めません。

legacy熱入力は従来のrequiredPointers:[]・requiredInputContract:"unsupported"・limited警告を維持し、既存allowedとschema1保存assessmentの互換性を保ちます。capabilities.preflight.requiredInputContractsは静的等方構造、等方固有振動、静的直交異方構造、温度評価・熱応力、J2・Neo-Hookean構造、熱伝導、音響、対応する限定流体の契約を一覧化します。元sourceModel全体の新しい根拠登録は要求せず、CADの真偽認証は行いません。completePreflight:falseとremainingChecksは維持し、出典適用性・品質・境界転送・収束・メッシュ依存性・物理精度の確認は残ります。

熱の単位は温度degC、conductivity W/(m·K)、specificHeat J/(kg·K)、密度kg/m³、volumetricSource W/m³、heatFlux W/m²、対流/接触conductance W/(m²·K)、timeStep秒です。自動の単位変換・物性推測を行いません。

## 連成元の暫定判定の継承

温度/振動sourceは利用可能なschema1のsourceAssessmentをコピーします。連成が有効な場合、sourceAssessment.provisional:trueを現在のpreflight/保存結果のprovisionalへOR伝播し、派生先がlegacyでも元の明示仮定を非暫定へ消しません。mode・既存allowed・schemaVersion1・remainingChecksは維持します。旧GUIの熱ケース適用/モード音源作成も同じ処理を使います。metadataのない旧sourceは互換維持し、不正なsourceAssessmentはvalidatorで拒否します。出典の暫定性を保持する処理で、定量確認を追加するものではありません。

heatPowerも熱境界のtype/value/regions根拠に含み、単位はWです。sourceAssessmentを含む保存結果から元metadataを削除して暫定性を落とす改変は保存結果検証で拒否します。

## 限定流体のnonlegacy必須入力・根拠

quantitative/exploratoryの`fully-developed-channel-flow`と`external-creeping-stokes-flow`は、study.kind・dynamicViscosity・fluidDensity、明示的な空conditions、sourceModel.kindを共通必須とします。channelはflowAxis/pressureDropPa/fluidSoundSpeedと対応した直管形状の寸法が必要。箱はbounds、固定円管はY軸1、内部CAD領域はenclosure/mode/seedPoint/portPlanesと元solidの小さい寸法メタデータを使います。

StokesはfreeStreamVelocity/referenceLengthMm/stokesVelocityElement(P1|P2)、外部箱enclosureと元solid寸法を明示します。STEP本体データを根拠へ複製する契約ではありません。Re≤0.1を事前検査し、元部品bboxより小さくない基準長・境界の整合性はメッシュ後にも確認します。内部Stokesの別adapterは未接続で明示的に非対応です。

runtimeのkind/dynamicViscosity/fluidDensity/fluidSoundSpeed/pressureDropPa/flowAxis/freeStreamVelocity/referenceLengthMm/stokesVelocityElementが保存studyと異なる場合はFLUID_RUNTIME_OVERRIDEで拒否し、同じ値は受け付けます。nonlegacyの不足値をsolver既定や仮定だけで埋めません。legacyの契約helperはrequiredPointersと診断を空配列で維持します。preflight全体では従来のPREFLIGHT_CONTRACT_LIMITED警告を維持します。channelのCAD同定・Re/Mach・流量収支、Stokes境界・メッシュ依存性・物理精度は別の後検証で、allowedは保証ではありません。単位は粘度Pa·s、密度kg/m³、速度m/s、圧力差Pa、寸法mmです。

## 音響波のnonlegacy必須入力・根拠

`acoustic-wave`はstudy.kindとacousticTransient/sweep/exteriorRadiation/directivityEnabledの明示boolean、frequency/soundSpeed/airDensity/lossFactorを要求します。調和音響はreferencePressurePa、過渡はacousticDuration/pulseWidth/acousticTimeStep/dampingRate/receiverPointが必須で、timeStepの0も自動選択の明示値です。sweepはsweepStart/End/Countとreceiver、directivityはaxis/points/distance、外部放射は球形enclosureを記録します。

音響境界のtype/value/regionsと存在するCAD patch、impedanceの明示reactanceと存在するtableも根拠対象です。振動sourceはスカラー設定とcaseReference（存在時のidentity）、旧形式で参照がない場合はmesh/displacement配列の根拠が必要で複製コストがあります。sourceAssessmentがあればその根拠も要求します。出典の真偽やメッシュ後の被覆を認証する処理ではありません。

異なるruntime物理値は拒否し、現公開経路で無視されるinitialPressure/radiationBoundary/normalVelocityは常に拒否します。legacyの契約helperは空で互換維持し、preflight全体の従来PREFLIGHT_CONTRACT_LIMITED警告も維持します。nonlegacyの不足物性・境界・時間/周波数は既定や仮定だけでは埋めません。preflight.allowedや確認済み根拠は数値/物理精度の保証ではありません。

studio_probeは保存結果を検証したanalysisAssessmentがある場合に追加で返します。metadataなしの旧保存結果には追加せず、点値だけで確認済み/非暫定を推測しません。

## Stokes GMRESの構造化反復残差

P1/P2 Stokesは`stage:"iteration",solver:"stokes-gmres"`、velocityElement、iteration/residual/tolerance/convergedとphase/residualKindを返します。残差は全て無次元で、途中の速度・圧力場配列は提供しません。既存のjobEvents経路を使い、中間値は常にprovisionalです。

restart-check/preconditioned-relativeはGMRES外側ループの先頭（初期iteration0を含む）で測定する、平衡化・左ILU0前処理された縮約系の相対残差。arnoldi-estimate/preconditioned-relative-estimateは同じ系のArnoldi推定で、最初のinner iteration・10反復ごと・許容差/happy break/上限/再開区切り直前に重複なく通知します。推定値を元の運動量式残差と読み替えないでください。

final-check/true-relativeは既存の元の無次元full systemの自由方程式残差をrawRhsノルムで正規化した数値検査が1e-8を満たした後の通知です。zero RHSでGMRESを省略してもiteration0のfinal-checkはあります。各convergedはその残差条件のみを示し、後続のregime検査等で失敗することがあります。ジョブ終端の成功、流量収支・メッシュ独立性・実物精度を保証しません。

## 調和音響・流路の構造化残差と周波数進行

既存のjobEvents/studio_job_eventsで取得します。profile IDはacoustic-frequency/channel-flowを維持し、一覧はブラウザ13・Node12、MCPは27/29ツール・ライブ80操作のままです。両profileのfieldsは空配列で、中間の音圧・速度場を追加しません。includeFieldsはこれらの数値場を有効化する設定ではありません。

調和音響の反復はstage:iteration、solver:bicgstab、kind:acoustic、frequencyHz、solvePhase:single|sweep、iteration/residual/tolerance/converged、residualKind:recurrence-relativeを持ちます。phase:s-checkは中間s残差の許容差到達、r-checkは通常の更新残差、zero-rhsは零右辺でiteration:0/residual:0/converged:trueです。通常更新は最初・25反復ごと・収束時・反復上限時に通知します。

周波数スイープはstage:frequency-step、solver:acoustic-sweep、kind:acoustic、phase:start|complete、step/steps/frequencyHzを返します。startのconvergedはnull、completeはtrueで、metricsにresidual/iterations/peakPressurePa/splDbを含みます。sweep内の反復はsolvePhase:sweepとstep/stepsを持ち、先行する単独調和解析のsingleと区別できます。失敗周波数ではstart後のcompleteを保証しません。frequencyHzはHz、音圧はPa、SPLはdBで、stepは物理時間ではありません。

流路の反復はstage:iteration、solver:pcg、kind:channelFlow、residualKind:recurrence-relative、iteration/residual/tolerance/convergedです。既存PCGの最初・25反復ごと・許容差到達の頻度を維持し、零右辺では反復イベントを出しません。

両残差は消去後右辺ノルムに対する再帰更新残差で無次元です。独立に再計算したtrue residualではなく、Stokesのfinal-checkと区別してください。convergedはその数値条件だけを示し、後続の放射/測定/流路Re・Mach等の検査失敗やジョブ失敗はあり得ます。物理精度・保存完了・メッシュ独立性の保証ではありません。イベントは256件保持の上限とcursor gapを考慮し、終端状態も確認します。

非有限の残差・許容差は通知を省略し、不正値を正常値やJSON nullとして返しません。sweep completeもmetricsのresidual/iterations/peakPressurePa/splDbが全て有限の場合だけ通知します。計算・停止条件や元のエラーは変更せず、通知がなくてもジョブ終端の失敗を確認してください。

## 任意のNode解析プロセス分離

MCP起動時に`node scripts/studio-mcp.mjs --analysis-isolation=process`を明示すると、各保存入力ジョブを同じNode実行ファイルの子プロセスで実行します。既定は従来のworker分離のままです。ブラウザのnative Workerや既定runtimeは変更しません。ツール27/接続29・80操作も不変です。

プロセス分離はジョブの異常終了を子に封じ込め、MCPホストを維持するための任意経路です。再試行せず、失敗はcode:ANALYSIS_PROCESS_EXITのruntime-failureイベントに制限付きstderr末尾とハッシュを残します。終了処理はprocess closeを待ちます。実行ファイルやshellをwire引数で指定する機能はありません。V8自体の修正や全モデルの互換性・物理精度の保証ではなく、失敗した入力/出力/成果物を確認して新要求として再実行してください。

現在の封じ込め試験はcontrolled exit86を使い、実際のV8 native fatalを再現した試験ではありません。親プロセス切断時の子の終了はbest effortで、同期native処理中はdisconnectハンドラが遅れるため即時終了を保証しません。

子のstdout/stderrは各先頭64 KiBまで転送し、診断末尾はUTF-8で4,096 byte以内、SHA-256とbyte数はstderr全体を対象にします。これは保持量の上限であり子のheap上限ではありません。結果メッセージ受信だけでは保存せず、子の終了を確認してから親が最終結果を公開します。実行方式はcapabilities.executionIsolation、process保存結果はcalculation.execution.isolationから確認できます。

## 等方固有振動・静的直交異方構造の必須入力と根拠

quantitative/exploratoryの`modal-isotropic-structure`は、CPUの等方線形弾性・lumped Tet4質量の固有値問題を対象とします。`study.kind:"structural"`、`modalAnalysis:true`、`gravityEnabled:false`、正のdensityを明示し、温度表を使わないときはyoungModulusとpoissonRatio（−1より大きく0.49未満）の根拠を登録します。`modeCount`（1–6）と`modalIterations`（1–100）は保存studyへ明示必須ですが、数値設定なので物理根拠の必須Pointerには含みません。

`dependence.elasticTemperatureTable`による等方剛性の補間も対応します。2–100行の温度順の表とdependence全体に根拠を登録し、`study.materialTemperature`を明示してください。温度は均一で、表の範囲内だけを線形補間し外挿しません。この場合、独立した基準youngModulus/poissonRatioは必須ではありません。温度有効範囲がある場合や評価温度を指定する場合も、その値・範囲を根拠登録します。熱応力や熱による初期応力を含む固有値解析ではありません。

固有振動はfixedまたは零変位の支持を必要とし、force/pressure/normalTractionは厳密に零だけを許可します。全条件のtype/value/direction/regionsと存在するframe/planarRegion/cylindricalRegionが根拠対象です。fixedのvalue/directionは保存形式の有限値として保持しますが、ソルバーは全方向零固定として扱います。重力・非零荷重・非零強制変位・塑性・超弾性・直交異方性・adaptive・MFEM/WebGPUは対象外です。モード形状は最大変位1 mmの任意正規化で、動的応答振幅や疲労荷重ではありません。

`static-orthotropic-linear-structure`はCPUの静的直交異方線形弾性です。`materialProperties.orthotropic`のmodel、youngModuliPa、poissonRatios、shearModuliPa、右手正規直交axes、source、testConditionsをすべて明示して根拠登録します。定数・軸・コンプライアンスの妥当性を検査し、等方定数で補いません。study.kindとgravityEnabled、全構造境界のtype/value/direction/regionsと存在する選択・局所座標定義が必須です。重力有効時はgravityと正のdensity、材料の温度範囲がある場合や温度を指定する場合はmaterialTemperatureと登録範囲も必要です。dependenceがあればその根拠も登録します。速度依存構成則や正の最小ひずみ速度、等方温度表、熱応力、固有振動、非線形材料、MFEM/WebGPUは拒否します。対応CPU経路のadaptiveは利用できます。

実行時の物理値は保存入力の代わりになりません。modalのstudy指定は保存値と同じ場合だけ許可し、runtime材料・荷重・境界の注入は拒否します。orthotropicも異なるstudy/材料/conditionsを拒否し、solver用boundary/fixed/forces等の直接指定は空でも拒否します。`null`で未設定の物理入力を上書きすることも認めません。根拠付きprojectを編集し、再検査してください。

未測定値は値と適用理由を明示したexploratory仮定として扱い、暫定状態を維持します。quantitativeは必要根拠の確認済み状態を要求します。欠落値を仮定だけで埋めることはできません。legacyの既存挙動と保存assessment互換は維持し、新契約helperはlegacyで根拠を要求しません。未対応の物理・材料の組合せは引き続きlimitedです。常に`completePreflight:false`であり、メッシュ品質、境界転送、拘束rank・剛体モード、質量、収束、メッシュ依存性、資料の適用性と物理精度は後検証に残ります。

## 静的温度評価・熱応力・非線形構造のnonlegacy契約

quantitative/exploratoryの`temperature-dependent-isotropic-structure`は、静的等方構造でmaterialTemperature、材料temperatureMin/Max、dependenceを使う経路にも適用します。均一の`study.materialTemperature`を明示し、E/nuまたは弾性温度表、存在するdependence各項目と温度範囲、全境界・重力設定を根拠登録します。表の範囲内補間だけに対応し、速度依存や正の最小ひずみ速度は拒否します。

`thermal-stress-isotropic-structure`は`study.thermalStress:true`、有限のexpansion（負・零も可）、絶対零度以上のtemperature/referenceTemperatureを明示します。保存temperatureSourceがある場合は転送場を使用しますが、保存形式上のstudy.temperatureも必要です。sourceのname、mesh、temperatureはcaseReferenceの有無に関係なく根拠対象で、存在するcaseReference/sourceAssessmentも追加対象です。caseReferenceは出典の補助同定で、場の真正性を認証しません。根拠には場配列の値snapshotも複製するため、プロジェクト・転送サイズが増えます。sourceAssessment.provisional:trueは派生解析にも伝播し、確認済みの受取側根拠で解除できません。複数部品/接触のbody同定、転送範囲と領域外ノードは後検証です。非一様場と弾性温度表は併用できません。熱応力の疲労/破壊評価は拒否します。対応するCPU、MFEM/WebGPU構造経路を利用しますが、target別能力と観測対応を別途確認してください。

`small-strain-j2-structure`はE/nu、plasticity.model/yieldStress/hardeningModulus/testConditionsを明示し、正の降伏応力・硬化係数と−1<nu<0.49を要求します。塑性荷重履歴`study.plasticLoadFractions`は物理根拠対象です。1–30値、各[0,1]、最初/最後>0、最大1で除荷・再負荷を表現でき、nonlinearLoadStepsがあれば長さを一致させます。履歴を省く単調載荷は明示したnonlinearLoadSteps（1–30）に根拠を要求します。Newton反復上限は数値設定で物理根拠不要です。

`finite-strain-neo-hookean-structure`はhyperelastic.model/shearModulus/bulkModulus/testConditionsと存在するtestCurveを根拠登録します。mu>0、2/3≤K/mu≤20の圧縮性モデルで、近非圧縮性には対応しません。非線形増分数とNewton反復上限は数値設定であり、省略時は既存の10増分/30反復を使います。Neo-Hookeanは死荷重force・固定・強制変位・重力だけに対応し、pressure/normalTractionを拒否します。

両非線形契約は全境界/局所座標/選択定義、明示した重力意図、必要時の密度・加速度、存在する材料依存/温度適用範囲と評価温度を根拠対象にします。CPU pcg/pcg-strict/wasm-pcgのみで、adaptive・modal・熱応力・直交異方性・弾性温度表・速度依存・疲労/破壊評価は対象外です。異なるruntime物理値やsolver直指定のloadSteps/loadFractions/境界等を拒否し、保存入力を編集する経路を使います。J2の主ひずみ絶対値≤0.02、Neo-Hookeanの正Jacobian、拘束rank・収束・メッシュ依存性・物理精度は後検証です。

これらの追加はlegacyや保存assessment形式を変更しません。quantitativeは確認済み根拠、exploratoryは明示値と仮定・適用理由を必要とし、暫定状態を維持します。`completePreflight:false`は根拠の真偽・適用性や数値/物理精度が保証されないことを引き続き示します。

## 実行失敗の構造化診断

Workerが捕捉した実行失敗には、従来のmessageを維持して`failure:{schemaVersion:1,code,stage,message,diagnostics}`を追加します。各診断はcode/severity/stage/target/message/evidence/suggestions/requiresUserIntentを持ちます。failure全体は最大16,384 UTF-8バイトで、message・根拠・提案・診断数にも上限があります。stack/causeや任意Errorオブジェクトは転送せず、無効な受信metadataは破棄して従来messageを残します。

拘束不足・競合や境界転送の一部はcoreで付与した型付きcode・対象Pointer・有界根拠を返します。その他はpreparation/mesh/boundary-transfer/constraints/temperature-transfer/material-evaluation/solve/postprocess/unknownのstageに応じた汎用codeです。stage fallbackは原因の特定や修正の証明ではありません。suggestionsは調査案であり、自動で支持を加える・荷重面を変える・物性を推測する権限ではありません。

非同期ジョブは既存の`error.code`（JOB_FAILED/JOB_CANCELLED/JOB_TIMEOUT）とmessageを維持し、取得できた診断を`error.failure`へ保持します。中止・timeout後の実行拒否は`executionError.failure`へ保持し、既存のJOB_EXECUTION_REJECTED_AFTER_TERMINALを変えません。cleanupのAggregateErrorでは取得できる最初のprimary診断を保持し、cleanupをソルバー原因へ置き換えません。直接MCP失敗は`isError:true`と従来textに加えて`structuredContent.error.failure`を返します。GUIラッパーもmetadataを保持しますが、すべての失敗が型付き診断を持つわけではありません。

観測要求時は捕捉Worker失敗を`stage:"diagnostic"`、failure、converged:false、provisional:trueのeventで終端error前に通知します。ただし中止・通信断・callback例外・retention等で取得は保証されません。profile宣言だけからeventの到着を断定せず、job状態と残る診断を確認してください。失敗した解析は最終解析JSONを保存しませんが、既に生成したメッシュや中間成果物は残り得ます。診断対応は根本原因の修正完了・数値収束・物理精度の証明ではありません。13ブラウザ/12 Node profile、27通常/29接続MCPツール、ライブ80操作は変更しません。

## 接続前のブラウザ操作契約の取得

`studio_browser_contracts({method?,scope?,offset?,limit?})`は通常MCPでも常時使える読取専用ツールです。セッションや接続コードなしで全81操作の宣言を調べます。まず例として`{method:"setResultView"}`を取得し、必要引数・revisionFields・units・sideEffects・limitationsとscopeを確認してから、必要な権限を明示接続したセッションの`studio_browser_call`を使ってください。scopeはinspect/edit/analyze/viewで絞れ、methodと併用できます。offsetは既定0、limitは既定5・最大10で、返るnextOffsetがnullになるまで続けます。UTF-8応答は最大65,536バイトで、件数上限より前にページが分割される場合もあります。

共有APIは`studioApi.getBrowserOperationContracts(query)`です。応答はschemaVersion/contractVersion:1、target:browser、declarationOnly:true、requiresBrowserGrant:trueとDraft 2020-12のschemaDialectを持ちます。inputSchemaは命令envelopeと記載したnested項目の宣言で、完全な物理・アーカイブ・相互参照検証を表現するものではありません。実adapterの引数・版・適用性・物理検証が引き続き優先されます。inspect/capabilitiesは発見先だけを案内し、大きな契約一覧を埋め込みません。

取得しても権限は付与されず、任意adapterの利用可能性や実行成功を証明しません。通常29・接続31ツールへ増えますが、ライブ操作数81とprofile13/12は変わりません。以前の節の27/29は当該機能追加時の記録です。また直接ブラウザ操作がthrowした失敗はconnectBrowserSessionからHTTP bridge/MCPまで検証済みfailure metadataを保持します。jobStatusのerror.failure保持は従来どおりであり、nested診断形式や物理検証の範囲を変更するものではありません。

## 入力編集の読取専用プレビュー

`studio_preview_edit({path,expectedRevision,operations,method?,size?,operation?,mode?})`は保存入力へ同じ意味的編集バッチを仮適用し、候補の変更点とpreflightを返します。出力ファイルを書かず、ソルバーも起動しません。共有APIは`studioApi.previewOperations(operations,{expectedRevision,options?,operation?,mode?})`、ライブ接続はinspect権限の`previewEdit({expectedRevision,operations,options?,operation?,mode?})`です。計算中でも次の設定案を検査でき、実行中ジョブや表示入力は変更しません。検査途中で現在入力版が変わる場合は競合として拒否します。

応答はschemaVersion:1、previousRevision、候補revision、operationCount、changedPointers:{pointers,total,truncated,maxPointers:100}、summary、preflightです。完全な候補projectやoperationsを返さず、最大100の変更Pointerを通知します。編集命令が妥当ならpreflight.allowed:falseでも診断を返すため、プレビュー応答の成功を解析実行可や物理妥当性と取り違えないでください。

候補を確認後、同じ元expectedRevision・operationsに加えて`expectedResultingRevision:preview.revision`をeditまたはstudio_edit_projectへ渡すと、適用候補の版が一致する場合だけ確定します。これを省略する既存呼出しの互換は維持します。プレビューは編集権限を付与せず、確定には従来のedit権限・入力版・busy検査が必要です。現在は通常29/接続31ツール・ライブ81操作。P0/P1/P3の全条件、完全物理検証や残りの計画は未完了です。

プレビューのpreflightは完全な検査結果からallowed/provisionalを保持しつつ、返却診断を最大50、requiredPointersを最大100へ限定し、reportPageで総数とtruncatedを示します。根拠配列は値を返さずlength/omitted、長い文字列は長さ、深さ3・16keyを超える物体も省略を明示します。完全な診断は既存preflight APIで確認してください。返却value JSONは最大65,536 UTF-8バイトで、超過時はEDIT_PREVIEW_RESPONSE_LIMITとして入力不変のまま拒否します。これはMCPのcontent.textとstructuredContentへの二重格納を含むRPC総量の上限ではありません。

ブラウザではtrusted hostの純粋normalizeProjectをGUIと共有し、study既定値やms/µs表示変換など、実際に保存される表現を候補へ先に反映します。応答のnormalizationはapplied:true、previousRevision（未変換候補）、revision（最終候補）、changedPointers、requiresReview、noteです。requiresReview:trueなら変換点を確認してから最終revisionを承認してください。未変換候補の版は確定に使いません。最終候補にpreflightとexpectedResultingRevision照合を行い、その後だけcommitします。normalizerはwireから指定できず、保存JSON用Node MCPにはGUI変換を入れないため、同じ元入力でもbrowser/nodeの候補版は異なり得ます。既定値やinactive fieldの表現差を無視して一致を推測しないでください。

## 保存・ライブ入力を小さいページで検査する

共有`studioApi.inspectInput({section:"study",pointer?,expectedRevision?,offset:0,limit:20})`とinspect権限のライブ`inspectInput`で、現在入力の値を変更せずに取得します。保存入力MCPは既存`studio_inspect_project({path,section:"study",pointer?,expectedRevision?,offset?,limit?})`を使います。sectionはproject/study/material/conditions/provenance/selection/source/meshes/meshSettings/units/intentで、共有・ライブの既定はprojectです。MCPはsectionを明示するとこの専用応答だけを返し、旧geometry/face/full-study応答と混載しません。

返答はschemaVersion:1、入力revision、section、pointer、exists、既知のunits、limitationsと、存在する値のdescriptor、必要に応じたpageです。objectはkey順の最大50件、arrayは最大200件、既定20件でoffset/nextOffsetを使います。nested配列/物体はlength/keyCount/sha256/omittedの要約です。返ったabsolute JSON Pointerを選択section内で指定して必要部分へ掘り、毎回expectedRevisionを渡してください。`~`は`~0`、`/`は`~1`にescapeします。不正Pointerやsection外への移動・旧版は拒否します。存在しない値はexists:falseで、推測値を作りません。

sourceのSTEP等data文字列や大きい文字列も値をdescriptorへ展開せず、長さとopaqueなhashを返します。明示した文字列Pointerでは最大200 UTF-16 code unitsずつ取得できます。hashは正規化JSON値のSHA-256であり、元STEPファイルのbyte hashとは別です。単位はアプリが知る物性・条件・温度場・形状などに限り、未知単位を推測しません。応答value JSONは最大65,536 UTF-8バイトで、INPUT_INSPECTION_RESPONSE_LIMIT時はlimitを下げます。モデルを保存・編集せず、全体を複製して返すこともありませんが、identity/hash計算は元入力を扱うため計算量まで一定ではありません。

例: `studio_inspect_project({path,section:"conditions",limit:20})`でrevisionとPointerを得た後、同じrevisionで`{path,section:"conditions",pointer:"/conditions/0",expectedRevision:revision}`を読みます。必要値と根拠を確認してからpreview/editへ元revisionを渡し、必要ならpreview.revisionをexpectedResultingRevisionに使います。検査は根拠の真正性や物理適用性の保証ではありません。

互換用のsection無しstudio_inspect_projectは従来shapeを維持し、巨大study/source配列を含み得るためboundedと扱いません。section無しでpointer/offset/limit/expectedRevisionは使えず、sectionありでmeshIndex/faceOffset/faceLimit/surfaceInspectionとの混在も拒否します。実登録serverが旧版なら新引数の対応を仮定せず、必要時は明示したローカルrepo fallbackを使います。ツール数29/31は変えず、ライブinspectInputを加え82操作です。

編集/previewの位置引数は数値・真偽値・null・record・通常のネスト配列を明示した共通JSON schemaを返す。これは各methodの位置・物理検証を置き換えない。登録済みクライアントが古いargs:string[]を投影している場合、数値やrecordを文字列化して合わせず、登録schemaの更新を確認するか、明示したローカルcallStudioTool経路を使う。現hostの投影改善は未確認であり、生MCP契約の成功と区別する。

## 中間メッシュの接続を要素ページで取得する

`studio_job_artifact` / 接続 `jobArtifact` に `pageKind:"elements",offset:0,limit:200` を指定すると、同じ中間メッシュの四面体接続を取得します。pageはkind/offset/count/total/nextOffset/hasMoreとtetrahedraを返し、利用可能な場合だけelementBodiesを含みます。各四面体はメッシュ全体の節点番号4個で、要素番号はoffset+iです。通常のnodesページの節点番号もoffset+iなので、同じartifactの節点座標と接続を組み合わせて再構成できます。適応再メッシュ後の最終メッシュを途中場へ流用しません。

既定pageKindはnodes、limit既定0は概要のみです。elementsは要素数を基準にoffsetを検査し、最大200件。point/bodyIndex/elementIndexによる測定との混在は拒否します。取得時の既存ハッシュ・入力版・メッシュ同一性検査とprovisionalを維持し、物理妥当性の証明とは扱いません。

共通analysisApiのdrainJobsは呼出時点の旧analyze/generateMeshも終了まで待機し、取消しません。closeJobsはそれらも取消要求し、closeJobsAsyncはWorker終了確定まで待ちます。戻り値のjobIdsは登録ジョブのみで、旧直接実行にIDを作りません。

`includeFields:false`では熱・過渡音響の中間場配列をWorker側で生成・転送せず、時刻・指標の要約は維持します。最終結果や保存用snapshotの保持は別です。直接solver APIの既定観測は維持し、明示したobserveFields:falseで中間場だけを抑制します。64 MBは格納済み観測JSONの予算で、待機イベントやピークヒープの上限ではありません。

## 成功ジョブの完全結果を表示せず保存する

確認権限の接続jobResultExport({jobId,inputRevision})は、succeededかつexecutionSettledのジョブからinput/calculation/mesh/boundary/resultを含む保持出力を読み取り、分割取得用snapshotを作ります。現在入力Bのまま入力Aの結果を取得でき、showJob・caseSave・入力復元は不要です。metadataのschemaVersion:1、format:analysis-output、jobId/inputRevision/kind、totalBytes/sha256/hashBasis:raw-utf8を確認します。

jobResultRead({transferId,offset:0,length:65536})のbase64 dataを復号し、nextOffsetがnullになるまで取得します。全体のバイト長と生UTF-8 SHA256を照合してからJSONを解析・保存してください。既定は4転送・合計100 MB、chunk最大65,536 bytesです。jobResultReleaseで解放し、切断でも同セッションの転送は失効します。他セッションのtransferIdは拒否します。結果表示・ケース登録・入力変更・再解析を行うAPIではありません。

出力に元から含まれる単位・仮定・暫定性と計算設定を保存します。過去の結果に欠けているengine build revisionやWASM hashを、現在の配信版から補って同一だとは主張しません。その追跡と保存後比較の全条件、実HTTPSは継続課題です。

## 計算時の実行識別を保存する

新しい出力はcalculation.runtimeIdentity schemaVersion:1へ、target(browser/node)、isolation(web-worker/worker-thread/process)、build、engine、assetsを固定します。browserのproduction buildはWorkerへコンパイル時の版を埋め込み、Nodeは実行host初期化時に採取します。利用者のproject/optionsから識別を指定しません。devや取得不能なbuildはstatus:unavailableです。availableにはversion・Git revision・dirty・sourceFingerprintがあり、sourceFingerprintはsrc/scripts/nativeとpackage/lock/Vite/HTMLの実バイト一覧のSHA256です。依存lockは宣言の識別であり、node_modulesや生成済みpublic資産全体の実ロード証明ではありません。

assetsは最大16件で、role(kernel/gmsh/mfem)、bytes、sha256、status(observed/declared)を持ちます。observedはハッシュした同じWASMバイト列を初期化へ渡した場合だけです。NodeのGmshは実node_modules packageを対象にし、ブラウザ用distのhashを流用しません。Node上のMFEMもWASMであり、機械語native版とは扱いません。実HTTP(S)のbrowserとNode providerは利用するWASMを観測し、provider無しfile fixture等で未観測の資産は推測せず省略します。

engineはrequestedMethodとactualEngineを分け、後者は結果engine名または未記録のnullです。GPU要求からCPUへfallbackした結果をGPU実行とは記録しません。ケース保存/復元/一体bundleと完全ジョブ結果転送は識別を保持し、caseListにも既存の識別を返します。不正な形式、計算methodや結果engineとの矛盾は保存/復元時に拒否します。旧保存に識別がない場合は未記録のまま扱い、現在manifestやソフト版で補いません。

この情報は識別・完全性を助ける記録です。コード採取から動的importまでの全ファイルの原子的snapshot、配布者署名、実行環境の認証、物理精度の証明ではありません。公開HTTPS・Skill単独一巡・全P0〜P6の完了は別条件です。

共通クライアントをNode Workerへ接続する埋込みadapterは、constructorのhost専用runtime.identityHostで実target/isolationを明示します。既定はbrowser/web-workerのままで、preflightも実hostに合わせます。project/optionsに同名の値を置いても採用されません。これはwireで利用者が実行先を偽装する引数ではありません。

## 接続の到達性と認証を分けて診断する

接続画面の診断は、ブラウザのローカルネットワーク権限と接続先への到達性を別々に表示します。`GET /health` は設定済み Origin と loopback Host の検査後、認証なしで `{schemaVersion:1,kind:"airpocket-browser-bridge"}` だけを返します。成功しても接続コードの正しさ、ペアリング、共有権限やモデル操作の許可を証明せず、診断結果の `authenticated` は `false` のままです。ヘルス要求は資格情報・コード・モデルを送信せず、応答を最大1,024 UTF-8バイト、待機を5秒に制限します。期限切れ・到達不能・不正応答を認証失敗と同一視しません。

MCP側では `studio_browser_sessions({diagnostics:true})` を呼ぶと、従来の `sessions` に `diagnostics` を追加して取得できます。省略または `false` なら従来の返答形です。診断は設定済み `origin` / `endpoint`、現在の `sessionCount`、要求・preflight・health・pair成功/拒否・Origin/Host拒否・認証拒否・切断・失効・要求エラー・scope拒否・timeoutの固定カウンタだけを返します。コード、Bearer token、受信URL/Origin/header/body、モデル、個別session IDは診断に記録しません。通常の `sessions` 一覧のIDと付与scopeは従来通りです。

カウンタはこのプロセスへ到達した事実だけを示します。増加しない場合、ブラウザ権限、混在コンテンツ、ネットワーク、停止したサーバーなどの原因は断定できません。health到達とペアリングを順に確認し、必要なscopeは利用者が明示的に付与します。

ブラウザ要求は `targetAddressSpace:"loopback"` を指定し、ローカル接続の権限判断をブラウザへ委ねます。これは権限付与や対応ブラウザの保証ではありません。現行の [Local Network Access仕様](https://wicg.github.io/local-network-access/) と [Chromeの公式解説](https://developer.chrome.com/blog/local-network-access) に沿い、保留された旧Private Network Accessの特別preflightヘッダーには依存しません。`Access-Control-Allow-Private-Network` を無条件に付けず、既存CORS・Origin/Host・Bearer・scope検査を維持します。

配信するCOI Service Workerは、`http://127.0.0.1`への要求を横取りせず、ページからの通常の通信としてブラウザに処理させます。Worker内からの再送では事前のローカル通信権限が必要となり、初回の許可確認を開始できない場合があるためです。これは権限確認やCORSの回避ではなく、接続元・コード・共有scopeの検査も引き続き必要です。通常のアプリ資産には従来の分離ヘッダー処理を維持します。公開HTTPSでのペアリング成功は別途実機検証が必要で、PUBLICHTTPS1は未完了です。

Origin/Host検査で拒否した場合も、データを含まない403を返します。要求のOriginが設定済みOriginと完全一致するときだけ `Access-Control-Allow-Origin`（と `Vary: Origin`）を付け、ページに「接続できない」ではなく「拒否(403)」と表示できるようにします。他のOriginには付けず、`*` も使いません。Host不一致などの設定ミスの切り分け用で、検査自体は緩めません。

## エージェント編集と保存検証の厳密化

`studio_validate_cases` は全ケースを実際の復元経路で検査してから従来形式の比較要約を返します。節点数と場配列の不一致、不正な四面体/表面、実行識別の矛盾を検証成功として返しません。有効な旧形式は保持し、元ファイルを書き換えません。この検証も物理精度や保存データの出所を証明するものではありません。

`selectPlanarRegion` の `rotationDegrees` を明示する場合、整合する `frame:{origin,u,v}` が必要です。回転だけの指定はゼロ回転も含め拒否し、黙って軸平行領域へ置き換えません。GUIが生成した整合するframe+回転、frameのみの任意平面、回転を指定しない従来のaxis/positionは維持します。`min/max` はframe内のmm座標、角度はdegreeです。拒否時は選択・条件・入力版を変更しません。

`studio_browser_contracts({method:"previewEdit"})` または `edit` から、`setInputProvenance` と `setAnalysisIntent` の具体的な位置引数schemaを取得できます。`operations[].args[0]` に根拠documentまたはintentを渡します。根拠はschemaVersion:1/entriesとし、pointer/value/source/rationale/applicability/assumption/statusを保持します。CAD/文書sourceにはreference/revisionが必要です。対象pointerの適用性、実入力との値一致、必須根拠と確認状態はpreflightで検査します。schema適合は資料の真実性や利用者の確認を意味しません。agent-proposalをLLMの判断だけでuser-confirmedへ変えず、実際の確認を取得してください。exploratoryの仮定付き実行はprovisionalを保持します。

## 中間結果の保存待機上限

保存ストア64MBの制限とは別に、中間mesh/fieldの保存待機を既定8件・8,000,000推定bytes（処理中1件を含む）へ制限します。clone/JSON化前に構造を見積もり、超過snapshotを保持せず、要約・診断と最終結果の計算を継続します。単一超過・件数/bytes超過・mesh欠落等の理由を `observation-queue-limit` / `observationQueue` で取得できます。browser完了情報の `intermediate.queue`、Nodeの `intermediateQueue` に件数・peak・上限・dropを返し、能力情報の `observation.pendingPayloadQueue` はhost既定値を宣言します。起動時設定で上限を変更でき、実ジョブの情報を優先します。

protocolを有効にしたbrowser/headless jobでは、Workerからhostへの観測配送はin-flight 8件/8,000,000推定bytesと別outbox 8件/8,000,000推定bytesに制限します。最大合計は16件/16,000,000推定bytesで、hostがACKするとoutboxをFIFO送信します。同期ソルバーcallbackは待たず、outbox内の同じsolver/phase/step/frequencyのscalar iterationは最新値へ集約します。final-checkとfrequency-step start/completeはiterationより優先します。overflow時は理由付きでdropし、mesh世代をまたいでfieldを送信しません。通常resultまたは報告errorの直前にdrainし、最大1件・4,096推定bytesのdrop集計control eventを送ります。`observation-transport` のsequence、in-flight/outbox、peak、accepted/drop理由を確認してください。これはhost `observationQueue`、64MB保存ストア、JOBEVENTBYTES1の制限と別のbudgetで、legacy direct worker経路には適用しません。

terminal集計は通常結果、またはWorkerが捕捉して報告するerrorの直前に送られます。取消・timeoutはWorkerを即時終了し、異常終了でも集計が届かないことがあります。terminal集計がない場合、最後のevent内の暫定metadataから最終drop数を推定せず、不明として扱います。取消時に集計を待たないのは既存の即時停止契約を維持するためです。

`observationSequence` は元の観測順序です。要約・診断は保存待ちを迂回するため、古い場の保存通知より先着する場合があります。latestPolicyはlast-accepted-snapshotで、最後に拒否した場へ置き換えません。meshを受理できなければ後続fieldも保存せず、旧meshへ結び付けません。accepted/latestCompletedはqueue受付・consumer完了であって成果物保存成功ではなく、artifact参照と完全性を別途検査します。取消時は待機payloadを解放し、処理中の終了をdrainで待ちます。

Worker transportの推定bytesはmetadata込みの保守的なenvelope構造見積もりです。上記のWorker観測budgetはprogress通知、最終結果、JSヒープ総量、legacy direct worker経路を上限保証しません。またhost queueの見積もりはJSヒープ総量・イベントring内の任意payload bytesを上限保証しません。元の場をすべて取得できたと報告せず、drop/制限を結果と一緒に説明してください。

## ジョブイベント本文とページの容量

既定では1イベント32,768 UTF-8バイト、1ジョブの保持合計1,048,576バイトかつ256件、jobEventsのJSON値全体65,536バイトを上限にします。イベントは原子的に返し、ページの件数が指定limitより少なくてもnextSequence/hasMoreで続きを取得します。件数または容量を超えると古いイベントから破棄し、firstAvailableSequence/truncatedで検出できます。eventRetentionは有効上限・保持件数/bytes、eventPageBytesは実際のJSON値容量を返します。

過大、循環参照、非有限数、accessor等の不正な観測は、同じsequenceの `observation-event-gap` / `payloadOmitted:true` / `gap.reason` へ置き換えます。getterは実行せず、欠けた物理値を0やnullへ補いません。これはソルバー失敗や数値収束の証明ではありません。小さな通常metricsと有効な構造化failureを保持し、statusの過大な要約はsummaryOmissions、error本文は最大2,048 UTF-16 code unitsとmessageTruncated/originalMessageLengthで明示します。終了状態・取消・解放の意味は変えません。

能力情報のobservation.eventPayloadが既定上限と適用範囲を返します。内部registryの起動時budgetは有効なfailureとenvelopeを収める最小容量を要求し、極小指定を拒否します。64KiBはjobEvents JSON値の上限です。MCPはtext/structuredContentへ値を重複格納するため、JSON-RPCやHTTP包装込みの通信全体は64KiBを超え得ます。Worker送信待機やJSヒープ全体の上限保証とは別です。完全な最終結果はjobResultExport/Read等の専用分割経路を使い、イベント要約から再構築しません。

### 配信物検証用の子プロセス実行

`check-published`は、同じNode実行ファイルの子プロセスのmainで、ハッシュ照合済み配信analysis/CADモジュールと固定のSTEP参照生成を実行します。元の26検査・数値assertionを維持し、close 0・シグナルなし・観測されたnative fatalなしを確認してから受信結果を採用します。検査と子実行のチェックポイント、失敗前の部分記録を残します。

これは公開検証スクリプトの分離方式であり、実ブラウザのWorkerやMCP既定実行方式を変更しません。Node切替、GC設定変更、skip、自動retry/fallbackは追加していません。Linux Node24.21.0/main badce2cでの既知native fatalを保持し、原因の根治を主張しません。今回変更後の全体980件中977成功・3skip・失敗0、buildとローカル26項目が成功。公開CIは別途記録します。詳細と適用限界は[試験記録](testing.md)と[WASM実行調査](wasm-runtime-investigation.md)を参照してください。

### 開発状況の任意取得

studio_progress({includeEstimate:true,includeHistory:true})で、元のprogressと主観推定・Git履歴を分離して返します。省略/falseは従来の応答形を維持。履歴はHEADと入力bytesの不一致・Git不在・容量超過を利用不可として明示し、2MB応答上限を適用。ローカルcheckoutの履歴であり公開候補の合格証明ではありません。[算定方法](progress-dashboard.md)。

## 保存ケースの読取専用比較（今回の検証記録は保留）

共通 `createCaseComparisonApi({cases}).compare(request, {guard})` と接続ブラウザの `caseCompare`（inspect権限）は、保存ケースを読み、入力・表示・時刻・履歴を変更しません。`caseList` で得たcaseIdとrevisionを、1〜8件の異なるケースの `references:[{caseId,expectedRevision,field,modeIndex?,frameIndex?,bodyIndex?,elementIndex?}]` に指定します。`point` は同じ全体座標系のmm単位3成分です。省略時はメタデータ比較だけで数値差分を返しません。bodyIndex/elementIndexはpoint指定時だけ使用し、ケースごとの局所番号です。別メッシュ間で同じ番号が同じ部品を意味するとは限りません。

fieldは displacement / stress / plasticStrain / temperature / heatFlux / instantPressure / pressure / spl / phase / speed / fluidPressure。モードはmodeIndex、過渡結果は保存済みframeIndexを明示します。現在表示や最終フレームへの暗黙選択、時間補間、位置合わせは行いません。モード変位は最大1mmに正規化した形状で、動的応答ではなく数値差分の対象外です。

各行はcase/input/result revision、kind、selection、計算・メッシュ情報、保存時runtimeIdentityとassessmentの記録状況を返します。旧結果の未記録identityを現在のmanifestで埋めません。`selection.displayUnit` は表示単位、`measurement.units` と `comparison.deltas[].units` は生の値の単位です。応力はPa（MPaではない）、塑性ひずみは比率1（%ではない）。他もmm、degC、W/m2、Pa、dB、rad、m/sを値に対応するunitsで確認します。

過渡結果の比較は保存された物理時刻の完全一致のみを条件とし、補間も許容誤差もありません。不一致は `different-time` で差分を返しません。SPL同士で `referencePressurePa` が異なる場合は `different-reference-pressure` となり差分を返しません。一方、Paの生圧力（instantPressure/pressure/fluidPressure）は基準圧が異なっても比較できます。

数値差分は最初のケースを基準に「対象−基準」、ベクトルは成分ごとです。kind/field/unit/time/frequencyの不一致、周波数未記録、モード形状、測定不可などでは理由を返し、差分を作りません。同じ入力・物理精度の証明ではありません。有効な選択部品の外側や部品の曖昧さは行単位のunavailable、存在しない部品・不正selector・破損ケースは全体拒否です。読取leaseやguardの失効も全体を拒否します。

MCP `studio_compare_cases({path})` はversion 1保存ケースarchive専用で、bundle v1/v2は対象外です。references省略時はpathだけを渡し、`cases` の `saved-case:0` 等のスナップショット内ID、case revision、archiveRevisionとsourceの生bytes/SHA-256を取得します。比較にはこのarchiveRevisionをexpectedArchiveRevisionとして指定し、上のreferencesと任意pointを渡します。IDだけを別archiveに流用しません。応答前にも元ファイルのhashを再確認し、変化は拒否します。ファイル書込・ソルバー起動はありません。

応答のJSON値全体はUTF-8で65536bytes以下です。超過時は参照数を減らします。MCPのtext/structuredContentによる重複やHTTP/JSON-RPCの包装込みwire全体の64KiB保証ではありません。今回の検証件数・実ブラウザ・公開完了は検証待ちとし、P0〜P6全体の完了を宣言しません。

### 評価要求を含む解析前検査

`studio_preflight_project({path,fractureAssessment?,fatigueAssessment?,...})`は、共通APIの`preflight(options)`と同様に、solveで要求した破壊・疲労評価の材料データとオプションも検査します。評価未指定（または`undefined`）とmesh-onlyは従来どおりです。疲労の省略オプションには従来の既定値が適用されるため、意図した荷重倍率・回数・平均応力補正を明示してください。

不足は`ASSESSMENT_INPUT_REQUIRED`、不正値は`ASSESSMENT_INPUT_INVALID`、対象外の構造モデルは`ASSESSMENT_MODEL_UNSUPPORTED`として対象ポインタを返します。破壊靭性の登録温度範囲を外れる評価温度は`ASSESSMENT_TEMPERATURE_OUT_OF_RANGE`です。適合する温度依存の線形等方材は一律に除外しません。quantitative/exploratoryでは材料評価データも既存の根拠・仮定検査に含めます。ソルバーや評価を実行せず、入力ファイルを変更しません。成功しても、解析後の応力状態・弾性範囲・メッシュ・拘束・収束・物理妥当性を保証しません。

選択領域の局所細分化は `addSelectedMeshRefinements({size,radius,baseSize})` をedit/previewのargsに渡します。単位はmm、sizeはbaseSizeの15〜100%。GUIと同じ選択三角形重心を最大80件追加し、保存全体160件まで。既存設定と選択を保持し、空選択・不正値・容量超過・版競合では入力を変更しません。baseSizeは後続ジョブの全体サイズを自動変更しません。

### GPU環境確認とメッシュ境界検査

ブラウザ操作 `checkGpuEnvironment`（inspect権限、引数なし）は、接続中のブラウザセッションで実際のWebGPUアダプタとデバイスを取得できるか呼出し時に確認します。一時デバイスは応答前に破棄され、プロジェクトや結果は変更しません。宣言や機能探索はデバイスの利用可否を約束せず、Nodeの能力も報告しません。

ブラウザ操作 `meshBoundaryPreflight({jobId,inputRevision})`（MCPでは `studio_preflight_mesh_boundaries({path,jobId,inputRevision})`）は、成功して実行が完了したmesh-onlyジョブが保持する正確なメッシュに対し、境界条件の転写を検査します。入力リビジョンの一致が必要で、メッシャーもソルバーも再実行せず、対象は静的線形構造入力に加え、熱・音響入力のメッシュ後検査（下記の追加フィールド）です。結果には追加フィールド `rigidBody` も含まれ、転写された節点のfixed/displacement拘束について6つの剛体運動を `eliminated` または `free` で報告します（拘束を課した剛体行列の数値rank、相対許容1e-6、`rigidBodyModesEliminated`、`freeRigidModeCount`、成分ごとのrank）。自由モードがあるとエラー診断 `ANALYSIS_RIGID_BODY_MODE_FREE` を追加しますが `allowed:false` にはしません。非構造・modal研究は `not-applicable`、使えないメッシュは `unknown`、ばね・弾性支持はモデル化されず剛体モードを除去したと数えません。`completePreflight` は常にfalseで、収束・物理精度は未検査のままです。

メッシュ後の追加フィールド（既存フィールドは不変）: `componentAnchoring` は保持メッシュの連結成分（四面体の接続）ごとに支持の有無を報告します。構造は fixed/displacement 節点、定常熱は温度・対流・放射の節点を持たない成分を `MESH_COMPONENT_UNANCHORED`（エラー診断、`allowed` は変えない）として列挙します。熱接触がある場合は成分間が結合され得るため警告に下げます。過渡熱・modal・音響は `not-applicable`、メッシュが使えない場合は `unknown`（警告のみ）です。`acousticResolution` は音響の調和解析（掃引は掃引終了周波数）について、波長 c/f を四面体の最大辺長で割った波長あたり要素数を報告します。6未満は警告 `ACOUSTIC_MESH_UNDERRESOLVED`（線形要素の経験則で精度保証ではありません）、2未満はエラー `ACOUSTIC_MESH_WAVELENGTH_UNRESOLVED` で `allowed:false` になります。過渡音響は単一周波数がなく、値が欠ける場合も含めて `unknown`（警告 `ACOUSTIC_RESOLUTION_CHECK_UNAVAILABLE`）とし、推測しません。`physicsCoverage` は該当契約に `postMeshImplemented` を追加し、`remaining` から連結成分・波長あたり要素数を外しました（これらはメッシュ後検査のみで、solve前のpreflightでは実行されません）。
