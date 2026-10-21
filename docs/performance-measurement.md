# Node側の性能測定ハーネス (PERF1 / P2 第1スライス)

English: [en/performance-measurement.md](en/performance-measurement.md)

`scripts/perf-measure.mjs` は、リポジトリ内の代表モデルをNodeのWorker(WASM, CPU)で解析し、時間・メッシュ規模・ピークメモリをJSONで記録する。**測定値であり、対応規模の上限や性能保証ではない。** PERF1(ブラウザごとのメモリ・時間・中止応答の測定と上限表示)およびP2の性能測定は未完了であり、このハーネスだけでは完了にならない。

## 測定するもの

- ケース: 10x10x40 mmの直方体(ワーカーパイプラインのテストと同じ形状)を、構造(メッシュサイズ違いで複数)、定常熱、調和音響で解析する。`--list`で一覧を出す。
- 各ケースの節点数・要素数。
- 時間(ms): 全体、Worker起動からメッシュ生成開始まで、メッシュ生成、境界条件転送、解析段階、ソルバー本体(ソルバー報告の`solveMs`)、後処理(解析段階からソルバー本体を引いた残り。結果組立とメッセージ複製を含む)。段階境界はホスト側のイベント受信時刻から求めた近似である。
- 冷間と温間: ケースごとに専用の子プロセスを起動し、その最初の実行を冷間、続く`--repeats`回(既定3)を温間とする。温間は中央値・最小・最大を記録する。温間でも毎回新しいWorkerを起動する。
- ピークRSS: 子プロセスの`process.resourceUsage().maxRSS`(Node本体・Worker・WASMメモリを含むプロセス全体の最大値)。
- 中止応答(`cancel`ブロック、追加項目): 既定では`structural-medium`と`thermal-steady`、`--cancel`で選択した全ケースが対象(`--no-cancel`で無効)。専用の子プロセス内で、ウォームアップ後に中止なしの温間実行を測って基準時間とし、`analyzeProject`の`AbortSignal`で次の2点で中止を要求する: (1) 最初の進捗・観測イベント受信直後、(2) 基準の温間総時間の中央値の50%経過時点。各点を`--repeats`回行い、中止要求から`analyzeProject`のPromiseが決着するまで(Worker終了後に決着する)の遅延を中央値・最小・最大で記録する。最終状態は`cancelled` / `completed-before-cancel`(競合で先に完了) / `error`のいずれか。子プロセスが自然終了(終了コード0、タイムアウト内)するかを`processReleased`として記録し、残存ハンドルがあれば終了せずタイムアウトで失敗になる。子プロセスのピークRSSも記録する。レポートのスキーマはversion 1のまま、ケースに`cancel`ブロックを追加しただけである。
- 環境: Nodeとv8のバージョン、OS・アーキテクチャ、CPUモデル・論理CPU数、総メモリ、gitのリビジョン・ブランチ・未コミット変更の有無。

## 測定しないもの

- ブラウザ(Chrome等)でのメモリ・時間・中止応答。PERF1の本体であり別途測定が必要(計画: [perf-browser-plan.md](perf-browser-plan.md))。`cancel`ブロックはNodeのWorker+AbortSignalのみで、ブラウザの中止応答は測定していない。
- WebGPU・GPU。
- ネットワーク、転送量、配布物サイズ、回線条件。
- ブラウザのキャッシュ冷温(ここでの冷間はプロセス起動直後の意味で、ディスクやHTTPキャッシュは制御しない)。
- メモリ上限・メモリ不足時の挙動。中止応答はNode側のみ測定済みで、ブラウザ側は未測定。
- 実機・端末差の網羅。1台1回の測定は代表値ではない。

## 実行方法

```
node scripts/perf-measure.mjs                      # 全ケース、.qa/perf-report.json へ出力
node scripts/perf-measure.mjs --out <file> --repeats 1 --cases structural-tiny,thermal-steady
node scripts/perf-measure.mjs --cases structural-medium --cancel --repeats 5   # 中止応答を含める
node scripts/perf-measure.mjs --list
```

`.qa/`はgit管理外である。レポートは`schemaVersion: 1`、`scope: "node-worker-wasm-cpu; not browser, not GPU, not network"`を持つ。失敗したケースは`status: "failed"`と`error`を記録し、終了コードは1になる。テスト`tests/perf-measure.test.mjs`は最小ケースでスキーマと必須項目のみを検証し、時間の閾値は持たない。

## ブラウザ側の測定 (`scripts/perf-browser.mjs`、実装済み・実ブラウザ測定は未実施)

localhost上の実ページを、stdioコネクター(`node scripts/studio-mcp.mjs --browser-origin=<origin>`)経由で駆動する。**localhost、127.0.0.1、[::1]以外のoriginは拒否する。** 測定値であり上限や保証ではない。実ブラウザの値は未取得で、PERF1は未完了のままである。

```
node scripts/perf-browser.mjs [--origin http://127.0.0.1:5174] [--out .qa/perf-browser-report.json] [--repeats 3] [--cases structural-tiny,structural-medium,structural-fine] [--timeout-ms 300000] [--pair-timeout-ms 600000]
node scripts/perf-browser.mjs --print-probe        # メモリ用プローブを表示
node scripts/perf-browser.mjs --merge-memory <probe.json> --out .qa/perf-browser-report.json
```

手順(オペレーター): (1) 開発サーバーを起動し専用プロファイル・専用タブで`<origin>/?lang=en`を開き、10x10x40 mm直方体と測定する物理の設定を読み込む。(2) 任意のメモリ測定: DevToolsに`--print-probe`のスニペットを貼る(`window.__perfProbe`が1秒間隔で`measureUserAgentSpecificMemory`(系列`uasm`、クロスオリジン分離時のみ)を、補助として`performance.memory.usedJSHeapSize`(系列`jsHeap`、粗い)を別々に記録する。計測範囲が異なるため混ぜない)。(3) 対話端末で上記コマンドを実行する。端末に出るendpointとペアリングコードをアプリの接続UIに入力し、**inspectとanalyzeのscopeだけ**を許可する。コードは端末にのみ表示され、ファイル・レポート・ログには書かれない(stdoutが端末でない場合は表示しない)。(4) セッションが現れると自動で測定が始まる。完了までページを操作しない。(5) メモリ: 完了後に`copy(__perfProbe.report())`の内容を`.qa/probe.json`に保存し、`--merge-memory`で取り込む。プローブが無ければレポートの`memory`は`null`、`memoryReason`は`probe-absent...`となる(測定していないと明記する)。

ケースごとに入力リビジョンを固定し、`startJob`(options.sizeはケースのメッシュサイズ)を冷間1回・温間`--repeats`回行い、`jobStatus`(`executionSettled`)がタイムアウト内に決着するのを待つ。段階時間は`jobEvents`の受信時刻から求める。中止は`cancelJob`を(a)最初のイベント後、(b)温間総時間の中央値の50%経過時点で各`--repeats`回要求し、要求から決着(終端状態かつ`executionSettled`)の観測までの遅延を記録する(ポーリング間隔`--poll-ms`、既定50 msの粒度を含む)。その後に再解析が成功するか(`recoveredAfterCancel`)も記録する。決着しないジョブはケースを`failed`(`timedOut`)とし、終了コードは1になる。物理の種類(熱・音響)はページに読み込まれた入力に依存し、スクリプトは検証しない: `--cases thermal-steady`は熱の設定を読み込んでから実行する。

レポートは`schemaVersion: 1`、`scope: "browser via connector; localhost; real browser"`、リビジョン、ブラウザUA(inspectが返さない場合はプローブ由来、無ければ`null`)、ケースごとの`cold`/`warm`/`cancel`/`memory`を持つ。時間はホストが接続経由で観測した値でありページ内の`performance.now()`ではない。GPU・ネットワーク・他ブラウザ・メモリ上限は測定しない。テスト`tests/perf-browser.test.mjs`は偽コネクターでスキーマ・拒否・タイムアウト・トークン非出力を検証する。

`--merge-memory`の`memory`欄は計測範囲の異なる系列を分けて持つ。`uasm`=`performance.measureUserAgentSpecificMemory().bytes`(クロスオリジン分離時のみ・意味論的エージェント全体)、`jsHeap`=`performance.memory.usedJSHeapSize`(非標準・粗い・JSヒープのみ)。各系列の`peakBytesSampled`は一定間隔サンプルの最大値(近似)で、同じ系列自身のsampleから取る。**系列を合算せず、混在最大を総RAMと呼ばず、片方の欠測を他方で置換しない。** `NaN`/`Infinity`/負値/`null`は測定値にしない。片方しか値が無くても両系列を残し、他方は`available:false`と理由を持つ。window内に有効なsampleが無ければ`memory`は`null`と`memoryReason`になる。`mergeMemory`は`report`をその場で更新して返し、`probe`は読み取り専用である。`schemaVersion`は1のまま。

## 解釈上の注意

レポートの値は、その環境・その時点のビルドでの測定結果であり、対応規模の上限、性能目標、保証として扱わない。対応規模の決定にはブラウザ測定を含む後続作業が必要である。ここの数値をドキュメントや画面に保証として書かない。

## 2026-10-18 実Chrome部分測定

[実測証拠](evidence/2026-10-18-browser-performance-real-chrome.json)。既存の10×10×40mm構造参照入力を実Chromeでsize8/3/2mmの順に測定。coldは各ケースの初回（同一ページ/既存runtime、ブラウザ/HTTPキャッシュ未統制）で905.563/885.355/1182.657ms、warm各n1は775.220/775.162/1080.749ms。各ケースfirst-event/half-warmの取消は6回ともcancelled、request→terminalかつexecutionSettledの観測149.076〜172.910ms、後続solveも成功。これはコネクタ往復・100ms polling込みのホスト観測値で、上限/保証ではありません。

熱size3mmはcommand timeoutで中断、readonly inspect/listJobsもtimeout（後者delivered:false）。別担当が同タブの初期画面/入力喪失・接続閉を観察しましたがreset原因は未確定。再試行せず失敗を保持しました。メモリは正式semantic診断で未提供のため未観測。peakRAM・対応上限・他ブラウザ・熱時間/取消の値はなく、PERF1はbuildingを維持します。
