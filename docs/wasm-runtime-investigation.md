# Node 24 / WASM 終了時クラッシュ調査

[English](en/wasm-runtime-investigation.md)

確認日: 2026-10-14。状態: 未解決。

全体試験のローカルログ `.qa/print-api-full.log` では、`tests/analysis-job-service.test.mjs` の最初の2試験成功後、`jit_page_->allocations_.erase(addr) == 1` のV8 fatal CHECKで試験プロセスが終了した。スタックに `ThreadIsolation::UnregisterWasmAllocation` がある。3番目は取消・期限切れ・成果物制限の試験だが、直接の引き金は未特定。他ファイルも並列実行されていた。

Windows x64、Node `v24.11.1`、V8 `13.6.233.10-node.28` で対象だけを新規子プロセスで逐次12回実行し、各3試験、計36試験成功、全終了コード0、stderrは空。所要時間1612〜1710 ms/プロセス。単独で非再現という証拠であり、並列条件の安全性や修正完了を証明しない。

ソース基準Git HEAD: `169404828cfc8eb36d382be600516c009a4549d6`。対象内容は下表SHA-256で照合できる。

原因候補: headless-analysis.mjsのfinishは `worker.terminate()` 完了を待たずPromiseを確定するため、次のジョブと前のisolate終了が重なり得る。analysis-jobs.jsの取消・期限切れもAbortSignalで同経路を使う。重なりが必要条件か、終了待機だけで改善するかは未検証。

一次資料（2026-10-14確認）:

- [Node issue #66366](https://github.com/nodejs/node/issues/66366): Node 24/V8 13.6、worker終了とWASMコードGCで同一CHECKを報告。Linux環境であり、本件Windowsとは異なる。
- [V8公式修正 9b8ca54d5a](https://github.com/v8/v8/commit/9b8ca54d5a): 解放予定wrapperの参照更新が他スレッドのコードGCと競合し二重解放し得る問題を修正。

同一CHECK・V8系列・終了経路は整合する有力候補だが、本件との同一性は未確定。別bundled runtimeもNode `v24.19.0` / V8 `13.6.233.17-node.51` で修正系列の対照には未使用。この調査では機能、ソルバー、許容差、実運用起動フラグを変更していない。

再実行はリポジトリ直下で下記を実行し、新しい出力名を指定する。スクリプトは1〜100回逐次、新規Node子プロセスで `node --test tests/analysis-job-service.test.mjs` を実行。標準入力なし、1回30秒、各出力ストリーム1,000,000 bytes制限、異常時停止。runtime/Git HEAD/source SHA/終了コード/signal/stderrを排他的新規JSONへ保存する。元の12回は同対象コマンドの逐次反復だった。

スクリプト自体は追加後に1回実行し、3試験成功、終了コード0、fatalなしを確認した。ただし並行作業でsrc/analysis-jobs.jsが変更され、その追加1回のSHAは `ad3ca3718d9bcdc043e032bc112d25058b1663293c27745c9a041fc4200c1a02`。他4ファイルは下表と一致。追加1回を元の12回と同一条件として合算しない。

次は上流修正を含むruntimeを同一ソース・ハードウェア・対象・反復数で比較する。単独と元の全体並列条件を別記録し、終了待機変更も独立比較する。`--no-wasm-code-gc` は切分け候補に留め、メモリ/性能影響と不具合隠蔽を評価せず恒久採用しない。数値許容差の緩和や試験除外で成功扱いにしない。

```powershell
node scripts/reproduce-wasm-runtime.mjs 12 .qa/wasm-runtime-new.json
```


| File | SHA-256 (12-process experiment) |
| --- | --- |
| `scripts/headless-analysis.mjs` | `fcba38379837fd6453337533fe5375bb67f38a456288ed6f8285fafc62686b27` |
| `scripts/headless-worker.mjs` | `93eedf9ea28b2173e6896bbf33d5a75940b8c412ee908bd86d18042984f7002c` |
| `scripts/analysis-job-service.mjs` | `31e13dda192136982e8f0970f7dc546dd0d8c9c6d944dbb3bbf90b329d8aff30` |
| `src/analysis-jobs.js` | `7ca4bc24d58005e7dc5d3c63b8b03e44965d2df36faffc18b9ca96e7f8b7f16e` |
| `tests/analysis-job-service.test.mjs` | `b6c778d514b3ec8d8abd0cea7143397f6197294dabf6c391cd789fac9c963b30` |
