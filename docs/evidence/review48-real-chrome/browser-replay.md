# 実Chrome性能・メモリQAの再実行手順と実測結果

2026-10-22 に source `070ec8f885f0e15c889cacaed3c151292c1cc506` の専用worktreeで、branded Chrome 155.0.8059.86 と公式stdio MCP（inspect+analyze）を使い、`structural-tiny` の実測とメモリprobeの結合まで完走した。今回の結果は `2026-10-22-review48-real-chrome.json`。

## 実測結果

- 入力: 10×10×40mm、E=1e9Pa、ν=0、z=0面固定、z=40面+Z100N、`structural-tiny` size=8mm、repeats=1。
- 実Chrome: `Chrome/155.0.8059.86`、CDP 9333、所有origin `http://127.0.0.1:5198`。
- 実行: cold 849.974ms、warm 1276.975ms（n=1）。cancelはfirst-event 110.575ms / half-warm 107.484msで、ともに`cancelled`。取消後も成功し、復旧を確認。
- probe: interval 1000ms、28 samples、crossOriginIsolated true。baseline 16 samples、case window内4 samples、cancel settle後6 samples、settle後5 samples。
- メモリは**系列別**:
  - UASM: baseline 50,409,095 B、sampled max 50,576,673 B、afterCancel 50,569,985 B、afterSettle 50,569,985 B。
  - usedJSHeapSize: baseline 23,035,266 B、sampled max 24,972,926 B、afterCancel 23,215,719 B、afterSettle 23,280,635 B。
- 系列の足算・代替はしていない。値は周期sampleの最大で、真のpeak/RSS/GPU値ではない。

## 再実行手順

1. 専用worktreeでsourceを固定し、`npm ci`・kernel/CAD準備を済ませる。
2. 専用profileのbranded Chromeを `--remote-debugging-port=9333` で起動し、Studio dev serverを所有portで起動する。
3. `QA_ORIGIN=http://127.0.0.1:<port> node scripts/qa-review-48-chrome.mjs` を実行する。スクリプトは10×10×40mm、E=1e9、ν=0、z0固定、z40 +Z100Nを読み込み、inspect+analyzeだけをpairingし、probeを設置する。
4. `node scripts/perf-browser.mjs --merge-memory .qa/perf-probe.json --out .qa/perf-followup48.json` でraw reportとprobeを結合する。rawとmergedは別ファイルで保持する。
5. `node scripts/qa-review-48-evidence.mjs` でchecksを通し、`docs/evidence/2026-10-22-review48-real-chrome.json` を生成する。
6. probe timer、所有page、stdio MCP、所有serverをcleanupする。token/接続codeは保存しない。

## 制約

- `size=8mm` は `structural-tiny` のstartJobオプション。スクリプトは結果の要素数を独立記録しない。
- UASMとusedJSHeapSizeは異なるscopeで、合計しない。sampled maxを真のpeak/RSS/GPU値と呼ばない。
- 親タスクPERF1のstatus/releasedは変更していない。
