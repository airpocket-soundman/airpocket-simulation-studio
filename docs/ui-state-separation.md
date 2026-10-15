# UI・状態の分離（MOD1 第3スライス）

[English](en/ui-state-separation.md)

MOD1は未完了です。以下の各スライスでmain.jsから一部のUI処理を分離しています。main.jsの巨大テンプレートと全ライフサイクルはまだまとまっており、Reactなどへの移行も行っていません。

## 移動したもの
`src/ui/case-list-ui.js`（`createCaseListUi`）に次を移しました。挙動は変えていません。

- 保存ケース一覧の描画（`renderCases`）と、固有振動・熱ケースの選択肢の更新
- 「現在の計算結果を保存」「ケース集を書き出す」「ケース集を開く」「テキスト表示」のボタン配線
- `window.caseApi`（`Object.freeze`のまま。追加・取り込み・削除の後に一覧を再描画）

依存（DOM取得関数`$`、ケースストア、`status`、`viewCase`、入力復元、最新解析の取得）は引数で受け取り、main.jsをimportしません。main.jsは生成して`renderCases`と`window.caseApi`を公開するだけです。

## 移動していないもの
`viewCase`（3D表示への復元）、`caseOperations`・`caseBundleApi`・各種セッション配線、条件一覧、3D選択、解析実行はmain.jsに残っています。状態（`lastAnalysis`など）もmain.jsが保持します。

## 検証
`tests/ui-case-list.test.mjs`が最小限の偽DOMで描画・配線を確認します。実ブラウザでの動作確認は別途必要です。

## 第4スライス: ステータス表示
`src/ui/status-ui.js`（`createStatusUi`）に、main.jsの`status`関数を移しました。挙動は変えていません。

- 既知メッセージ（温度表の範囲外、拘束不足、計算中止、各解析の進行表示など15件）の固定日本語ラベル（`STATUS_LABELS`）
- ラベルにない文言は注入された`localizeStatus`（`ui-errors.js`）へ委譲し、`#status`の`textContent`に設定

`$`と`localizeStatus`は引数で受け取り、main.jsをimportしません。ラベル表は呼び出しごとの再生成をやめ、凍結した定数にしました。`language`（i18n）や条件一覧、3D選択、解析実行は移していません。
`tests/ui-status.test.mjs`が偽DOMで確認します。実ブラウザでの動作確認は別途必要です。

## 第5スライス: 疲労UI
`src/ui/fatigue-ui.js`（`createFatigueUi`）に、疲労まわりの3関数を移しました。挙動は変えていません。

- `renderFatigueMaterial`（材料フォームへの疲労データ反映）と`readFatigueMaterial`（フォームからの読み取り）
- `renderFatigueResult`（疲労結果の要約パネルと荷重倍率などの入力欄の更新）

`$`、`document`、`getMaterialProperties`、`getLanguage`は引数で受け取り、main.jsをimportしません。`materialProperties`と`language`は変化する値なので、値ではなく取得関数を渡し、呼び出しごとに読みます。main.jsは`renderMaterial`が早い段階で呼ばれるため、`status`の直後で生成します。`fatigueOptions`・`evaluateDisplayedFatigue`（`lastAnalysis`に触れる）、条件一覧、3D選択、解析実行は移していません。
`tests/ui-fatigue.test.mjs`が偽DOMで確認します。実ブラウザでの動作確認は別途必要です。

## 第6スライス: 材料物性フォーム
`src/ui/material-form-ui.js`（`createMaterialFormUi`）に、材料物性フォームの3つの処理を移しました。挙動は変えていません。

- `installFields`（物性入力欄の生成）
- `writeForm`（`renderMaterial`のうちフォーム反映と状態文言の設定。弾塑性・超弾性・直交異方性の優先順位を含む）
- `readForm`（保存ボタンでのフォーム読み取り。直交異方性と破壊データはクローンして保持）

`$`、`document`、`materialFields`、`materialReadiness`、`readFatigueMaterial`、`getMaterialProperties`、`getLanguage`は引数で受け取り、main.jsをimportしません。変化する値は取得関数で渡します。`renderMaterial`の破壊UI更新・未保存フラグ・条件表示の更新、保存ハンドラの塑性荷重分率の整理、カタログ照合、`api`呼び出しはmain.jsに残しています（呼び出し順も維持）。3D選択、解析実行（`lastAnalysis`・`startJob`）、ワーカーには触れていません。
`tests/ui-material-form.test.mjs`が偽DOMで確認します。実ブラウザでの動作確認は別途必要です。

## 第7スライス: 試験・適応・内部領域フォーム
`src/ui/study-form-ui.js`（`createStudyFormUi`）に、入力欄の読み書きだけを行う5関数を移しました。挙動は変えていません。

- `readBrowserStudyControls` / `writeBrowserStudyControls`（ブラウザ試験の制御欄。チェックボックスは`checked`、他は`value`）
- `restoreAdaptiveOptions`（適応メッシュ設定の復元。既定値と百分率換算を含む）
- `internalOptions` / `restoreInternalFields`（内部流体領域の囲い・種点・ポート面）

`$`と`browserStudyControls`は引数で受け取り、main.jsをimportしません。3D選択、`lastAnalysis`、ジョブ、ワーカーには触れていません。
`tests/ui-study-form.test.mjs`が偽DOMで確認します。実ブラウザでの動作確認は別途必要です。

## 第8スライス: 分野別コントロール
`src/ui/discipline-controls-ui.js`（`createDisciplineControlsUi`）に、分野ごとの表示とコントロール可否の更新を移しました。挙動は変えていません。

- 解析分野に対応する `[data-physics]` 要素の表示を切り替え、流体・Stokes の表示中の`details`を開く
- 実行中でないときの解析ボタンを、流体領域メッシュ専用・未確定CAD条件に応じて有効化
- 構造解析でのみ塑性荷重倍率を有効にし、入力された倍率数に非線形ステップ数を合わせる
- 分野・材料モデル・モーダル設定に応じてWebGPU/MFEMを無効化し、選択済みの非対応ソルバーを`wasm-pcg`へ戻す
- 非構造・非線形・モーダル・STLでは適応解析を無効化し、チェックを外す

DOMの`$`/`querySelector`/`querySelectorAll`と、変化する分野・条件・材料・形状・実行状態・ソルバー情報を返す`getState()`を注入します。状態は更新のたびに取得し、モジュールはmain.jsをimportしません。main.jsはコントロール更新関数を組み立て、既存の更新処理から呼び出します。
`tests/discipline-controls-ui.test.mjs`に偽DOMを使う独立した4テストを追加しました。実Chromeのlocalhost画面でも、熱への切替時のソルバー復帰、流体設定の展開、モーダル時のMFEM/WebGPU・適応無効化を確認しました。[ソースsnapshot付き証跡](evidence/2026-10-15-mod1-discipline-ui-chrome.json)を参照。解析実行・全組合せ・公開HTTPS接続の確認を意味しません。

英語版: [en/ui-state-separation.md](en/ui-state-separation.md)
