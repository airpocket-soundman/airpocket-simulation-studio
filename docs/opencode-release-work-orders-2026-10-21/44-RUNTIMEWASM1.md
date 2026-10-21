# 44 RUNTIMEWASM1 — 実Linux比較を完了し未解決fatalを切り分ける

先に [共通手順](00-COMMON.md) を読む。小さなPRは中間成果であり、下記の親タスク完了条件まで継続する。外部条件だけは未実施として明示する。

## 現状と今回の出口
- checking。Windows smokeと再試行成功はあるが、既定Node24の複数fatalの原因同一性・Linux軽減効果は未確定。
- 今回は既存の手動Linux比較workflowを固定sourceで実行し、既定/明示no-wasm-code-gcの原結果を保存する。
- 再試行成功を根治にせず、既定Node/CI flagsを勝手に変更しない。

## 作業場所と読むもの
- origin/mainから専用branch/worktree。主作業フォルダ/他担当を保護。追加ダウンロード前に既存runtime/cacheを調べる。
- `docs/wasm-runtime-investigation.md`、`docs/testing.md`、`docs/evidence/2026-10-18-runtime-jit-failure.json`を読む。
- `scripts/reproduce-wasm-runtime.mjs`、`scripts/compare-wasm-runtime.mjs`、`scripts/wasm-runtime-provenance.mjs`、`.github/workflows/wasm-runtime-diagnostic.yml`を確認する。

## 実行・修正手順
1. 比較sourceSHAを固定し、workflow ref/Node実版/OS/arch、既存fatalの署名を記録する。
2. 手動workflowのtarget=analysis-jobs、iterations=1で既定/disabled両modeを実行する。CI成果物をダウンロードし、両方の生ログ/終了状態/timeoutを読む。
3. 同じsourceのmaterial-catalogも1反復で比較する。追加反復は差異/再現の必要性がある場合だけ最大3まで。
4. `erase(addr)`と`jit_page.has_value()`を別署名として集計し、通常のassertion/timeout/signalと区別する。
5. mode切替で入力・対象試験・並列数が変わっていないことを確認する。片方の欠落を0fatalと数えない。
6. 再現したら最小の実Worker/WASM終了列を切り出し、job settlement/terminate待機/参照寿命を記録する。全体suiteの無限反復は禁止。
7. 調査器に欠落があれば報告/回帰試験を修正する。fatalをcatchして成功に変換したり、失敗試験をskipしない。
8. Node/V8上流状況を更新する場合は公式issue/commit/changelogを実際に確認し、版と修正包含を引用する。古い予定を現在の事実として転記しない。

## 試験と証拠
- `node --test tests/reproduce-wasm-runtime.test.mjs tests/compare-wasm-runtime.test.mjs tests/wasm-runtime-provenance.test.mjs`
- local限定比較例: `node scripts/compare-wasm-runtime.mjs 1 .qa/runtime-comparison.json --target=analysis-jobs --concurrency=4`
- JSON証拠にsourceSHA、runURL、Node/OS、mode、対象/反復数、試験成功/失敗/skip、fatal署名、終了code/signal、timeoutとログSHAを含める。
- workflow成果物が消える前に必要な短い診断と生ログ識別を保存し、token/環境秘密を含めない。

## 提出・判定
- 実比較結果と日英調査docsをPRへ。修正があれば失敗→修正後の同条件比較を添える。
- 非再現だけならchecking維持。軽減と根治を区別し、原原因一致と修正包含の証拠なしにreleasedへ変更しない。
- 既定runtime/CI flag変更が必要なら比較根拠を別の具体的変更として提示し、レビュー担当の判断を待つ。自己merge・force pushは禁止。
