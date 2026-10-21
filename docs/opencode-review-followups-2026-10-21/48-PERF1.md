# 48 PERF1 — 実Chromeのメモリ系列を1ケース測る

今回PRの限定成果は採用対象。以下は未検証QAだけを行う追加指示で、親タスク全体の完了を意味しない。

元指示: `../opencode-work-orders-2026-10-21/23-PERF1.md`。集計修正は取り込み済み。実probeの計測と再現性を埋める。

## 読むファイルと試験
- `scripts/perf-browser.mjs`、`scripts/perf-measure.mjs`、`docs/perf-browser-plan.md`、`docs/automation.md`。
- `node --test tests/perf-browser.test.mjs tests/perf-measure.test.mjs`

## 実施と数値入り受入
1. source凍結のowned localhostをbranded Chromeで開き、合成10×10×40mm構造参照、size8mm、structural-tiny、repeats1だけを準備する。
2. `node scripts/perf-browser.mjs --print-probe`の現行snippetを確認してowned tabへ設置。probeの開始時刻とcrossOriginIsolatedを記録する。
3. 正規stdio pairing後、実originで実行する: `node scripts/perf-browser.mjs --origin http://127.0.0.1:5174 --cases structural-tiny --repeats 1 --out .qa/perf-followup48.json`。portは自分の値へ置換。
4. end後3000ms以上、cancel対象がある場合はsettle後3000ms以上のsampleを取得。cancel未実行を0byteとしない。
5. report/probe原本を保持し、reportを別ファイルへコピーしてから`--merge-memory <probe.json> --out <copied-report.json>`で結合する。
6. UASMとusedJSHeapSizeを別系列としてbaseline/観測peak/afterSettle/afterCancelのsample時刻とcountを照合する。系列間の足算や差分混用は禁止。
7. 少なくとも1系列の実measured samplesが必要。利用不能系列はnull+reason。両方不能なら受入未完。観測peakを真のpeak/RSS/GPU値と呼ばない。
8. raw report/probeのsanitize版または秘密なし再実行QAを残す。probe timerを停止しowned接続/serverをcleanupする。

## 共通条件
- [00-COMMON.md](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/main/docs/opencode-review-followups-2026-10-21/00-COMMON.md)と元指示を読む。最新origin/mainから専用branch/worktreeを作り、主作業フォルダと他担当を変更しない。
- 今回の取り込みは限定実装の受入。親タスクは未完了。既存修正の再実装はせず、実不具合があれば再現を保存し最小修正/回帰試験だけを別途提案する。
- 正式API/MCPと正規pairingを使い、権限を増やさない。合成モデルのみ。sourceを凍結しHMR resetを混ぜない。
- 原データまたは秘密なし再実行QAスクリプトを保持する。JSONにsourceSHA・Chrome版・origin・実行コマンド・結果版・pass/fail/未実行を記録する。
- 自分のprobe/接続/serverだけcleanup。token/接続code/全環境変数を保存しない。自己merge・force push・progress変更は禁止。
- 検証できない条件は未確認のまま残し、証拠と残条件をPRへ。実行不能を成功や物理精度の保証に置き換えない。
