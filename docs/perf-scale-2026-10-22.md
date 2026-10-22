# Chromeの2規模計測とprobe修正

[English](en/perf-scale-2026-10-22.md)

固定source `1ae8dcf8f58177b65e91900f00b79aa453c4307d`、実Chrome 155のlocalhostで、同じ10×10×40mm、E=1e9Pa、nu=0、z0固定、z40へ+Z100Nの合成入力を正式MCPのinspect/analyzeだけで実行した。各規模cold/warm各1回、2種類の取消と取消後復旧を確認した。

| mesh size | 節点 / Tet4要素 | cold ms | warm ms | JS heap観測最大bytes |
|---|---:|---:|---:|---:|
| 8mm | 60 / 121 | 1809.459 | 1624.154 | 33,255,669 |
| 3mm | 335 / 1006 | 1543.110 | 1686.913 | 32,461,135 |

要素数は正規jobStatusの実結果で、要求sizeから推定していない。同じ節点数が同じメッシュを保証するとはしない。job/input識別は残るが、compact summaryにmesh内容hashはなくmeshRevisionはnull。

最初の試行で、遅いUASMのawaitが同期JS heapのtickまで抑止し、小規模case内のsampleがなくなる実問題を観測した。probeを修正し、JS heapは各tick、UASMだけ排他とした。各系列は別sample・別時刻で記録する。修正後は57sampleを回収した。小規模UASMの区間内sampleはないため未観測を維持。中規模UASMの観測最大は53,933,349bytes（区間内1sample）。系列を加算せず、真のpeak/RSS/GPUメモリと呼ばない。取消・終了後3000ms以上のheap sampleも保持した。

[実記録](evidence/2026-10-22-perf-scale.json)と[raw/初回試行/再現helper](evidence/perf-scale-20261022)を保存した。1回だけの比較で最大規模やスケーリング則を推定しない。他ブラウザ・公開HTTPS・新しい時刻manifestの実Chrome検証は未実施。

再現は専用worktreeを上記sourceへ固定し、`replay/`の4ファイルと`input.json`を`.qa/perf-scale-v2/`へコピーする。Viteを127.0.0.1:18444で起動し、`node .qa/perf-scale-v2/driver.mjs`を実行。所有Chromeで`/.qa/perf-scale-v2/perf.html?lang=en`を開き、合成入力読込、probe開始、接続欄でinspect/analyzeだけを明示許可する。driverの一時pairingファイルは入力後削除し、URL・証拠・commitへ入れない。完了後3000ms以上のsampleを確保してStop probeからJSONを回収し、現行mergeMemoryで結合する。probe・所有タブ・MCP・Viteを終了する。今回これらの終了を確認した。

