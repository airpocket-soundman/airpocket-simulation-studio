# Node 24 / WASM 終了時クラッシュ調査

[English](en/wasm-runtime-investigation.md)

確認日: 2026-10-14。状態: 未解決。

全体試験のローカルログ `.qa/print-api-full.log` では、`tests/analysis-job-service.test.mjs` の最初の2試験成功後、`jit_page_->allocations_.erase(addr) == 1` のV8 fatal CHECKで試験プロセスが終了した。スタックに `ThreadIsolation::UnregisterWasmAllocation` がある。3番目は取消・期限切れ・成果物制限の試験だが、直接の引き金は未特定。他ファイルも並列実行されていた。

Windows x64、Node `v24.11.1`、V8 `13.6.233.10-node.28` で対象だけを新規子プロセスで逐次12回実行し、各3試験、計36試験成功、全終了コード0、stderrは空。所要時間1612〜1710 ms/プロセス。単独で非再現という証拠であり、並列条件の安全性や修正完了を証明しない。

ソース基準Git HEAD: `169404828cfc8eb36d382be600516c009a4549d6`。対象内容は下表SHA-256で照合できる。

当初の原因候補（後述の所有権修正前）: headless-analysis.mjsのfinishは `worker.terminate()` 完了を待たずPromiseを確定するため、次のジョブと前のisolate終了が重なり得る。analysis-jobs.jsの取消・期限切れもAbortSignalで同経路を使う。重なりが必要条件か、終了待機だけで改善するかは未検証。

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

### 2026-10-14: v2 bundle検証中のV8停止再発

全体初回試験は518件中514成功・1失敗・3スキップ（68.639秒）。Node v24.11.1/V8で既知の`jit_page_->allocations_.erase(addr) == 1` Fatal errorが再発し、`tests/material-catalog.test.mjs`のプロセスが失敗した。同じファイルの単独再実行は7件成功（2.945秒）。単独成功は原因解決を意味せず、RUNTIMEWASM1は未解決のまま。

[再発の機械可読証拠](evidence/2026-10-14-wasm-material-catalog-failure.json)へトレース、Node/V8環境、ソースハッシュ、初回結果と単独再実行を保存した。保存証拠の全体再試行は523件中520成功・3スキップ・失敗0（68.229秒）、配信物26項目成功（28.44秒）。初回失敗を置き換える原因解決の証拠ではなく、併記する。

## 診断CLIとWorker終了所有権の更新

`node scripts/reproduce-wasm-runtime.mjs <1..100> <新規出力.json> [--target=analysis-jobs|material-catalog|full] [--concurrency=1..4] [--runtime=<Node実行ファイル絶対パス>]`で同じソースを別Nodeから比較できる。既定targetはanalysis-jobs、runtimeは親Node、並列数省略時はNode既定。fullはtests直下の.test.mjsを列挙し、1回180秒（他target30秒）、各出力ストリーム1,000,000バイトで打ち切る。異常時は以降の反復を止める。出力は排他的に新規作成し、各反復の前後で同期チェックポイントを保存する。親/子Node・V8・実行引数・Git dirty一覧・対象試験・ソース/WASMハッシュ・fingerprint・stdout/stderr・終了コード・signal・fatal検出を記録。NODE_OPTIONSは存在とハッシュのみ記録し、値を公開しない。

headlessの完了Promiseは`worker.terminate()`が完了するまで成功/失敗を確定しないよう修正。正常完了・取消・期限切れを含む資源所有権の修正で、V8自体の修正ではない。共有ジョブのcancel状態は先にterminalになるため、全ジョブがterminalなら全Worker解放済みとは限らない。

公式タグの[Node v24.11.1](https://raw.githubusercontent.com/nodejs/node/v24.11.1/deps/v8/src/wasm/wasm-import-wrapper-cache.cc)と[v24.19.0](https://raw.githubusercontent.com/nodejs/node/v24.19.0/deps/v8/src/wasm/wasm-import-wrapper-cache.cc)はMaybeGetの旧AddRef→is_dying順序を維持する。したがって同梱v24.19.0は修正済み対照ではない。[Node v26.10.0リリース](https://nodejs.org/en/blog/release/v26.10.0)の公式タグには[V8のatomic参照管理](https://raw.githubusercontent.com/nodejs/node/v26.10.0/deps/v8/src/wasm/wasm-code-manager.h)と後継wrapper cacheがある。修正内容の包含と当アプリの原因一致は別で、後者は未証明。

比較用に公式portable Node v26.10.0 / V8 14.6.202.34-node.34を.qa内だけに取得。node.exeのSHA-256 `cea6ac365f9bb9586dafd2084d996e092e7d3e7d07ab52d1f76bf53d1fca9bc4`は公式SHASUMSと一致した。グローバルPATHやNodeインストールは変更していない。凍結ソースの比較結果は下記に記録する。非再現でも根治を証明しない。

## 2026-10-14: 所有権修正後の同一ソース比較結果

sourceFingerprintは`f5baf41cf567a5adb08d84229b84a44f2c0018abb1dfff2aa88d6e863594b595`。同じ128試験ファイル、並列数4で各Nodeを2新規プロセス実行した。Node v24.11.1は各541件中538成功・3スキップ・失敗0（壁時計68,083/69,192 ms、試験時間67,986.382/69,098.2428 ms）。Node v26.10.0も同じ件数で全成功（壁時計163,283/161,887 ms、試験時間161,603.2054/160,084.9643 ms）。全4回で既知native fatalは再現しなかった。

全比較はWorker所有権修正後で、修正前の同条件全体対照はない。Node26が遅かったのは今回の観測で、コールドスタート・セキュリティ・キャッシュを制御しておらず製品性能ベンチマークではない。特定V8修正や所有権修正が停止を根治した因果証明にもならない。既定Nodeは変更せず、RUNTIMEWASM1は未解決を維持する。

[比較要約](evidence/2026-10-14-runtime-comparison.json)、[Node24全記録](evidence/2026-10-14-runtime-node24-full.json)、[Node26全記録](evidence/2026-10-14-runtime-node26-full.json)を保存。[FakeWorkerによる修正前後比較](evidence/2026-10-14-headless-worker-ownership.json)は旧settledBeforeExit:true、新false、terminateCallsは両者1で、終了待機の資源契約を決定論的に示す。native WASM停止の再現試験ではない。

新規のライフサイクル12件と診断CLI6件の計18件、および実処理を含む関連10件が成功。ビルド・ローカル配信物26項目（27.87秒）・SKILL検証成功。
