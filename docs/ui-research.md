# 既存CAEの操作画面調査と改善案

[English](en/ui-research.md)

調査日: 2026-10-15。対象タスク: `UIRESEARCH1`（調査）。`UIIMPROVE1`（実装）の入力資料であり、この文書自体は画面を変更しない。

方針は[製品方針](product-direction.md)、[結果ビューア仕様案](result-viewer-direction.md)、[競合比較](competitive-landscape.md)に従う。既存CAEの画面構成をそのまま増やさず、初心者とユーザー自身のLLMエージェントの協働に必要な部分だけを取り入れる。

## 調査方法と限界

- 公開ヘルプ・公式ページ・解説記事を`WebFetch`で取得できたものだけを根拠にする。取得できなかった資料は検索結果の要約のみであることを明記し、「未取得」と表示する。
- 各製品を実際に操作していない。版・操作感・画面の実物は未確認であり、「観察」は資料の記述、「推測」は筆者の解釈と区別する。
- 取得日はすべて2026-10-15。資料の版は各行に記す（版が不明なものは「版不明」）。
- 共通例題は[製品方針](product-direction.md)のブラケット（単一部品、線形静解析と定常熱）を想定する。製品ごとの実測比較（操作回数・所要時間）は行っていない。

## 製品 × ワークフロー比較

凡例: ○=資料に記述あり、△=部分的、－=資料に記述なし（非対応の意味ではない）、?=未確認。出典の「取得」は本文を取得して確認、「検索のみ」は検索結果の要約だけで本文は未取得。

| 製品（版） | 手順の見せ方 | 材料・拘束・荷重 | 事前チェック／警告 | ジョブ・進捗 | 結果（凡例・測定・アニメ） | LLM／支援の付き方 | 出典 |
|---|---|---|---|---|---|---|---|
| Autodesk Fusion Simulation（版不明） | ワークスペースで解析種別を選び、設定→解く→結果の順 ○ | 材料は設計から引き継ぎ、拘束は固定・ピン等の型 △ | 解析前の事前チェックで未定義拘束・荷重・材料を指摘（検索のみ） | バックグラウンド実行、Job Status（検索のみ） | 結果は入力変更で「古い」表示。凡例・測定・アニメは別ページ。アニメは最大100コマ（検索のみ） | 資料では未確認 | [How it works](https://help.autodesk.com/cloudhelp/ENU/Fusion-Simulate/files/SIM-HOW-IT-WORKS.htm)（取得）、[Simulation results](https://help.autodesk.com/cloudhelp/ENU/Fusion-Simulate/files/GUID-99797676-4E9B-4257-AAB2-E83766121C9E.htm)（取得）、[Fusion Help検索結果](https://help.autodesk.com/view/fusion360/ENU/?guid=SIM-ANIMATE-CONCEPT)（本文は404、検索要約のみ） |
| SOLIDWORKS Simulation（2018〜2016版ヘルプを検索で確認） | 設計ツリー下の解析ツリー（部品・接続・拘束・外力・メッシュ・結果） | 各条件がフォルダー内のアイコン | 拘束不足では解けない旨の解説記事（検索のみ） | ？ | ？ | ？ | [Study Tree](https://help.solidworks.com/2018/English/SolidWorks/cworks/c_Simulation_Study_Tree_Interface.htm)（本文取得に失敗、検索要約のみ）、記事は取得失敗 |
| Ansys Discovery（2021レビュー、2025 R2コパイロット） | 段階ナビ Model→Explore→Refine ○ | 解析種別は先に選ばず、物理要素の追加から判定 ○ | 「解ける状態か」「不足内容」を示す情報表示と次の操作の促し ○ | 解き直しはライブ（GPU）、Refineで高精度ソルバー ○ | 変位・応力・ひずみをライブ表示。トグルで一時停止 ○ | Engineering Copilot（2025 R2）はUI内のドロップダウンで質問に答え資料へ誘導。設定の自動実行は資料に記述なし ○ | [DEVELOP3D Review](https://develop3d.com/reviews/review-ansys-discovery-2021/)（取得、第三者記事）、[Ansys Copilot](https://ansys.synopsys.com/blog/work-faster-smarter-with-ansys-engineering-copilot)（取得） |
| FreeCAD FEM（版不明） | 解析コンテナ内に拘束・材料・メッシュ・ソルバーを追加する構成。メッシュは最後に作る旨の助言（検索のみ） | 同左 | ？ | ソルバーで`.inp`出力→実行 | 結果オブジェクトから種類を選んで表示、結果の消去（検索のみ） | ？ | [FEM tutorial](https://wiki.freecad.org/FEM_tutorial)・[FEM Workbench](https://wiki.freecad.org/FEM_Workbench)は取得時にアクセス拒否（Anubis）。**未取得**、検索要約のみ |
| Onshape Simulation（版不明） | アセンブリ内の解析設定。線形静解析と固有値 ○ | 部品・面に直接荷重・拘束、残る自由度を表示 ○ | メッシュ操作なし。拘束状態の可視化 ○ | 背景実行（同時最大50）、版管理された結果履歴 ○ | 設定変更で結果が自動更新 ○ | 製品ページにAI記述なし ○（別製品としてAI Advisorがある旨のみ） | [Onshape Simulation](https://www.onshape.com/en/features/simulation)（取得） |
| Abaqus/CAE（2017版ヘルプ） | モジュール切替（Part→Property→Assembly→Step→Interaction→Load→Mesh→Job→Visualization他）。順序は目安で任意順に選べる ○ | Property/Loadモジュール | メッシュの検証、順序制約の記述が一部 △ | Jobモジュールで投入・監視 ○ | Visualizationモジュール（出力DB基準） ○ | ？ | [What is a module?](https://abaqus-docs.mit.edu/2017/English/SIMACAEGSARefMap/simagsa-c-abswhatisamodule.htm)（取得） |
| Siemens Simcenter 3D Pre/Post（版不明、第三者ヘルプ） | Simulation Navigator（ツリー）→解を作る→境界条件→解く、結果はPost Processing Navigator ○ | ツリーでドラッグして解に有効化 ○ | ？ | ツリー上で解を右クリックして実行 ○ | 結果種別をダブルクリックで表示 ○ | ？ | [Simulation process](https://help.mayahtt.com/kb/topics/simulation_process_in_simcenter_3d_pre_post_thermal_flow.html)（取得、販売代理店ヘルプ。Siemens公式ではない） |
| Autodesk CFD（2024版クイックスタート、2027版ヘルプ） | 材料→境界条件→メッシュ(自動サイズ)→解く→結果→複製して比較 ○ | 同左 | ？ | 収束まで反復 ○。設計中はロック ○ | 目的別（圧損・温度等）の抽出。比較はDecision Center ○ | ？ | [Quick Start](https://help.autodesk.com/cloudhelp/2024/ENU/SimCFD-QuickStart/files/GUID-193CE8EA-EA64-41E9-8D52-F5387CC928D3.htm)（取得）、[Design Study Bar](https://help.autodesk.com/cloudhelp/2027/ENU/SimCFD-Learning/files/GUID-02FBDA3D-E96F-4867-AF74-3507D9B12280.htm)（取得）|
| SimScale Engineering AI（参考） | 自然言語で設定・実行・報告 | AIが領域抽出と材料・境界条件を割り当て ○ | ? | クラウド実行、ブラウザを閉じても継続 ○ | 指定量の抽出、断面と画像の生成 ○ | 実行中の作業一覧と理由を表示し、承認は必須でなく任意で介入 ○ | [Engineering AI explained](https://www.simscale.com/blog/engineering-ai-explained/)（取得） |

### 観察（資料の記述）

- Autodesk CFDはStudy/Design/Scenarioの3階層で、複製・比較・メモを標準機能にしている。ジョブ実行中はDesignがロックされる。
- Discoveryは解析種別を先に選ばせず、準備の充足度を常時表示する。Fusionは「古い結果」を状態表示で示す。
- Onshapeはメッシュ操作を見せず、拘束状態と残る自由度の可視化に寄せる。
- Abaqusのモジュール順序は目安で、任意の順に行ける。SimcenterはNavigator（ツリー）で操作と結果表示を分ける。
- SimScaleは作業一覧と理由を表示し、承認を必須にしない。

### 推測（筆者の解釈、未検証）

- 初心者の混乱は「どこが未入力か」が画面に現れないことで起きやすい。Discoveryの準備度表示とFusionの事前チェックはこの対策と考えられる。
- 結果の古さを示す表示は、条件を直しながら反復する利用（人間もLLMも）で取り違えを減らす。
- これらの効果を本アプリで定量評価していない。`UIIMPROVE1`で同一例題の操作数・復帰時間を測る。

## 本アプリの現状画面（調べた範囲）

`index.html`は`#app`のみで、画面は`src/main.js`の`document.querySelector('#app').innerHTML`が組み立てる（`src/ui/*`は`status-ui.js`・`case-list-ui.js`・`fatigue-ui.js`のみ。他に`src/browser-session-ui.js`、`src/named-view-ui.js`、`src/case-bundle-ui.js`、`src/cad-update-ui.js`等が分かれている）。

- 左列: `01 モデル`（`#model`、サンプル各種）、`外部流体領域`、`02 領域を選ぶ`、`内部を見る`、`形状の不備を検査`（`#region-report`）、`保存・復元`。
- 右列: `03 解析条件`（`#physics`と`材料物性を入力`等の`details`群）、`設定した条件`（`#conditions`）、`計算エンジン`（`#mesh-run`、`#solve-run`、`#cancel-run`、`#setup-view`、`#status`、`#mesh-summary`）、`結果表示`（`#result-field`、`#result-legend`、`#color-*`、`#deform-scale`、`#probe-result`、`#result-export`）、`解析ケースの比較`（`#case-add`、`#case-list`）。
- 確認できたこと: 状態表示は単一行の`#status`。GUIに「解析前チェック」ボタンは見当たらず、`preflight`は`studio-api`／MCP側のみ（`src/studio-api.js`、`src/browser-operation-names.js`）。「結果が古い」を示す表示は`src/main.js`に見つからない。`@media`は`src/main.js`内に無い（スタイルは別ファイルのため狭い画面は未確認）。
- 未確認: 実ブラウザでの見た目、狭い画面・キーボード操作・日英切替の挙動。

## 改善案（優先順）

共通ルール: GUI・API・MCPは同じ状態を扱う（製品方針）。各案は新しい操作を作る場合に意味的API・MCP・Skill案内を同時に整える。工数: S=1〜2日、M=3〜7日、L=2週間超（目安）。

### 1. 準備状況ストリップ（解析の進み具合を常に表示）

- 内容: 左右列の上部に「モデル→領域→材料→条件→メッシュ→実行→結果」を並べ、各段の状態（未入力／要確認／準備済）を示す。段をクリックすると該当する`section`／`details`へ移動する。
- 根拠: Discoveryの準備度表示、Abaqusの段階順（順序は目安として自由に移動可）。初心者が未入力箇所を見つけやすくなる。
- 工数: M。リスク: 「準備済」を「物理的に妥当」と誤解させる。表示は`completePreflight:false`の規約を守り、「検査を通った」と「正確」を区別する文言にする。
- 揃える対象: `preflight`、`inspect`（`requiredPointers`）。Skill: `skills/airpocket-studio/references/saved-inputs.md`。新規API不要（既存の読み取りで表示する）。
- 新規ID案: `#readiness`。

### 2. 解析前チェック（事前検査）パネル

- 内容: `#solve-run`の隣に「解析前チェック」を置き、`preflight`の結果を一覧表示する（安定コード・重要度・対象・根拠・修正候補・利用者確認要否）。対象をクリックすると領域を強調する。
- 根拠: Fusionの事前チェック、Discoveryの不足内容表示。製品方針の構造化診断をGUIにも出す。
- 工数: M。リスク: 修正候補の自動適用で拘束を黙って追加すると、実物の支持を表さない（製品方針）。自動適用は行わず、提案と確認のみ。
- 揃える対象: `preflight`、`previewEdit`／`edit`（修正案の適用は既存の検査付き編集を使う）。Skill: 同上。
- 新規ID案: `#preflight-run`、`#preflight-list`。

### 3. 診断の定位置表示と読み上げ対応

- 内容: 単一行`#status`（`src/ui/status-ui.js`の`STATUS_LABELS`）を、直近の診断を複数保持するリストへ拡張。重要度と対象を併記し、`role="status"`／`aria-live`を付ける。
- 根拠: 現状は上書きで消え、初心者は直前のエラーを見失う。LLMが`jobStatus`で読む診断と同じ内容を人も見られる。
- 工数: S。リスク: 既存メッセージの日英辞書との整合。`STATUS_LABELS`に無い文言は従来どおり`localizeStatus`へ。
- 揃える対象: `jobStatus`、`jobEvents`、診断コード。
- 既存ID: `#status`（残して互換維持）。新規ID案: `#diagnostics`。

### 4. 条件ツリー（拘束・荷重・材料・メッシュの一覧と個別の警告）

- 内容: `#conditions`を種別ごとのグループ（材料／拘束／荷重／熱／メッシュ）に整理し、各行に警告アイコン、領域強調、編集・削除を付ける。
- 根拠: SOLIDWORKSのFixtures/External Loadsフォルダー、SimcenterのNavigator、Abaqusのモデルツリーに共通する構成。
- 工数: M〜L（既存の条件追加UIが多く、各`details`との連携が必要）。リスク: 既存の保存形式（JSON）を変えない。表示だけ再構成する。
- 揃える対象: `inspect`、`edit`、`previewEdit`。
- 既存ID: `#conditions`、`#region-report`。

### 5. 「結果が古い」表示

- 内容: 条件・メッシュ・設計版が結果の入力版と異なるとき、結果表示に「古い」バッジと再計算導線（`#setup-view`と`#solve-run`）を出す。
- 根拠: Fusionの結果ノードの古さ表示。条件を直して反復する利用で取り違えを防ぐ。製品方針の「入力版と結果の結び付け」と一致。
- 工数: S。リスク: 入力版の比較が`main.js`の状態と食い違うと誤表示になる。比較は`studio-api`の入力版を使い、独自に計算しない。
- 揃える対象: `getResultView`、`jobStatus`の入力版、`caseView`。
- 新規ID案: `#result-freshness`。

### 6. ジョブ進行の段階表示と暫定ラベル

- 内容: 準備（モジュール取得）・メッシュ・計算を分けて進行を示し、`#cancel-run`の近くに経過、反復・残差等の取得できる情報を表示。暫定値には「暫定」ラベルを付ける。
- 根拠: FusionのJob Status、Autodesk CFDの収束表示。製品方針の中間結果パイプラインを人にも見せる。
- 工数: M。リスク: ソルバーが返せない情報は「提供なし」と明示する（空欄で済ませない）。
- 揃える対象: `startJob`、`jobStatus`、`jobEvents`、`cancelJob`。
- 既存ID: `#solve-run`、`#cancel-run`、`#mesh-summary`。

### 7. 結果ビューアの操作集約（凡例横の範囲・測定・アニメーション）

- 内容: 結果表示の操作を凡例の近くへ集約し、色範囲固定・変形倍率・測定点の一覧（単位付き）・再生バーを同じ場所に置く。変形往復は「実際の動的応答ではない」旨を表示する。
- 根拠: Fusionの再設計された結果表示（凡例横の設定とアニメーションバー、検索要約のみで未取得）。[結果ビューア仕様案](result-viewer-direction.md)の第1段階と整合。
- 工数: M。リスク: レイヤーを増やしすぎて初心者に重くなる。初期は物理分野ごとのプリセットだけ見せ、詳細は折りたたむ。
- 揃える対象: `getResultView`／`setResultView`、`probe`、`startExport`、`namedViewSave`／`namedViewApply`。
- 既存ID: `#result-legend`、`#color-fixed`、`#color-min`、`#color-max`、`#deform-scale`、`#probe-result`、`#result-export`。

### 8. エージェント協働パネル（提案の確認と承認）

- 内容: `browser-session-ui.js`の接続状態を見える位置に置き、エージェントが`previewEdit`で出した変更案を差分で表示して、利用者が適用・却下できるようにする。実行中のエージェント操作は一覧で確認できる。
- 根拠: SimScaleは作業一覧と理由を表示する。本アプリは独自AIを持たず、ユーザー自身のLLMの操作を可視化する形にする。
- 工数: L。リスク: 接続・認証の扱い（秘密情報を画面や履歴へ出さない）、古い入力版への上書き（入力版指定で拒否）。LLM側の確信度を根拠として表示しない。
- 揃える対象: `previewEdit`、`edit`、`jobEvents`。ブラウザ接続の仕様は[自動化](automation.md)、[エージェント運用](agent-operation.md)。Skill: `skills/airpocket-studio`。
- 既存: `src/browser-session-ui.js`。新規ID案: `#agent-proposals`。

### 9. ケース比較の設計版グルーピング

- 内容: `#case-list`を設計版（形状・条件の系統）ごとにまとめ、共通の色範囲で並べて比較する。ケースごとにメモを持てるようにする。
- 根拠: Autodesk CFDのStudy/Design/Scenarioとメモ、Onshapeの結果履歴。ブラケット3案比較の例題（製品方針）に直結。
- 工数: M。リスク: 比較条件の違い（メッシュ・単位・設計版）を黙って同一視しない。違いは警告として表示する。
- 揃える対象: `caseList`、`caseCompare`、`caseSave`、`caseView`。
- 既存ID: `#case-add`、`#case-list`、`#case-export`。

### 画面案（左右列と結果の概略）

```
[ 準備状況: モデル ● 領域 ● 材料 ▲ 条件 ○ メッシュ ○ 実行 ○ 結果 ○ ]   (案1)
左列                          右列
01 モデル                      03 解析条件
02 領域を選ぶ                  設定した条件（グループと警告）           (案4)
                              計算エンジン [解析前チェック][メッシュ][解析][中止]  (案2,6)
                              診断リスト                               (案3)
                              結果表示［古い］ 凡例・範囲・測定・再生      (案5,7)
                              エージェントの提案（差分と適用/却下）        (案8)
                              解析ケースの比較（設計版グループ）          (案9)
```

## 提案しない／対象外

- 独自のAIチャットやAIサブスクリプションへの誘導（製品方針。LLMはユーザー側）。Discoveryのコパイロットのような質問応答窓の自前実装はしない。
- 拘束・荷重・材料の黙った自動補完や、LLMの確信度を根拠にする表示。
- Discoveryのようなリアルタイムの「ライブ」連続解法（Explore）。対応ソルバーと検証範囲が異なるため。
- Onshapeのような「メッシュを見せない」方針の全面採用。メッシュ品質と依存性は物理的妥当性の説明に必要。
- Abaqusのモジュール切替式UI、CADの形状編集・パラメトリックモデリング、クラウド実行基盤。
- 新しい解析分野・ソルバーの追加、色テーマやブランドの全面刷新。
- 静解析の変形往復を動的応答として見せる表現。
- この調査での実装。実装は`UIIMPROVE1`で段階的に行う。

## 検証できなかったこと

- FreeCAD FEM（公式wikiがアクセス拒否）、SOLIDWORKS（ヘルプ本文が取得できず）、Fusionのプローブ・凡例の個別ページ、Siemens公式資料。いずれも検索要約か第三者資料のみ。
- 全製品の実機操作、操作回数・所要時間の比較、版ごとの画面差。
- Autodesk CFD、Abaqusの結果表示の詳細、LLM連携の有無（資料に記述がないものは「?」とした）。
- 本アプリの実ブラウザでの見た目、狭い画面、キーボード操作、日英表示。

## 版固定の共通例題比較（2026-10-18）

**COMSOL Multiphysics 6.3** と **Ansys Mechanical 2025 R2（v252）** を、**2026-10-18** に取得した発行元公式資料で比較する。版は資料の版であり、インストール済み製品の版ではない。製品の実機操作は行っていない。先の広域調査と本アプリの静的調査は2026-10-15時点の記録として残し、この追記で未確認事項を確認済みに変更しない。SOLIDWORKS 2025のヘルプは再取得でも本文でなく外枠/エラーとなったため、詳細比較対象から外した。

### 共通課題と根拠の境界

別々に供給するブラケットsolidを A基準、B板厚増加、Cリブ追加の3案とする。取付部と荷重部の機能を揃え、各案に線形静構造と独立した定常熱伝導を実行する。計6ケースであり、熱応力連成ではない。共通入力表には形状ファイル/単位、材料特性、固定/荷重領域と大きさ、温度/熱入力領域と値、メッシュ方針、比較量を記録する。形状変更ごとに領域を再同定し画面上で確認する。本書に実形状ファイル・寸法・荷重・解析済み参照値はない。入力供給後に実行可能となる課題仕様であり、実行済みベンチマークではない。

**D** は取得本文の直接記述、**M** は共通課題への本調査の対応付け、**?** は未確認。公式例題の形状・荷重は共通課題と異なるため、公式の解析結果をA/B/Cの結果として扱わない。

| 段階 | COMSOL 6.3 | Mechanical 2025 R2 |
|---|---|---|
| 取込 | **D:** STEP、元/現単位、取込後selectionを指定でき、対応するCAD Import/Design/LiveLinkライセンスが必要 [C1]。**M:** A/B/Cを別々に取り込み単位確認。 | **D:** 材料と形状の接続を独立段階にする [A1]。**M:** 各案を解析systemへ接続。**?:** STEP translatorの具体設定は未取得。 |
| ツリー・選択 | **D:** ブラケット例題はModel Builder、形状selection、選択境界を使う [C2]。**M:** 各案で取付/荷重/熱領域を定義。 | **D:** Model/解析objectのツリー [A2]、形状指定またはworksheet条件のNamed Selection [A3]。**M:** 各案に同じ意味の領域名を作る。 |
| 材料・条件 | **D:** 構造例題は材料・機械条件を設定 [C2]。熱例題はStationaryの伝熱と温度/熱源条件を扱う [C3]。**M:** 共通入力表の独立2ケースを設定。 | **D:** system種別で対応荷重/結果を絞る [A2]。定常熱では熱伝導率が必要で、温度・熱流量/熱流束条件を使える [A4]。**M:** 同一入力表の特性と領域を設定。 |
| メッシュ・ジョブ | **D:** ブラケット例題はメッシュ生成とCompute [C2]、Progressは停止/取消を提供 [C4]。**M:** 6ジョブを区別しメッシュ/設定を記録。 | **D:** メッシュ、設定、解法が独立段階 [A1]。**M:** 識別した6ケースを実行。**?:** 取消/再開挙動は実測していない。 |
| 診断 | **D:** Progressからlogを参照 [C4]。構造例題は応力特異点と平均化の影響を説明 [C2]。**M:** 診断を対象ケースに残し、成功終了と応力最大値の妥当性を分ける。 | **D:** Solution Informationでsolver出力、solution/result履歴を表示。対応はsolver依存 [A5]。**M:** 修正/再計算前の診断を保存。 |
| 結果・比較・出力 | **D:** parametric job設定で結果/表/画像を保存できる [C5]。**M:** 記録した数値表と表示条件を揃えA/B/C比較。別ファイル間自動比較の実証ではない。 | **D:** 定常熱資料はcontourと同一modelの解析間chart比較を説明 [A4]。対応objectをtext/区切り形式に出力できる [A6]。**M:** A/B/Cの表を外部で集約。任意の異形状を同期比較できるかは **?**。 |

構造は変位/応力、熱は温度/熱流を比較し、量・単位・平均化・色範囲・カメラを揃える。特異な拘束近傍の最大値だけで設計を順位付けせず、解釈とメッシュ根拠を残す。表/画像には設計・ケース・入力の識別を付ける。これは比較の評価要件であり、各製品が自動で全項目を保持するという主張ではない。

### 初心者負担とエージェント協働：観察ではなく推論

COMSOLのphysics/study/selectionの明示的な節点は覚える概念を増やす一方、中間設定を点検しやすいと推測する。Mechanicalのsystem別の絞込みとNamed Selectionは案内に役立つと推測するが、project/tree/Details間の移動と形状変更後の選択維持には学習が必要となる。これは資料からの推論であり、クリック数、完了時間、誤操作率、使いやすさの優劣を測ったものではない。

COMSOLにはCAD import API [C1] とparametric solver API [C6] の記述がある。エージェント生成scriptを人が確認する方式の調査根拠にはなるが、完成したLLM連携の証拠ではない。Mechanicalは領域・診断・出力の点検経路を確認したが、今回版対応の自動化API本文は取得していない。両製品のagent更新、revision検査、undo、ライセンス、無人実行は **?**。本アプリでは改善案1〜3を準備状況と修正可能な失敗の保持、4〜5を領域/条件と古い結果の結付け、6〜7をジョブ/結果の文脈、8〜9を変更の承認と設計/ケース識別に対応させる。既存の優先順位と画面案は維持する。

### 一次資料と残る検証

以下は全て2026-10-18に本文取得。URLで6.3またはv252を固定する。上表は資料の要約であり、画面を実際に観察した意味ではない。

- C1: [Import 3D CAD](https://doc.comsol.com/6.3/doc/com.comsol.help.cad/cad_ug_ref.6.21.html)。
- C2: [Bracket — Static Analysis](https://doc.comsol.com/6.3/doc/com.comsol.help.models.sme.bracket_static/bracket_static.html)。
- C3: [Heat Conduction with a Localized Heat Source on a Disk](https://doc.comsol.com/6.3/doc/com.comsol.help.models.heat.localized_heat_source/localized_heat_source.html)。
- C4: [The Progress Window](https://doc.comsol.com/6.3/doc/com.comsol.help.comsol/comsol_ref_solver.36.109.html)。
- C5: [Using a Job Configuration to Store Parametric Results on File](https://doc.comsol.com/6.3/doc/com.comsol.help.comsol/comsol_ref_solver.36.232.html)。
- C6: [Parametric Sweep API](https://doc.comsol.com/6.3/doc/com.comsol.help.comsol/comsol_api_solver.51.74.html)。
- A1: [General Analysis Workflow](https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/wb_sim/ds_overview_approach.html)。
- A2: [Define Part Behavior](https://ansyshelp.ansys.com/public/Views/Secured/corp/v252/en/wb_sim/ds_Assign_Materials_to_Parts_step.html)。
- A3: [Defining Named Selections](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/wb_sim/ds_geo_defname.html)。
- A4: [Steady-State Thermal Analysis](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/wb_sim/ds_static_thermal_analysis_type.html)。
- A5: [Specifying Solution Information](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/wb_sim/ds_Nonlinear.html)。
- A6: [Data Export](https://ansyshelp.ansys.com/public/views/secured/corp/v252/en/wb_sim/ds_ExportingData.html)。

本調査単位の成果は根拠付き操作比較と改善優先付けであり、6ケースの実証ではない。実機で残る作業は、共通形状/入力表の供給、取込と領域対応、固定不足/誤面選択の診断と復旧、計算後の入力変更と古い結果の表示、ジョブ取消、6ケースの比較/出力/再読込、キーボード・言語・狭い画面での確認。面の自動追従、solver精度の一致、初心者負担の実測改善は未実証。

## 受け入れ条件との対応（`UIRESEARCH1`）

| 要求 | この文書での扱い |
|---|---|
| 取込・ツリー・領域選択・材料条件・ジョブ・診断・結果比較出力の比較 | 版固定の共通例題表で2製品の全段階を比較。MechanicalのSTEP詳細、異形状同期比較は未確認と明記 |
| URL・版・確認日・観察と推測の区別 | 旧調査は2026-10-15、新一次資料は6.3/v252固定・2026-10-18取得。D/M/?で直接記述・対応付け・不足を区別 |
| 初心者の負担とエージェント協働の評価 | 推論専用節、自動化根拠の境界、改善案1〜9。実測した使いやすさを主張しない |
| 優先順位付き改善案と画面案 | 改善案1〜9と画面案 |

## 関連資料

[製品方針](product-direction.md)、[結果ビューア仕様案](result-viewer-direction.md)、[競合比較](competitive-landscape.md)、[エージェント運用](agent-operation.md)、[UI状態の分離](ui-state-separation.md)
