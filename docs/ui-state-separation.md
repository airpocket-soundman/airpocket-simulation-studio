# UI・状態の分離（MOD1 第3スライス）

[English](en/ui-state-separation.md)

MOD1は未完了です。ここではmain.jsから保存ケース一覧のUIだけを分離しました。Reactなどへの移行は行っていません。

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
