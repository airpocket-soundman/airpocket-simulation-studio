# PNG連番QAの再実行手順と実測結果

2026-10-22 に source `070ec8f885f0e15c889cacaed3c151292c1cc506` の専用worktreeで、branded Chrome 155.0.8059.86 と公式stdio MCP（inspect+viewのみ）を使い、実PNG ZIPの取得まで完走した。前回Chrome接続断の記録は `2026-10-21-review50-interrupted-attempt.json`。今回の結果は `2026-10-22-review50-real-chrome.json`。

## 実測結果

- 入力: `Synthetic structural 100N`、10×10×40mm、E=1e9Pa、ν=0.3、z=0面固定、z=40面+Z100N、size=5mm、94節点。
- 保存result revision: `sha256:69863dc5f2c56cb34b622ee3777938a5d2fd773cb1e3204146bbcfc25a6cd529`
- section: axisX、位置4mm、無効。exportは manifest phase 0/0.5/1、slice位置0/5/10mm。
- ZIP: 174,226 bytes、SHA-256 `7649263b2ce1fdc66d2ab71f4bf845aa2c99b597143974a7c1b2341b0ffcc2e4`、STORE、3 entries + manifest。
- PNG: 3枚、各725×946、全frame SHA・CRC・寸法・画素差を独立decodeで確認。
- 成功後と取消後でinput/result/cases/compare/camera/sectionが一致。取消jobは `cancelled` でartifact取得は拒否された。
- 実canvasが725×946だったため、旧参照の555×573とは異なる。これは受入条件の3 frame出力を実行した実際のviewport結果で、数値を置換していない。

## 再実行手順

1. 最新mainに今回資料が入った専用worktreeを使う。sourceを固定し、公開用ソースを変更しない。
2. `node scripts/qa-review-50-chrome.mjs` を実行する。`QA_ORIGIN` で所有localhost originを指定する。専用profileのbranded Chromeを `--remote-debugging-port=9333` で起動しておく。
3. GUIの接続欄にstdio MCPのendpointとcodeを入れ、inspect+viewだけを選択する。edit/analyzeは追加しない。codeはメモリだけに保持する。
4. スクリプトは `cases.json` を専用pageへimportし、保存結果を表示する。`getResultView/getView/caseList/getCompareView` の原状態を保存する。
5. section axisX・位置4mm・無効を正規`setView`で設定し、`expectedResultRevision` 付きで `format=png-sequence`、`animation=slice`、`frames=3` を実行する。
6. terminal後にartifact全ページ取得、全ZIP SHA・STORE CRC・各frame SHAを独立検査する。
7. `python scripts/qa-review-50-decode.py .qa/review50/artifact.zip` で一般PNG decoder（Pillow）を使い、3枚の寸法・画素差・phase/sliceを照合する。
8. `node scripts/qa-review-50-evidence.mjs` でchecksを通し、`docs/evidence/2026-10-22-review50-real-chrome.json` を生成する。
9. 成功/取消でinput/result/cases/compare/camera/section復元、部分成果物拒否を確認し、原本ZIPとdecode結果を残す。
10. QA page、stdio MCP、所有serverをcleanupする。接続が繰り返し切れる場合は未確認を保持し、盲目的retryをしない。

再計算用の保存資料は実Node構造計算の結果であり、今回のPNG ZIPは実Chromeで別途取得した。Node fixtureをZIPの代用にしない。
