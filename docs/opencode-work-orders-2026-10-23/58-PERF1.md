# 58 PERF1 — case間のidleと正規化入力を固定して性能を測る

## 開始条件

[共通指示](00-COMMON.md)を先に読む。基準main `fe98ca3e60b4f5dfd65c02f00b33b0f76059e9cb`。この1作業だけを実行し、親全体の完成とは区別する。

## 前提と読む順

なし。重い測定は57/59/60/62と直列実行。

1. `scripts/perf-browser.mjs`
2. `tests/perf-browser.test.mjs`
3. `docs/perf-scale-2026-10-22.md`
4. `docs/evidence/2026-10-22-perf-scale.json`

## 実装・検証手順

1. 既存2規模の合成入力を同じ実Chromeで再測定する。caseごとに正規exportProject snapshot/hash、実要素/節点数、job/result版を取得する。
2. cold/warm各1回、取消後の復旧とcase終了後3秒以上のidle観測を確保し、その間は別caseを走らせない。JS heap/UASMを別系列・別時刻で記録する。
3. 既存の遅いUASMでheap tickが止まらない性質を保持する。より大きい規模は事前に時間/要素/メモリ予算を決め1規模だけ追加し、上限超過で打切る。

## 受け入れ条件

各caseの実行区間とidle区間が重ならず、区間外sampleを区間内peakへ混ぜない。未観測系列はnull/理由付き。観測最大を真のpeak/RSSと呼ばず、少数試行から性能限界を断定しない。

## 対象試験

```text
node --test tests/perf-browser.test.mjs tests/perf-measure.test.mjs
```

新しい振る舞いには対応するfocused回帰を追加し、共通の型・差分検査も行う。上の試験の成功だけで実ブラウザ・native・公開・一般物理精度の合格にはしない。

## 境界と納品

仕様不足・参照不一致・非有限値・他者変更との競合は原因を記録し、関係する変更を止める。外部条件不足は未実施として残す。証拠JSON、実測と期待値、変更一覧、未確認、残る親受入をPRに添える。共通進捗は71担当へ更新案を渡し、この作業だけで親をreleasedへ進めない。
