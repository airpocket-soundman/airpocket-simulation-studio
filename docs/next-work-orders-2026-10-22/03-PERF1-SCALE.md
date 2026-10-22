# 03 PERF1 — 単一ケースから規模比較へ進める

状態: 2規模の実Chrome計測を実行し、[実結果と残条件](../perf-scale-2026-10-22.md)を保存済み。#174の実Chrome1ケースを再実装しない。レビュー後に最新mainから `D:/worktrees/studio-perf-scale-20261022` を作る。

前提修正を2026-10-22に実装: probeのUASM要求をinflight排他し、`tRequested`/`tResolved`を記録する。stop後の未完測定は破棄する。UASMの要求〜完了が境界を跨ぐsampleをbaseline/解析中のpeakへ分類しない。旧probeは要求時刻のみで非同期完了時刻不明と表示し、#174の歴史測定の精度を事後に増やしたとはしない。VMで実snippetの遅延・失敗・停止とmergeの境界分類を試験する。

この修正と、以下の複数規模の実Chrome計測は別。複数規模計測は追加実行済み。03の限定計測を満たしてもPERF1の最大対応規模・他ブラウザの受入は未完。

1. `docs/opencode-review-followups-2026-10-21/48-PERF1.md`、`scripts/perf-browser.mjs`、`scripts/perf-measure.mjs`と#174の証拠を読む。
2. #174の成功したstructural-tinyと同じ合成形状/材料/支持/荷重で、節点/要素数が異なるもう1つの小規模meshを用意する。事前に要素/節点上限、1回の時間上限、1回ずつのみの比較を固定する。形状変更とmesh規模変更を混ぜない。
3. 凍結sourceのowned localhostを実Chromeで開く。正式stdio pairingと現行probeを使い、probe版、sourceSHA、origin、Chrome版、実節点/要素数を保存する。
4. 同一ブラウザ条件で旧サイズ/新サイズを各1回実行し、解析時間、観測メモリ、終了後3000ms以上のsampleを得る。UASMとJS heapは別系列で扱い、利用不能をnull+reasonとする。実測系列がなければ受入未完。
5. raw report/probeを保持し、sanitizeした参照または秘密を含まない再実行スクリプトをcommitする。token、pairing code、全環境変数は保存しない。
6. `node --test tests/perf-browser.test.mjs tests/perf-measure.test.mjs`。owned probe timer/接続/serverのみcleanupする。

出口: 2規模の実測値とモデル/mesh識別、未測定のGPU/RSSなどの限界、失敗も記録してレビューへ。2点だけから対応最大モデル規模や一般的なスケーリング則を保証せずPERF1の残条件を更新する。

独立監査で、tinyの3秒後sampleが後続mediumと重なること、および正規化後browser入力全snapshot未保存を残条件へ追加。次回はcase間idle待ち・明示snapshotで補完する。今回の2規模の計算/取消/実mesh数と独立heap修正の証拠は保持し、単独idleメモリの証明に拡大しない。
