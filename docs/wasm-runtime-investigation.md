# Node 24 / WASM 終了時クラッシュ調査

[English](en/wasm-runtime-investigation.md)

## 2026-10-21: 固定Linux比較の完了（非再現・未解決）

公開済みsource `56576af6bd26d510c3166edf69c1cd73ffcb9703` を指す既存注釈タグ `release-56576af6bd26d510c3166edf69c1cd73ffcb9703` から、手動workflowを対象ごとに1回実行しました。各runのhead SHAも同じです。実環境はLinux x64 / Node **v24.22.0** / V8 **13.6.233.17-node.57**。workflow指定は `ubuntu-latest` と `node-version: 24` で、固定Node版の設定に変更していません。

| 対象 | mode | 反復 | 成功/失敗/skip | 試験子プロセス ms | exit / signal |
| --- | --- | --- | --- | --- | --- |
| analysis-jobs | default | 1 | 8 / 0 / 0 | 3627 | 0 / null |
| analysis-jobs | disabled | 1 | 8 / 0 / 0 | 3754 | 0 / null |
| material-catalog | default | 1 | 7 / 0 / 0 | 3953 | 0 / null |
| material-catalog | disabled | 1 | 7 / 0 / 0 | 3788 | 0 / null |

[analysis-jobs run 39543750219](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39543750219) と [material-catalog run 39543753492](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39543753492) は成功。全cellで30秒期限・出力制限・取消・signalによる停止はなく、`allocations_.erase(addr)` と `jit_page.has_value()` の検出はそれぞれ0件でした。各pairは並列数4、同じ対象試験、269件のsource hash、16件の解決済み資産、Node binary hashが一致しています。argvの差はdisabled側の明示 `--no-wasm-code-gc` だけです。

[比較要約と受入判定](evidence/2026-10-21-runtime-linux-comparison.json) に環境、source/runtime指紋、各modeのexit・signal・timeout・試験件数・stdout/stderrのSHAを保存しました。[ダウンロード原本](evidence/2026-10-21-runtime-linux-raw/) はrunごとの比較JSONとdefault/disabled各JSONを変更せず保存し、stdout/stderrを内包します。GitHub artifactは14日保持なので、原本ファイルのbyte数/SHAも要約に記録しています。

引継ぎ後のdispatchで、停止前に成功していた [material-catalog run 39542239219](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39542239219) を発見しました。これは同sourceでもNode **v24.21.0** / V8 **13.6.233.17-node.53**、default/disabled各7件成功の別履歴です。今回の24.22.0の30試験へ合算せず、原本と実runtimeを別記しました。新規実行は指定の2runだけで、差異・再現が出なかったため追加反復はしていません。

**RUNTIMEWASM1はcheckingのままです。** 4cellの非再現は軽減効果、停止原因の同一性、特定上流修正の包含、安全性を証明しません。default→disabledの順序、単発実行、CI host負荷を制御した性能比較ではなく、RSS・メモリ増加も未測定です。`NODE_OPTIONS`は診断子から除去していますが、別spawn processへのflag伝播と全子孫process終了は未証明です。close確認の対象は所有する診断runnerです。

製品source・数値許容差・通常CI・既定runtime/flag・進捗状態を変更する根拠は得られませんでした。次の自然発生fatalを固定source/runtimeとWorker終了直前の所有権checkpoint付きで捕捉し、2署名を分離して最小終了列へ落とす条件が残ります。再現差が得られた時だけ理由付きの有界追加比較を検討します。下の上流issue/backportに関する記述は過去の日付の調査記録で、今回その現在状態を再照合していません。

ローカルでは既存WASM資産を読取り再利用し、新たなruntime取得・native build・全体suite・Chrome作業を行わず、診断器の対象試験15件と契約型5ファイルを確認しました。Fake/stubによる終了制御試験はnative fatalの再現試験とは別です。

## 2026-10-18: 有界な比較診断

PR122の初回Linux/Node24.21.0全体検証で `Check failed: jit_page.has_value()` が発生し、同じソースの再実行は成功しました。従来のallocation-erase署名とは分離して記録し、同じ原因とも根治済みとも扱いません。

`node scripts/compare-wasm-runtime.mjs 1 .qa/new-comparison.json --target=analysis-jobs --concurrency=4` は、同じruntime/source/対象で既定と明示 `--no-wasm-code-gc` を順に比較します。新規出力のみ、通常対象は各最大3反復、全体対象は各1反復です。Linux用の手動workflow `WASM runtime diagnostic comparison` でも実行できます。通常テストと製品の起動設定は変更しません。診断子プロセスから `NODE_OPTIONS` を除去し、別途spawnされたプロセスへのフラグ伝播は保証しません。

中断・期限切れは所有する直接の子へ終了要求を送り、猶予後の強制終了とclose確認にも上限を設けます。子孫プロセス全体の終了は保証せず、close未確認は失敗として比較を止めます。[Windows単発smoke](evidence/2026-10-18-runtime-comparison-smoke.json)は両設定で完了しましたが、Linux再現・軽減効果・メモリ影響の証明ではありません。終了制御の変更後経路は単体テストで検証しました。RUNTIMEWASM1は未完です。

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

JOBSETTLEMENT1で、共有ジョブのterminal先行とは別にexecutionSettled/resourceStateとresource-stateイベントでexecuteチェーンの終了を追跡する契約を実装済み。解放はterminalかつ実行終了時のみで、drainは現在pendingのみを待つ。資源所有権の契約が整っても、V8根治は証明しない。

状態名はpending/settled、解放可否はreleaseAllowedへ精密化。executorの自己cleanup後のPromise確定を追跡し、ブラウザvoid terminateのOS終了を主張しない。終端後rejectはexecutionErrorへ別記するが通常Abortとcleanup異常を区別しない。同期close互換を維持し、drain/closeAsync・正常MCP EOFは終了待機する契約。

## 2026-10-14: 観測プロファイル試験での修正後再発

HEAD f7a2ea8を基準とする今回の初回全体試験は584件中580成功・1失敗・3スキップ（70,927.9791 ms）。Node v24.11.1/V8既存環境で、新しいMCP観測プロファイル試験のMCP子プロセスが終了コード2147483651となり、`jit_page_->allocations_.erase(addr) == 1`と`UnregisterWasmAllocation`を再び記録した。[追跡証拠](evidence/2026-10-14-observation-profiles-v8-failure.json)を保存した。

これはWorker終了所有権とsettlement修正後にも発生した独立した再発証拠で、根本解決は未証明のまま。単独再実行は1試験・実ジョブ7件を3,715.4345 msで成功したが、これで初回停止を取り消さない。同じソースの全体再試行は584件中581成功・3スキップ（71,435.0784 ms）。記録した8ソースのSHAも一致する。追加の観測照合だけを既存Worker試験へ組み込んだ最終回帰試験は別途記録する。RUNTIMEWASM1は未解決を維持する。

観測照合を既存Worker試験3ファイルへ追加した後の最終Node24実行でも、既存`analysis-job-service.test.mjs`が同じfatalで停止した。報告件数は583件中579成功・1失敗・3スキップ（70,992.8209 ms）。途中プロセス停止により通常の全体件数より減っており、試験を削減した結果ではない。productionソースはこの再実行のために変更していない。同ファイルの単独再試行3件は1,660.2976 msで成功したが、再現性と根本原因は未解決。

既存[再発証拠](evidence/2026-10-14-observation-profiles-v8-failure.json)のfinalCoverageRunへ2回目の失敗を追記した。公式QA portable Node26.10.0の最終ソース全体比較は584件中581成功・3スキップ、V8fatalなし（試験175,036.3216 ms、壁時計176,762 ms）。[生記録](evidence/2026-10-14-observation-profiles-node26-full.json)と、追加helperを含む照合済みソースSHAを保存した。これは性能ベンチマークや上流修正との原因一致の証明ではない。既定Nodeは変更しない。比較や再試行が成功しても、Node24で観測した失敗や原因未解決を取り消さない。

MCPのstudio_capabilities/diagnose_execution/preflight_projectのruntimeから、node/v8/platform/archの機械報告と既知実測環境への警告を取得できる。完全一致だけobserved-risk、他はnot-assessedで、根治・互換性の保証ではない。純studioApiのportable能力とは分離する。

## 2026-10-15: 上流確認と任意プロセス分離の範囲

確認日2026-10-15。[Node公式issue66366](https://github.com/nodejs/node/issues/66366)は類似のWASM wrapper解放競合を報告し、[V8公式9b8ca54d5a](https://github.com/v8/v8/commit/9b8ca54d5a)はdying wrapperの参照追加をatomicに扱う修正を説明する。[Node v24.22.0公式ソース](https://raw.githubusercontent.com/nodejs/node/v24.22.0/deps/v8/src/wasm/wasm-import-wrapper-cache.cc)のMaybeGetはAddRef後にis_dyingを調べる順序のまま。これはソース上の事実で、本リポジトリの全fatalが同じ根本原因という同定は仮説である。過去の別runtime成功や単独成功を原因解決と読み替えない。

任意のMCP起動`--analysis-isolation=process`は同じNode子プロセス内へ解析を分け、子の異常終了時もホストを維持する失敗封じ込めを追加する。既定workerは変更せず、再試行・runtime自動切替・任意実行ファイルのwire指定は行わない。runtime-failureの有界stderr/hashを確認し、process close後の資源終了を待つ。最終検証は[試験記録](testing.md)と[実行証跡](evidence/2026-10-15-process-isolation-full.json)を参照。V8根治や全モデル互換性の証明ではない。

この経路のruntime-failureはcode:ANALYSIS_PROCESS_EXITを返します。検証に使うcontrolled exit86は実V8 fatalの再現ではなく、根治の証拠でもありません。親disconnect時の子終了はbest effortで、同期native処理によりハンドラが遅れる場合があります。

## 2026-10-15: Linux配信物検査での再発と分離範囲

main `badce2c0704385616af5c2dcc76898df85f833cb` の[公開CI run 38663202965](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/38663202965)は、LinuxのNode v24.21.0で全体テスト・ビルドを通過した後、`check-published --local`がexit 133で停止した。22件の名前付き検査が成功し、`project-and-case-roundtrips`の後に`jit_page_->allocations_.erase(addr) == 1`と`UnregisterWasmAllocation`を記録した。26項目全体の成功・公開反映の成功とは扱わない。

直後の検査は検証親プロセス自身でGmshを初期化し、STEP参照を生成する既存経路である。後続のCAD更新参照生成にも同じ親内初期化があった。停止時刻とこの順序は観測事実であり、どのインスタンス解放や処理が原因かは未同定である。[Node公式issue 66366](https://github.com/nodejs/node/issues/66366)の類似報告と上流V8修正候補は比較根拠であり、本アプリの原因を証明しない。最新24系への更新や過去のNode26成功だけで修正済みとはしない。

今回の検証方針は、同じNode実行ファイルで配信済みのハッシュ照合済みanalysis/CADモジュールを子プロセスで実行し、STEP参照生成も子へ分けること。元の26検査・数値許容差・保存復元の判定を維持する。Node版変更、GC無効化フラグ、検査省略、自動再試行・自動フォールバックは採用しない。子の結果受信だけで成功を確定せず、closeまで待ち、非零終了・シグナル・結果後の異常も失敗として保持する。

各検査と子実行の開始・終了をチェックポイントへ記録し、通常のJavaScript例外で捕捉できない停止でも直前までの証跡を残す。実子の制御失敗試験は、親の維持・異常終了伝達・保存判定の確認であり、V8 fatalの再現試験ではない。完全な配信物検査、実行時Node/V8/platform/arch、子実行方式と失敗記録は今回の[試験記録](testing.md)を参照する。分離後の成功が得られても根本原因の解決とは区別する。

終了の判定範囲は、選択した配信モジュールの1回のhandler呼出しと、その返却Promise・子processのcloseまでである。closeまでに観測した異常終了は拒否するが、handler終了後に任意の遅延で予定された追加処理や、自然なV8終了時の全cleanupを検証する契約ではない。任意の1 tick待機を追加して将来のエラーを検査済みとはしない。[Node v24.21.0公式close仕様](https://github.com/nodejs/node/blob/v24.21.0/doc/api/child_process.md#event-close)は、終了後またはspawn失敗error後のcloseを保証している。error後のexitが非保証である点とは区別し、errorを保存してcloseまで待つ。

## 2026-10-16: 最小の単独再現器と固定条件マトリクス（非再現）

`scripts/repro-v8-wasm-terminate.mjs`（依存なし）は、上流[Node issue 66366](https://github.com/nodejs/node/issues/66366)の報告トリガー（メイン・worker_threads双方でwasmをinstantiateし、ホットループでtier-upさせ、workerを短いランダム遅延で`terminate()`）を、wabtで手組みした小wasm（import関数呼出し＋メモリ書込みループ）と実カーネル`public/fem-kernel.wasm`（スタブimport、instantiateのみ）で繰り返す。メモリはshared（`{initial:1,maximum:1,shared:true}`をメイン・workerで共有）とnon-sharedを切替。1セル=複数子プロセス並列×反復、各子で1反復2 worker。終了コード・signal・stderrのFatal/Check failed/`allocations_.erase`/`UnregisterWasmAllocation`を判定し、スクリプト自体のエラー（終了コード1でV8署名なし）は`harnessErrors`として区別する。

```powershell
node scripts/repro-v8-wasm-terminate.mjs --children=2 --iterations=50 --shared=1 [--module=tiny|kernel] [--flags="--no-wasm-code-gc"]
node scripts/repro-v8-wasm-terminate.mjs --matrix --cell-seconds=150 --output=<新規.json>
```

結果（[docs/evidence/2026-10-16-v8-wasm-repro-matrix.json](evidence/2026-10-16-v8-wasm-repro-matrix.json)）: Node v24.11.1 / V8 13.6.233.10-node.28、Windows x64、Intel i5-9500 6コア、5子プロセス並列×各セル150秒。7セル（non-shared既定、shared既定、shared+`--no-wasm-code-gc`、shared+`--liftoff-only`、shared+`--no-wasm-tier-up`、non-shared+`--no-wasm-code-gc`、実カーネルnon-shared）で合計約108,500反復（14,028〜17,458/セル）、クラッシュ0、終了コードは全て0。**全セルとも「約1.4〜1.7万反復では再現せず」であり、修正済み・安全の証明ではない。** 本件fatalが既存試験の長いプロセス（大きなコード量・コードGC圧・多数のisolate）で出ていた点、Windows固有か、上流報告のLinux/メモリ圧との差を、この小さなモジュールでは再現できていない。したがって上流トリガーとの一致は未確認で、fatalの原因（wrapper cache競合）も本実験では検証されていない。`--no-wasm-code-gc`等の差も、全セルが0件のため比較不能。RUNTIMEWASM1は未解決を維持する。次の候補は、実カーネルでのホットループ呼出し、大きなコード量によるコードGC圧、全体試験と同規模のisolate数・並列数での反復。

### 2026-10-16 クラッシュ切り分け（[docs/evidence/2026-10-16-v8-crash-isolation.json](evidence/2026-10-16-v8-crash-isolation.json)）

上流 nodejs/node#66366 は未解決（open）で、修正のバックポートPR #66376 も v24.x-staging 向けに open のまま未マージ。v24.22.0（2026-10-14）の変更履歴に wrapper/is_dying 修正はなく、24.21.0/24.22.0 とも修正を含まない（取得日 2026-10-16）。コード側では、MCPサーバーの既定が worker_threads で、ジョブごとに Worker を生成し結果後に必ず `terminate()` する（`scripts/headless-analysis.mjs`）ため、1プロセス内で wasm を使う Worker の生成と terminate が繰り返される。上流のトリガーと形は一致するが、これはコード読解と上流報告に基づく仮説で、測定では確認していない。実測: Windows（他セッションと共有の高負荷環境）で、CIで落ちた5ファイルを3並列で各設定約330秒（Node 24.11.1 / 24.22.0 / 22.23.3 / 26.12.0 / 24.11.1+`--no-wasm-code-gc`）、計93回でV8 fatalは0件。発生率が1%未満では何も区別できず、設定間の優劣は言えない（ジョブ期限切れによる非V8の失敗は負荷の影響で比較不能）。推奨: 根本対応は#66376を含む24.xリリースへの更新。暫定策は別承認でのテスト実行時 `--no-wasm-code-gc`（上流報告で0件、メモリ増は未測定）。MCP/ジョブ試験を `--analysis-isolation=process` で動かす案は未測定。Linux CIでの再現と各案の比較は未実施。


### 2026-10-24 PR193のjob-store単独診断入口

[CI run39984626501](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39984626501/job/120520481503) のhead `2041bea` では、既存 `analysis-job-store.test.mjs` が先頭6試験成功後にファイル単位で終了しました（18,859.18 ms、全2116件中2107成功・1失敗・8skip）。保存されたspecログにはassertionのstack、子のexitCode/signal、V8 fatal/OOMの識別根拠がありません。次に宣言されている試験は保存なしの実解析ジョブ確認ですが、実際に呼び出された位置までは記録されていません。原因をV8/OOMや新機能の回帰と断定しません。当該試験・store/service・FEM・workerの6ファイルはPRのbaseとheadで同一blobです。

既存診断runnerとworkflowに固定target `analysis-job-store` を追加しました。`mode:single` なら既存の `node scripts/reproduce-wasm-runtime.mjs 1 .qa/wasm-single.json --target=analysis-job-store` がこの1ファイルだけを1回実行します。default Node flags/concurrency、TAP、exit/signal/timeout、cgroup前後の記録は維持し、比較modeも従来どおりです。共有cgroupのOOMカウンタはその子への原因帰属ではありません。試験本体・物理閾値・通常CI・既定Node/GCを変更せず、skipもしません。今回実行したのは選択/parser/stub回帰のみで、Linux診断・実solverの再実行は親担当として未実施です。[調査摘要と6blob](evidence/2026-10-24-ci193-jobstore-diagnostic.json)。
