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

ブラウザの`analysisApi.startJob`、`getJob`、`jobEvents`、`cancelJob`、`getJobResult`、`releaseJob`も同じライフサイクルを使います。`startJob`の`inputRevision`と`requestId`は呼出側が渡します。ブラウザのイベントは要約のみで、場・メッシュの中間成果物保存は提供しません。これはライブブラウザのMCP接続ではありません。

`studio_job_artifact({jobId,artifactId,point?,offset?,limit?})`はイベントにある登録済み`artifactId`から中間成果物を取得します。任意パスは受け付けず、ハッシュ・ジョブ入力版・対応メッシュを照合します。既定は要約のみ。現行の場は熱の温度と過渡音響の圧力スカラーです。これらは`point:[x,y,z]`（mm）の補間、または`offset`と`limit`（最大200）のノード/値ページを必要に応じて取得できます。メッシュ単独では座標ページを取得でき、点補間には場が必要です。解放済みジョブの登録は利用できません。最終保存の`job.final:true`は保存完了を表し、仮定があれば`job.provisional:true`を維持します。最終保存と非暫定・物理検証済みを同一視しないでください。

例: `studio_analyze`へ`{"path":"D:/work/project.json","outputPath":"D:/work/result.json","size":5,"method":"wasm-pcg"}`を渡します。`studio_probe`の`point`はmm、結果は各解析の物理単位です。UIから保存した入力JSONを使い、材料の出典と有効範囲を確認してください。

Codexへの登録（位置が異なる場合は変更）:

```powershell
codex mcp add airpocket-studio -- node D:/github/airpocket-soundman/airpocket-simulation-studio/scripts/studio-mcp.mjs
```

[公式MCP設定手順](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)を参照。`skills/airpocket-studio`を個人の`.codex/skills/airpocket-studio`へコピーして専用skillを使えます。

MCPはローカル保存JSONを操作し、開いているブラウザを変更しません。画像・動画はブラウザUIを使います。MCP計算の成功は画面・GPU・任意形状の物理精度の検証とは別です。

`studio_material_catalog`で同梱した樹脂物性を検索できます。[材料ライブラリ](polymer-library.md)。

`studio_capabilities`でNode実行の能力と候補ソルバーを取得し、`studio_diagnose_execution`へ保存プロジェクトの`path`と任意の`method`・`adaptive`を渡して実行組合せの診断を取得できます。診断にはコード・重要度・対象・根拠・修正候補を含みます。現段階では単位・拘束・物性・メッシュ等を含む完全な解析前検査ではありません。ブラウザは`window.studioApi.getCapabilities()`と`diagnoseExecution(options)`を使います。
