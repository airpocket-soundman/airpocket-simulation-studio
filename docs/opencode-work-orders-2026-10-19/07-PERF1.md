# 07 PERF1 — 異なるメモリ計測系列を混ぜない

対象: OpenCode / DeepSeek v4.1 Flash。まず[00-COMMON.md](00-COMMON.md)を読む。
ブラウザ対応上限や全体peak RAMを決める依頼ではない。

## 具体的な現状差

scripts/perf-browser.mjsのmergeMemoryはuasmBytes ?? usedJSHeapSizeでsampleごとにfallbackする。
source名はどれか1sampleにuasmBytesがあればUASMとする。
そのためUASMとJS heapの異なる計測範囲が混在して1つのpeakと表示され得る。
今回直すのはこのreport解釈と検証だけ。solver性能最適化ではない。

## 読む順序

1. scripts/perf-browser.mjsのPROBE_SNIPPET/mergeMemory/writeReport。
2. tests/perf-browser.test.mjsのmergeMemory試験とfake clock。
3. docs/perf-browser-plan.md、docs/performance-measurement.md。
4. docs/evidence/2026-10-18-browser-performance-real-chrome.json。

すべて指示作成時に実在確認済み。開始時rgで現状を読み直す。
実機で構造時間/取消は部分測定済みだが、メモリは未測定という境界を守る。

## 変更可能

- scripts/perf-browser.mjsのmemory probe/merge/report関連の最小範囲。
- tests/perf-browser.test.mjs。
- docs/perf-browser-plan.md、docs/en/perf-browser-plan.md。
- docs/performance-measurement.md、docs/en/performance-measurement.mdの関連説明。
- 小さなsanitized測定/fixture証拠JSON。

## 禁止

- solver、mesh限界、physical基準、CI timeoutを変更すること。
- 欠測を0 bytesや成功と扱うこと。
- JS heapをWASM/native/全process peakとして表示すること。
- browser計測をNode RSSで代用し実Chromeと報告すること。
- 他browser対応上限の推測、installed Skill、親released化。

## 実装手順

1. 既存report consumerを確認し、最小の加算的schemaで系列を区別する。
2. uasmBytesとusedJSHeapSizeを別系列として扱う。sample単位fallbackで混ぜない。
3. 各系列はfiniteかつ非負byte値だけ採用する。
4. baseline/peakSampled/afterCancel/afterSettleは同じ系列から取る。
5. 片方しかない場合も計測名を正確に保持し、他方はunavailableとする。
6. 両方ある場合は別resultとして示し、1つの総peakへ合算しない。
7. case windowと既存3000 msのsettle観測方針は維持する。
8. window内sampleなし、cancel後sampleなしをnull+理由で残す。
9. intervalMsとsample countを記録し、periodic sampled maxであると表示する。
10. 既存report形状を壊す必要があれば勝手にversion上書きせず、移行案をrootへ先に報告。
11. token/接続codeはreportへ絶対に含めない。

## 数値付き受入

- 同じwindow内にUASM 1000/1200 bytes、JS heap 200/300 bytesの混在fixtureを作る。
- UASM peakは1200 bytes、heap peakは300 bytesで、1200+300や混在最大を総RAMとしない。
- UASM欠測sampleがheapへ置換されない。
- NaN/Infinity/-1 bytesは測定値として採用しない。
- baseline・cancel後の値もsourceが同じである。
- interval=1000 msのsampleを1 ms間隔の真のpeakと記述しない。
- memory unavailableでも既存elapsedMs/cancel latencyの成功測定を壊さない。
- 元report/probeを改変する仕様かcloneかを既存契約に合わせ明記する。

## テスト

```text
node --test tests/perf-browser.test.mjs tests/perf-measure.test.mjs
```

fake clockで混在/欠測/window境界/cancel後欠測を検証する。
本依頼のために巨大CAEやfulltestを何度も回さない。

## 実Chromeの限定確認

利用可能ならno-HMRで既存structural-tinyの1例を1回測る。
既存--print-probeの手順を使い、利用可能なメモリAPIと欠測理由を記録する。
UASM不可ならJS heapだけの観察として保存する。API名を偽装しない。
利用者の手動背景録画待ちを再依頼しない。
実機不可ならreport修正とunitまでを納品し、メモリ実測は未完と書く。

## 停止・最終成果

report consumer不明/互換性破壊/secret混入なら停止して該当箇所を報告する。
reset/timeoutを見つけたら失敗を残し、原因やV8根治を断定しない。
最終成果は変更、混在fixture、系列ごとの算式/単位、test、実機可否、残条件。
PERF1はbuilding。全browser/対応上限/peak RAM保証は閉じず171/133/残38を維持する。
