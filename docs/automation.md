# MCPと専用skill

[English](en/automation.md)

`npm run mcp`はローカル標準入出力のMCPサーバーを起動します。[MCP 2025-11-25のツール仕様](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/server/tools.mdx)に対応し追加ライブラリは不要です。初回は`npm ci`と`npm run build`でWASMを準備してください。

27ツール: `studio_capabilities`、`studio_diagnose_execution`、`studio_material_catalog`、`studio_progress`、`studio_inspect_project`、`studio_edit_project`、`studio_import_project`、`studio_create_builtin_project`、`studio_preflight_project`、`studio_analyze`、`studio_probe`、`studio_validate_cases`、`studio_validate_case_bundle`、`studio_verify_measurements`、`studio_job_artifact`、`studio_job_artifacts`、`studio_assess_result`、`studio_assessment`、`studio_preview_cad_update`、`studio_apply_cad_update`、`studio_import_print`、`studio_inspect_print`と、下記5つのジョブ操作。ファイルパスは絶対パスを使います。解析は新規`outputPath`へ完全な結果JSONを保存し、要約を返します。入力・既存出力は上書きしません。ブラウザと同じWorkerを独立したNode workerで実行し、計算は120秒の制限があります。Airpocket CPUとMFEMに対応し、WebGPUは対象外です。

`studio_import_project({path,outputPath,scaleToMm?,name?})`はSTEP/STPをOCCTでmmへ正規化し、元STEPとCAD面対応を保持した入力JSONを新規保存します。STLには正の`scaleToMm`が必須で、現行は外向き・閉・凸の単一シェルと既存サイズ制限に従います。入力ファイル上限は50 MiBです。`studio_create_builtin_project({source,outputPath,name?})`はmm指定の`box`（bounds）、`boxes`（boxes）、固定寸法`cylinder`（kindのみ）、`sphere`（center/radius）、`tube`（center/axis/innerRadius/outerRadius/length）を作成します。材料値や支持・荷重は自動で確定しません。

## 保存入力の一括編集

`studio_inspect_project({path,meshIndex?,faceOffset?,faceLimit?})`は既定で全体のmm寸法・三角形数・面数を小さな要約として返します。`meshIndex`を指定すると、面ID順のページ（既定20、最大50）で面積・重心・境界寸法・平均法線を取得できます。面の分類は推測しません。`displayMeshRevision`（SHA-256）と面IDスコープを記録し、`selectCadFace(mesh,faceId)`で対応する表示面群を選択します。STEPを含め面IDは表示メッシュ版の範囲に限定され、形状/対応変更を越える永続CAD IDではありません。STLは三角形または再メッシュ面タグです。

`studio_inspect_project({path})`が返す`revision`を`expectedRevision`として、`studio_edit_project({path,outputPath,expectedRevision,operations:[{method,args}]})`へ渡します。1〜100操作を作業用コピーに一括適用し、すべて成功した場合だけ新規`outputPath`に保存します。古い版・未対応操作・不正入力は拒否し、元入力と既存出力は上書きしません。戻り値は新旧revisionと保存先・要約を含みます。検査revisionは入力JSONのキー順に依存しないハッシュで、ジョブの正規化入力`inputRevision`と同一とは限りません。

対応methodは`selectTriangles`、`selectCadFace`、`selectPlanarRegion`、`selectCylindricalRegion`、`clearSelection`、`addCondition`、`removeCondition`、`selectCondition`、`replaceConditionRegion`、`reapplyConditionRegion`、`setMaterial`、`setMaterialProperties`、`setMaterialPreset`、`applyCatalogMaterial`、`setStudy`、`setMeshSettings`、`setInputProvenance`、`setAnalysisIntent`。`args`には同名の`studioApi`操作の位置引数を配列で渡します。例: `operations:[{"method":"setMeshSettings","args":[{"refinements":[{"center":[5,5,20],"radius":5,"size":2}]}]}]`。`setInputProvenance`は下記根拠document、`setAnalysisIntent`は`{mode:"quantitative"|"exploratory"}`を引数に取ります。全物理モデルの根拠・必須入力契約の網羅は未完了です。

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

ジョブは同一MCP/Nodeプロセス内だけ保持し、再起動を越えた再接続や復元は未対応です。既定で最大32ジョブ・各256イベントを保持します。古いイベントが落ちると`truncated:true`と`firstAvailableSequence`を返します。欠落を推測で埋めず、状態と利用可能な成果物を確認してください。直接Nodeから呼ぶ場合も同一プロセスを維持します。`studio_analyze`は従来の最終応答型操作です。

イベントには`jobId`・`inputRevision`・`sequence`が付き、中間スナップショットは`provisional:true`です。メッシュ/品質、反復残差、対応解析の時刻場・適応段階等、実際に発生したイベントのみ取得できます。全ソルバーの全反復・全物理場を保証しません。`includeFields:true`では新規ディレクトリ`outputPath + ".intermediate"`に暫定メッシュ/時刻場JSONを保存し、イベントの成果物参照にパス・バイト数・SHA-256を含めます。場JSONには取得できた対応メッシュへの`meshArtifact`参照を含み、再メッシュで参照を更新します。既存ディレクトリは再利用しません。既定の合計上限64 MB（64,000,000バイト）以降は場保存を止め、`observation-limit`を通知して要約と解析を継続します。中止・失敗時も既に書いた暫定ファイルが残り得ます。`provisional:false`の最終保存結果でも物理精度・収束の確認は別途必要です。

ブラウザの`analysisApi.startJob`、`getJob`、`jobEvents`、`cancelJob`、`getJobResult`、`releaseJob`も同じライフサイクルを使います。`startJob`の`inputRevision`と`requestId`は呼出側が渡します。ブラウザのイベントは通常は要約のみです。includeFields:trueでは下記のメモリ内成果物を保持します。下記の接続モードで、このAPIをライブMCPへ公開できます。

`studio_job_artifact({jobId,artifactId,point?,bodyIndex?,elementIndex?,offset?,limit?})`はイベントにある登録済み`artifactId`から中間成果物を取得します。任意パスは受け付けず、ハッシュ・ジョブ入力版・対応メッシュを照合します。既定は要約のみ。現行の場は熱の温度と過渡音響の圧力スカラーです。これらは`point:[x,y,z]`（mm）の補間、または`offset`と`limit`（最大200）のノード/値ページを必要に応じて取得できます。メッシュ単独では座標ページを取得でき、点補間には場が必要です。解放済みジョブの登録は利用できません。最終保存の`job.final:true`は保存完了を表し、仮定があれば`job.provisional:true`を維持します。最終保存と非暫定・物理検証済みを同一視しないでください。

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

`node scripts/studio-mcp.mjs --browser-origin=http://127.0.0.1:5174` と起動すると、通常の27ツールに加え `studio_browser_sessions` と `studio_browser_call` を公開します。Originは実際のページに合わせます。stdoutはMCP専用、stderrに接続先・接続コードを表示します。

ブラウザの「自分のLLMに接続する」で接続先とコードを入力し、確認・編集・計算・表示の共有範囲を選んで許可します。初期選択は確認のみ。コードをURL・保存入力・公開文書へ含めません。サーバーは127.0.0.1限定で、Origin/Host/Bearerを検査します。ブラウザのpollが10分途切れると失効し、プロセス終了で全セッションを失います。切断は、その接続が開始した計算を中止します。再接続は新規許可であり実行中ジョブの復元ではありません。

`studio_browser_call({sessionId,method,args})` の対応操作:

- 確認: `inspect`（revision・操作一覧）、`geometry`（面ページ）、`preflight`、`jobStatus`、`jobEvents`、`jobArtifact`、`probe`（表示結果の点値・暫定評価）。
- 編集: `edit({expectedRevision,operations})`。同じ18操作を原子的に適用。版不一致・途中の入力変更・実行中・接続解除を拒否。
- 計算: `startJob({inputRevision,requestId,operation,options})`、`cancelJob({jobId})`、`releaseJob({jobId})`、`showJob({jobId,name})`。showJobは入力版が一致する場合だけ保存ケースを作成し表示。メッシュ単独のshowJobは未対応。
- 表示: `getView`、`setView`。断面・透過・部品表示設定。結果カメラは下記の結果ビューAPIで操作できます。画像/動画出力は下記の出力ジョブを使います。

命令は最大16件、応答待ちは15秒。タイムアウトは未実行の保証ではないため、変更を再試行する前に状態を取得します。再起動復元、GUIジョブ全経路の実画面での確認、公開HTTPSページからのlocalhost接続・ブラウザ権限は未検証。ローカルChromeと実MCPで版照合編集→Worker解析→途中イベント→結果表示→0.04 mmの点値→表示変更→接続解除を確認しました。

### ブラウザの途中の場を取得する

接続モードで `startJob` に `includeFields:true` を指定すると、中間メッシュと対応する熱/過渡音響の節点スカラー場をブラウザのメモリ内に保持します。`jobEvents` の `artifact.artifactId` を、`jobArtifact({jobId,artifactId,point?,bodyIndex?,elementIndex?,offset?,limit?})` または共通APIの `analysisApi.getJobArtifact(jobId,artifactId,options)` へ渡します。既定は要約のみ。ページ上限は200節点で、点測定には場を含む成果物が必要です。

取得時にSHA-256・入力版・対応メッシュを検査し、物理時刻（秒）・単位・provisional:trueを返します。再メッシュは新しいメッシュ参照へ切り替え、過去の場は元のメッシュと結び付けたまま保持します。既定64,000,000バイトの直列化データ予算は全ブラウザジョブで共有し、上限では要約と計算を続行。実ヒープ使用量の上限ではありません。観測が不正な場合はobservation-errorを返し、最終解析結果の判定と区別します。releaseJob/closeJobsで解放し、ページ終了で消失します。ファイルへの永続保存・全ソルバーの全反復場は提供しません。

## 結果ビューとケースの意味的操作

接続モードの`getResultView({frameOffset?,frameLimit?,modeOffset?,modeLimit?})`は、結果全体を送らず`resultRevision`、物理量と表示単位、現在の表示設定、保存時刻/モードのページ（各最大50件）を返します。`setResultView({expectedResultRevision,settings})`で変更します。

`settings`は`field`、`deformScale`、`surface`、`surfaceWire`、`volumeWire`、`section`、`modeIndex`、`frameIndex`または`timeSeconds`、`camera`、`colorRange`です。カメラはmmの`position`/`target`と`up`、度の`fov`。固定色は`{field,minimum,maximum}`、自動範囲はnull。値の単位は返却されたfield単位（応力はMPa、温度はdegC等）に従い、範囲外は端の色に固定します。物理量を変更して新範囲を指定しなければ自動範囲へ戻ります。

過渡音響は保存された時刻だけを選択し、未保存時刻は拒否します。熱の最終結果から途中場を表示する機能は未対応。固有モードは正規化形状で、実際の動的応答ではありません。`probe({point,expectedResultRevision?,options?})`は表示中の保存時刻/モードを測定し、結果版・選択状態・根拠評価を返します。変形表示倍率は物理値を変更しません。共通APIは`window.resultViewApi.get/set/probe`です。ビュー設定はJSONで取得・再適用できますが、ケース集に自動保存しません。

ケースは`caseList()`の`archiveRevision`と各ケースの`caseId`・`revision`を使用します。`caseView`、`caseRestoreInput`、`caseRemove`へ`{caseId,expectedRevision}`を、`caseRename`には追加で`name`を渡します。`caseSave({name,expectedResultRevision})`は現在の表示結果を最大8件の保存枠へ追加します。共通APIは`window.caseOperations.list/saveCurrent/view/restoreInput/rename/remove`です。caseIdはページ内だけで有効で、外部からケース集を変更すると古いIDは失効します。改名後も内容revisionを更新してから次の操作へ進みます。

共有範囲は、一覧/測定/結果ビュー取得が確認、表示設定変更が表示、保存が計算・結果保存、改名/削除/復元/ケース表示が入力・ケース編集です。ケース表示は保存時の入力も復元するため編集許可を要します。接続解除・命令期限・処理中の入力/結果/ケース変更・計算/動画再生との競合を実行直前に再検査します。ケース集のライブ入出力は以下の分割転送APIを使用します。ケースと名前付きビューの一体保存には下記のbundle形式を使用します。

## PNG/WebMの出力ジョブ

任意接続モードは71操作を公開します（通常27ツール、接続モード29ツール）。`exportCapabilities()`でPNG/WebMとアニメーション種別の実行可否を調べます。WebMは実行中ブラウザの録画対応に依存します。MP4/GIFは未対応としてfalseを返します。

`getResultView`で結果版を取得し、`startExport({requestId,expectedResultRevision,format,animation,seconds})`を呼びます。`format`は`png`または`webm`、`animation`は`orbit`、`deformation`、`time`、`slice`、`seconds`は1〜15の整数（省略時5）です。開始時に結果版を照合し、結果表示・カメラ・層・断面等の設定を複製してジョブに固定します。同じrequestIdと同じ要求は保持中の同じジョブを返し、要求変更は競合として拒否します。

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

100,000,000バイトは保持する転送バッファの合計上限であり、JSON解析・複製・検証を含むブラウザのヒープ上限ではありません。確定済み取込も再送時の重複適用を避けるため、解放するまで転送枠とバイトを保持します。

## 疲労・破壊評価の版付きAPI

`studio_assess_result({path,outputPath,expectedResultRevision,kind,options})`は保存済み解析JSONを検証し、`kind:"fatigue"|"fracture"`の評価を追加した完全な解析JSONを新規パスへ保存します。既存出力の上書きは拒否します。`studio_assessment({path,kind,expectedResultRevision?,offset?,limit?})`は読取専用で、評価の要約・出典・単位・制限と要素別データを返します。ページは既定50、最大200要素です。保存結果ではまず`studio_assessment({path,kind})`を呼び、返された`resultRevision`を評価時の`expectedResultRevision`へ渡します。対象となる構造線形弾性結果にまだ評価がない場合も、`available:false`、現在の結果版、空の要素ページを返します。保存済み評価がある場合は`available:true`です。

ブラウザでは`window.resultAssessmentApi.evaluate({expectedResultRevision,kind,options})`と`get({kind,expectedResultRevision?,offset:0,limit:50})`を使います。MCP接続の`evaluateAssessment`はanalyze権限、`getAssessment`はinspect権限です。評価応答には変更前・変更後の結果版、要約、材料出典、制限、要素数が含まれます。入力・変位・応力配列は変更しませんが、評価と計算設定を含む出力全体の版は変わります。保存ビューや古い結果版の参照を適用する前に、新しい版を取得してください。

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

MFEM・WebGPU・channelFlow・Stokesなど数値反復observerのない経路はstage/textの進行情報に限ります。周波数sweepも実際のsourceと実装経路に従います。反復ゼロなら対応イベントが出ない場合があります。場が対応してもincludeFields保持off、共有64 MB予算、観測/計算失敗などにより取得は保証しません。観測宣言は実行可能性・物理妥当性とは別で、診断/preflightのallowedと必要入力・検証を引き続き確認してください。

各profileは`id/models/methods/events/textProgress/fields/limitations`を持ち、eventsはstage・任意solver・cadence・metrics(name/unit)、fieldsはkind/name/unit/timeUnit/cadenceを宣言します。selectedObservationはschemaVersion、target/operation/supported、profileIdとprofile、reasons、adaptive、fieldRetentionを返し、declarationOnly:true・physicalAccuracyVerified:falseです。fieldRetentionはrequested/available/maxBytes:64000000/eventRetention:256を含みます。adaptiveはenabled/structuredRoundEvents:false/meshPerRound/textProgressOnlyを返します。acousticSweepとadaptiveSolveはonObserveを受けないため、構造化frequency-step/adaptive-round数値イベントを宣言しません。

カタログはブラウザ13プロファイル、Node12（WebGPUを除外）。共通eventsはpreparation/mesh/progressを宣言し、progressはWorker文字列をクライアントが変換するstageです。fieldRetentionはscalarFieldsSupported/meshSupported/meshAvailable/availabilityIsGuarantee:falseも含みます。availableはスカラー場の保持要求が対応経路と一致することだけを示し、取得保証ではありません。数値場のないCPU経路でもmeshAvailable:trueになり得ます。診断MCPはincludeFields:boolean、preflightはadaptive/includeFieldsを受け付けます。不正な診断optionsはisError、preflightは構造化診断とselectedObservation.supported:falseを返します。保存analysisAssessment形式は変更しません。
