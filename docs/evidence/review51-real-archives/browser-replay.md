# 音響比較GIF QAの再実行手順と実測結果

2026-10-22 に source `070ec8f885f0e15c889cacaed3c151292c1cc506` の専用worktreeで、branded Chrome 155.0.8059.86 と公式stdio MCP（inspect+viewのみ）を使い、実GIFの取得まで完走した。今回の結果は `2026-10-22-review51-real-chrome.json`。cases.jsonは実headlessソルバーの1Pa/2Paケースで、GIFは実Chromeから別途取得した。

## 実測結果

- 2 case: `Synthetic acoustic 1Pa` / `Synthetic acoustic 2Pa`、同一mesh 335 nodes、size 3mm。
- 保存frame: 各24（要求25をsnapshot budgetで削減、warning 1）。各時刻0〜0.0012s。
- 音響条件: 343m/s、1.2kg/m3、4kHz、pulseWidth 0.0001s、duration 0.0012s。
- 振幅: 1Pa/2Pa、`maxPressurePa` と `receiverPeakPa` の比は2.0。
- 共通range: instantPressure、-3.4066020347578125〜3.532363432716448Pa。保存field全体のmin/maxと一致。
- GIF: 5,574,849 bytes、SHA-256 `411fdb299169b999647a71bddb74cf03ade676af294e0d0e270173ba1e7de648`。
- 24 frame、各640×320、loop 0、RGB332。一般decoderで全24 frameをdecode。
- delay合計2000ms。per-frameは8/9csで、200csへの丸めはない。
- phasePolicy `i/23`、physical range 0〜0.0012s、nearest-stored-frames-only、interpolated false、camera fixed。
- 先頭/中間/末尾の左右panelは異なり、frame 0→12/23の画素差を確認。
- stale case revision、単一時刻、逆範囲、範囲外、stale comparison view revisionはすべて拒否。成功/拒否/取消前後でinput/result/cases/comparison/cameraが一致。取消artifactは拒否。

## 再実行手順

1. 専用worktreeでsource差を確認し固定する。再計算は `node scripts/qa-review-export-archives.mjs acoustic .qa/review51-fresh`。新しい空出力先のみ。
2. `node scripts/qa-review-51-chrome.mjs` を実行する。`QA_ORIGIN` で所有localhost originを指定し、専用profileのbranded Chromeを `--remote-debugging-port=9333` で起動しておく。
3. 正規Chrome GUIでcases.jsonを読込み、同じmesh 335 nodes、各24保存frame（要求25をbudgetで削減）を確認する。
4. 正式MCPは所有localhostのinspect+viewのみ。edit/analyzeを追加せずcodeはメモリ保持する。
5. GUI/APIで同じ2case、instantPressure、time animation、共通固定rangeとcameraを設定する。input/result/cases/compareの原状態を保存する。
6. 2秒・24frame・640×320のGIFを正式startCompareExportから作る。timeout時は状態確認を優先し、正常artifactを捏造しない。
7. 全artifact byteとmanifestを取得しSHA/長さを検査。`python scripts/qa-review-51-decode.py .qa/review51/artifact.gif .qa/review51/export-summary.json` で全24frame・各640×320・delay・loopを検証する。
8. `node scripts/qa-review-51-evidence.mjs` でchecksを通し、`docs/evidence/2026-10-22-review51-real-chrome.json` を生成する。
9. 先頭/中間/末尾画素、2倍振幅と共通rangeを確認。cameraやsource結果を一致のために変更しない。
10. 成功/取消前後の4状態・camera復元とstale/逆範囲拒否を確認。rawGIF・manifest・decode結果を保持する。
11. 所有接続/server/tabを解除終了する。Chrome接続が不安定なら未確認を保持し、Node stubで代用しない。

## 未確認・制約

- 保存caseは要求25のうち24 frameを保持している（budget warning 1）。GIFはその24保存frameだけを使い、追加frameを合成していない。
- manifestは先頭/末尾のpanel時刻を明示するが、中間panel時刻は個別に出力しない。24 frameのpixel hashが全て異なり、i/23 nearest-only方針と実装試験で中間phaseを補完する。
- GIFはlossy RGB332のため画素比較は定性評価。圧力値と共通rangeは保存fieldとmanifestから確認した。
- 親タスクVIEWCOMPAREのstatus/releasedは変更していない。
