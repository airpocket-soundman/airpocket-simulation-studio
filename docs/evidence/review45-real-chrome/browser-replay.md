# 実hiddenタブ録画終了QAの再実行手順と実測結果

2026-10-22 に source `070ec8f885f0e15c889cacaed3c151292c1cc506` の専用worktreeで、branded Chrome `155.0.8059.86` の実タブを使い、`EXPORTBACKGROUND1` のhidden終了・中止・期限・復旧を確認した。結果は `2026-10-22-review45-real-chrome.json`。

## 実測結果

- 2つの合成音響caseを比較表示に設定し、foregroundで1秒WebMを正常作成。18,662 bytes、SHA-256 `45ea12d2ceaa0a770c906a1e90f862e178f3f54dcc272e9c4b65aadc640a0865`。
- 録画中に別の実タブを `Page.bringToFront` で前面化し、対象タブの `document.visibilityState` が `visible`→`hidden` に変化したことを `visibilitychange` で確認。
- hidden中の録画は977ms以内に終了し、理由「Video creation stopped because this page moved to the background. Keep it visible and retry.」を表示。MediaRecorderは`inactive`、video trackは`ended`、download/previewは非表示、開始ボタンは再度有効。
- 開始時からhiddenの場合は530msで同じ理由を表示し、Recorder/Streamを作らず、artifactも残さない。
- 明示的な中止は895msで「Video creation cancelled.」、Recorder/track/artifactを解放。
- 停止期限のfault injection（`stop()`の`onstop`を落とす）は3,236msで`WEBM_STOP_TIMEOUT`相当の理由を表示し、trackを`ended`にして復旧。これは実hiddenの結果ではない。
- 各run前後で入力revision、case一覧、比較view、結果view、MCPのcompare/caseListを比較し、復元を確認。tokenは保存していない。

## 再実行手順

1. sourceを固定した専用worktreeで `npm ci` とkernel/CAD準備を行う。
2. 専用profileのbranded Chromeを `--remote-debugging-port=9333` で起動し、所有portでdev serverを起動する。
3. `$env:QA_ORIGIN="http://127.0.0.1:<port>"; node scripts/qa-review-45-chrome.mjs` を実行する。スクリプトは2つの合成caseを取り込み、比較表示・inspect+view pairing・UI録画を行う。
4. `node scripts/qa-review-45-evidence.mjs` でchecksを通し、証拠JSONを生成する。
5. 所有page、stdio MCP、所有dev serverをcleanupする。

## 限界

- hiddenはCDPで実タブを切り替えて作った。DOMイベントの手動dispatchやheadlessの模擬hiddenではない。
- 確認したのはWindows上のChrome 155のみ。Electron/Firefox/Safari/モバイルは未確認。
- 録画セッションの失効経路は個別実行していない。停止期限はfault injectionであり、実停止の再現ではない。
- foreground WebMは短い合成サンプルで、画質・本番エンコード品質の評価ではない。
- 親タスク `EXPORTBACKGROUND1` のstatus/releasedは変更していない。
