# MCPと専用skill

[English](en/automation.md)

`npm run mcp`はローカル標準入出力のMCPサーバーを起動します。[MCP 2025-11-25のツール仕様](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/server/tools.mdx)に対応し追加ライブラリは不要です。初回は`npm ci`と`npm run build`でWASMを準備してください。

18ツール: `studio_capabilities`、`studio_diagnose_execution`、`studio_material_catalog`、`studio_progress`、`studio_inspect_project`、`studio_edit_project`、`studio_import_project`、`studio_create_builtin_project`、`studio_preflight_project`、`studio_analyze`、`studio_probe`、`studio_validate_cases`、`studio_job_artifact`と、下記5つのジョブ操作。ファイルパスは絶対パスを使います。解析は新規`outputPath`へ完全な結果JSONを保存し、要約を返します。入力・既存出力は上書きしません。ブラウザと同じWorkerを独立したNode workerで実行し、計算は120秒の制限があります。Airpocket CPUとMFEMに対応し、WebGPUは対象外です。

`studio_import_project({path,outputPath,scaleToMm?,name?})`はSTEP/STPをOCCTでmmへ正規化し、元STEPとCAD面対応を保持した入力JSONを新規保存します。STLには正の`scaleToMm`が必須で、現行は外向き・閉・凸の単一シェルと既存サイズ制限に従います。入力ファイル上限は50 MiBです。`studio_create_builtin_project({source,outputPath,name?})`はmm指定の`box`（bounds）、`boxes`（boxes）、固定寸法`cylinder`（kindのみ）、`sphere`（center/radius）、`tube`（center/axis/innerRadius/outerRadius/length）を作成します。材料値や支持・荷重は自動で確定しません。

## 保存入力の一括編集

`studio_inspect_project({path,meshIndex?,faceOffset?,faceLimit?})`は既定で全体のmm寸法・三角形数・面数を小さな要約として返します。`meshIndex`を指定すると、面ID順のページ（既定20、最大50）で面積・重心・境界寸法・平均法線を取得できます。面の分類は推測しません。`displayMeshRevision`（SHA-256）と面IDスコープを記録し、`selectCadFace(mesh,faceId)`で対応する表示面群を選択します。STEPを含め面IDは表示メッシュ版の範囲に限定され、形状/対応変更を越える永続CAD IDではありません。STLは三角形または再メッシュ面タグです。

`studio_inspect_project({path})`が返す`revision`を`expectedRevision`として、`studio_edit_project({path,outputPath,expectedRevision,operations:[{method,args}]})`へ渡します。1〜100操作を作業用コピーに一括適用し、すべて成功した場合だけ新規`outputPath`に保存します。古い版・未対応操作・不正入力は拒否し、元入力と既存出力は上書きしません。戻り値は新旧revisionと保存先・要約を含みます。検査revisionは入力JSONのキー順に依存しないハッシュで、ジョブの正規化入力`inputRevision`と同一とは限りません。

対応methodは`selectTriangles`、`selectPlanarRegion`、`selectCylindricalRegion`、`clearSelection`、`addCondition`、`removeCondition`、`selectCondition`、`replaceConditionRegion`、`reapplyConditionRegion`、`setMaterial`、`setMaterialProperties`、`setMaterialPreset`、`setStudy`、`setMeshSettings`、`setInputProvenance`、`setAnalysisIntent`。`args`には同名の`studioApi`操作の位置引数を配列で渡します。例: `operations:[{"method":"setMeshSettings","args":[{"refinements":[{"center":[5,5,20],"radius":5,"size":2}]}]}]`。`setInputProvenance`は下記根拠document、`setAnalysisIntent`は`{mode:"quantitative"|"exploratory"}`を引数に取ります。全物理モデルの根拠・必須入力契約の網羅は未完了です。

追加の`selectCadFace`を含め計17メソッドです。例: `operations:[{"method":"selectCadFace","args":[0,2]}]`。CAD更新では既存根拠entryを`unconfirmed`・`assumption:null`へ戻し、confirmationを削除します。更新後は領域と根拠を再確認してください。

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

`studio_job_artifact({jobId,artifactId,point?,offset?,limit?})`はイベントにある登録済み`artifactId`から中間成果物を取得します。任意パスは受け付けず、ハッシュ・ジョブ入力版・対応メッシュを照合します。既定は要約のみ。現行の場は熱の温度と過渡音響の圧力スカラーです。これらは`point:[x,y,z]`（mm）の補間、または`offset`と`limit`（最大200）のノード/値ページを必要に応じて取得できます。メッシュ単独では座標ページを取得でき、点補間には場が必要です。解放済みジョブの登録は利用できません。最終保存の`job.final:true`は保存完了を表し、仮定があれば`job.provisional:true`を維持します。最終保存と非暫定・物理検証済みを同一視しないでください。

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

`node scripts/studio-mcp.mjs --browser-origin=http://127.0.0.1:5174` と起動すると、通常の18ツールに加え `studio_browser_sessions` と `studio_browser_call` を公開します。Originは実際のページに合わせます。stdoutはMCP専用、stderrに接続先・接続コードを表示します。

ブラウザの「自分のLLMに接続する」で接続先とコードを入力し、確認・編集・計算・表示の共有範囲を選んで許可します。初期選択は確認のみ。コードをURL・保存入力・公開文書へ含めません。サーバーは127.0.0.1限定で、Origin/Host/Bearerを検査します。ブラウザのpollが10分途切れると失効し、プロセス終了で全セッションを失います。切断は、その接続が開始した計算を中止します。再接続は新規許可であり実行中ジョブの復元ではありません。

`studio_browser_call({sessionId,method,args})` の対応操作:

- 確認: `inspect`（revision・操作一覧）、`geometry`（面ページ）、`preflight`、`jobStatus`、`jobEvents`、`jobArtifact`、`probe`（表示結果の点値・暫定評価）。
- 編集: `edit({expectedRevision,operations})`。同じ17操作を原子的に適用。版不一致・途中の入力変更・実行中・接続解除を拒否。
- 計算: `startJob({inputRevision,requestId,operation,options})`、`cancelJob({jobId})`、`releaseJob({jobId})`、`showJob({jobId,name})`。showJobは入力版が一致する場合だけ保存ケースを作成し表示。メッシュ単独のshowJobは未対応。
- 表示: `getView`、`setView`。断面・透過・部品表示設定。結果カメラは下記の結果ビューAPIで操作できます。画像/動画出力は下記の出力ジョブを使います。

命令は最大16件、応答待ちは15秒。タイムアウトは未実行の保証ではないため、変更を再試行する前に状態を取得します。再起動復元、GUIとの全ジョブ表示統合、公開HTTPSページからのlocalhost接続・ブラウザ権限は未検証。ローカルChromeと実MCPで版照合編集→Worker解析→途中イベント→結果表示→0.04 mmの点値→表示変更→接続解除を確認しました。

### ブラウザの途中の場を取得する

接続モードで `startJob` に `includeFields:true` を指定すると、中間メッシュと対応する熱/過渡音響の節点スカラー場をブラウザのメモリ内に保持します。`jobEvents` の `artifact.artifactId` を、`jobArtifact({jobId,artifactId,point?,offset?,limit?})` または共通APIの `analysisApi.getJobArtifact(jobId,artifactId,options)` へ渡します。既定は要約のみ。ページ上限は200節点で、点測定には場を含む成果物が必要です。

取得時にSHA-256・入力版・対応メッシュを検査し、物理時刻（秒）・単位・provisional:trueを返します。再メッシュは新しいメッシュ参照へ切り替え、過去の場は元のメッシュと結び付けたまま保持します。既定64,000,000バイトの直列化データ予算は全ブラウザジョブで共有し、上限では要約と計算を続行。実ヒープ使用量の上限ではありません。観測が不正な場合はobservation-errorを返し、最終解析結果の判定と区別します。releaseJob/closeJobsで解放し、ページ終了で消失します。ファイルへの永続保存・全ソルバーの全反復場は提供しません。

## 結果ビューとケースの意味的操作

接続モードの`getResultView({frameOffset?,frameLimit?,modeOffset?,modeLimit?})`は、結果全体を送らず`resultRevision`、物理量と表示単位、現在の表示設定、保存時刻/モードのページ（各最大50件）を返します。`setResultView({expectedResultRevision,settings})`で変更します。

`settings`は`field`、`deformScale`、`surface`、`surfaceWire`、`volumeWire`、`section`、`modeIndex`、`frameIndex`または`timeSeconds`、`camera`、`colorRange`です。カメラはmmの`position`/`target`と`up`、度の`fov`。固定色は`{field,minimum,maximum}`、自動範囲はnull。値の単位は返却されたfield単位（応力はMPa、温度はdegC等）に従い、範囲外は端の色に固定します。物理量を変更して新範囲を指定しなければ自動範囲へ戻ります。

過渡音響は保存された時刻だけを選択し、未保存時刻は拒否します。熱の最終結果から途中場を表示する機能は未対応。固有モードは正規化形状で、実際の動的応答ではありません。`probe({point,expectedResultRevision?,options?})`は表示中の保存時刻/モードを測定し、結果版・選択状態・根拠評価を返します。変形表示倍率は物理値を変更しません。共通APIは`window.resultViewApi.get/set/probe`です。ビュー設定はJSONで取得・再適用できますが、ケース集に自動保存しません。

ケースは`caseList()`の`caseId`と`revision`を使用します。`caseView`、`caseRestoreInput`、`caseRemove`へ`{caseId,expectedRevision}`を、`caseRename`には追加で`name`を渡します。`caseSave({name,expectedResultRevision})`は現在の表示結果を最大8件の保存枠へ追加します。共通APIは`window.caseOperations.list/saveCurrent/view/restoreInput/rename/remove`です。caseIdはページ内だけで有効で、外部からケース集を変更すると古いIDは失効します。改名後も内容revisionを更新してから次の操作へ進みます。

共有範囲は、一覧/測定/結果ビュー取得が確認、表示設定変更が表示、保存が計算・結果保存、改名/削除/復元/ケース表示が入力・ケース編集です。ケース表示は保存時の入力も復元するため編集許可を要します。接続解除・命令期限・処理中の入力/結果/ケース変更・計算/動画再生との競合を実行直前に再検査します。ケース集のライブ入出力と、ケース集への名前付きビュー同梱は継続課題です。

## PNG/WebMの出力ジョブ

任意接続モードは34操作を公開します（通常18ツール、接続モード20ツール）。`exportCapabilities()`でPNG/WebMとアニメーション種別の実行可否を調べます。WebMは実行中ブラウザの録画対応に依存します。MP4/GIFは未対応としてfalseを返します。

`getResultView`で結果版を取得し、`startExport({requestId,expectedResultRevision,format,animation,seconds})`を呼びます。`format`は`png`または`webm`、`animation`は`orbit`、`deformation`、`time`、`slice`、`seconds`は1〜15の整数（省略時5）です。開始時に結果版を照合し、結果表示・カメラ・層・断面等の設定を複製してジョブに固定します。同じrequestIdと同じ要求は保持中の同じジョブを返し、要求変更は競合として拒否します。

`exportStatus({jobId})`で進捗とrunning/completed/failed/cancelledを確認します。completedの成果物メタデータには`mimeType`、`name`、`totalBytes`、`sha256`が含まれます。`exportArtifact({jobId,offset:0,length:65536})`からbase64の`data`を復号し、返却された`nextOffset`がnullになるまでページを取得します。lengthは最大65,536バイトで、offsetは復号後のバイト位置です。結合したバイト数とSHA-256をメタデータに照合してから利用します。ブラウザ内の任意コード実行、任意パス読取、グローバルなファイルシステム操作は不要です。自動ダウンロードや永続保存は行いません。

`cancelExport({jobId})`で中止し、不要になったら`releaseExport({jobId})`で保持枠と成果物を解放します。取消・解放後に届いた録画結果は取得できません。既定の保持上限は合計32 MiBと4ジョブ、レンダラーは取消後の後処理を含め同時に1件です。切断はその接続が開始した出力ジョブも中止します。ページ終了で出力は消失し、再起動復元・ケース集への永続保存は提供しません。

共有範囲は能力・状態・成果物取得が確認（inspect）、開始・取消・解放が表示（view）です。動画は実時間の24 fps録画で、固定フレームの決定的な書き出しではありません。time再生は保存された過渡音響フレームに限り、動画の再生秒数と物理時刻は別です。変形アニメーションは表示倍率の周期変化で、負荷履歴の解析結果ではありません。

実時間録画は24 fpsを要求するがフレーム数を保証しない。背景タブや高負荷で欠落し得る。固定フレーム・決定的な動画出力は未対応。


## 名前付きビューの持ち運び

共通APIは`window.namedViewApi.list/save/apply/remove/export/import`です。GUIの名前付きビューパネルでも保存・復元・削除・JSON入出力を行います。接続MCPでは`namedViewList`と`namedViewExport`が確認（inspect）、`namedViewSave`、`namedViewApply`、`namedViewRemove`、`namedViewImport`が表示（view）許可です。名前付きビューの削除は表示設定の削除であり、解析ケースの削除とは別操作です。

まず`namedViewList()`で`archiveRevision`と`views`の`viewId/revision/name/resultRevision`を取得し、`getResultView()`で表示中の結果版を確認します。`namedViewSave({name,expectedResultRevision,expectedArchiveRevision})`は結果設定とカメラ、断面・部品等のsetupを保存します。fieldで定まる表示単位を使い、固定色範囲・選択フレーム/モードを保持しますが、物理場配列やモデルは含みません。名前は1〜100文字、最大16件です。

`namedViewApply({viewId,expectedRevision,expectedResultRevision})`は保存時と同じ結果版だけに適用します。異なる計算結果への同期プリセットではありません。`namedViewRemove({viewId,expectedRevision})`で削除します。競合時は一覧と表示結果を読み直し、古い版をそのまま再送しないでください。

`namedViewExport()`は`{version:1,views:[{id,name,resultRevision,result,setup}]}`のJSONを返します。明示的に保存し、`namedViewImport({archive,expectedArchiveRevision})`で再取込すると持ち運べます。取込は現在のビュー一覧全体を置き換えます。未知キー、非有限値、不正なカメラ・範囲・形式、重複IDは拒否します。適用の途中失敗では以前の状態への復元を試みます。自動localStorage保存やケース集への同梱は行いません。ページを閉じる前に必要なビューを明示的に書き出してください。
