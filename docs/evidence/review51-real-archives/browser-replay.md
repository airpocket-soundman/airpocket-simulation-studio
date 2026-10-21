# 音響比較GIF QAの引継ぎ

cases.jsonは実headlessソルバーの1Pa/2Paケース。Chrome画像やGIF decodeの成功証拠ではない。

1. 専用worktreeでsource差を確認し固定する。再計算は `node scripts/qa-review-export-archives.mjs acoustic .qa/review51-fresh`。新しい空出力先のみ。
2. 正規Chrome GUIでcases.jsonを読込む。同じmesh335nodes、各24保存frame（要求25をbudgetで削減）を確認する。
3. 正式MCPは所有localhostのinspect+viewのみ。edit/analyzeを追加せずcodeはメモリ保持する。
4. GUI/APIで同じ2case、instantPressure、time animation、共通固定rangeとcameraを設定する。input/result/cases/compareの原状態を保存する。
5. 2秒・24frame・640×320のGIFを正式startCompareExportから作る。timeout時は状態確認を優先し、正常artifactを捏造しない。
6. 全artifact byteとmanifestを取得しSHA/長さを検査。一般decoderで全24frame・各640×320・均一delay・loopを検証する。
7. GIFの10ms刻みと実delay合計を記録し、要求2秒との差を保持する。phase i/23、物理時刻0〜0.0012s、nearest/interpolated:falseと実表示値を照合する。
8. 先頭/中間/末尾画素、2倍振幅と共通rangeを確認。cameraやsource結果を一致のために変更しない。
9. 成功/取消前後の4状態・camera復元とstale/逆範囲拒否を確認。rawGIF・manifest・decode結果を保持する。
10. 所有接続/server/tabを解除終了する。Chrome接続が不安定なら未確認を保持し、Node stubで代用しない。
