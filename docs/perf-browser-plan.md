# ブラウザ性能測定の計画 (PERF1 / P2 残り)

English: [en/perf-browser-plan.md](en/perf-browser-plan.md)

**現在: 実Chromeの構造3サイズで時間/取消を部分実測済み、熱は接続reset/timeoutで中断。メモリ・他ブラウザ・対応上限は未観測です。** 末尾の2026-10-18証跡を参照。以下は当初設計の履歴で、現在の実装はscripts/perf-browser.mjs経由のホスト観測時間を使います。下記のCDP/hidden-global測定を今回実行したという意味ではありません。

## 目的と範囲

- 測る: 実Chrome上のアプリ(ローカル配信)での、ケースごとの冷間・温間の所要時間、ページのメモリ、中止応答、中止後のメモリ解放。
- 測らない(明記する): GPU/WebGPU描画、ネットワーク・転送量・回線条件、Chrome以外のブラウザ、複数端末、メモリ上限・メモリ不足時の挙動(別計画)。公開HTTPSサイトの測定は対象外(PUBLICHTTPS1が未検証のため)。

## 方式

既存の実Chromeドライバーと同じ方式を使う。ブラウザ操作はコネクター(`scripts/studio-browser-mcp.mjs` / `scripts/browser-bridge.mjs`)経由、または`scripts/qa-browser.cua.js`が使うタブAPI(`tab.goto`, `tab.playwright.locator(...)`, `evaluate`)で行う。`scripts/perf-browser.mjs`はその上のオーケストレーターで、ケース定義は`scripts/perf-measure.mjs`の`CASES`を再利用し、同じ10x10x40 mmの直方体を同じメッシュサイズで解析する(Nodeの値と比較できるようにするため)。

### ページ側の前提

- ページは`crossOriginIsolated === true`であること。メモリ測定の`performance.measureUserAgentSpecificMemory()`(系列`uasm`、意味論的なエージェント全体バイト)はクロスオリジン分離下でのみ使える。アプリは`public/coi-serviceworker.js`と`vite.config.js`のヘッダーで分離を得る。分離されていなければ`uasm`系列はunavailableとし、粗い`performance.memory.usedJSHeapSize`(系列`jsHeap`、JSヒープのみ)だけを別系列として記録する(黙って成功扱いにせず、他系列で代用しない)。
- 計測用の読み出しはページ内`evaluate`で行い、アプリのソースは変更しない。

### 呼び出す操作

1. `tab.goto(http://localhost:<port>/?lang=en)`で新規読込(冷間は、そのタブでの最初の解析)。温間は同じページでの再実行(ページ再読込なし)。
2. ケースの読込: 既存のデモ読込ボタン、または`perf-measure.mjs`のケースをエクスポートしたプロジェクトJSONの読込。メッシュサイズは画面の設定欄で指定する。
3. 解析: `#solve-run`をクリックし、`#status`が完了表示になるまで待つ。時間はページ内の`performance.now()`で取る(クリック直前に`evaluate`で開始印を設定し、`#status`の変化を`MutationObserver`で検出)。ホスト側のRPC往復は含めない。
4. 中止: 解析の実行中に、ページの中止操作をクリックする(コネクター側の`cancel`ではなく、利用者と同じ経路)。`#status`が中止表示になり実行が止まるまでの時間を、ページ内の`performance.now()`で測る。中止点はNodeと揃える: (a) 最初の進捗表示後、(b) 同ケースの温間総時間中央値の50%経過時点。
5. メモリ: 各段階で`await performance.measureUserAgentSpecificMemory()`を呼ぶ。(i)読込直後(基準)、(ii)解析完了直後、(iii)中止直後、(iv)数秒後(GC要求が可能な場合のみ要求した後)。`bytes`と、`breakdown`のうちWorker由来の分を分けて記録する。補助として`performance.memory.usedJSHeapSize`(非標準・粗い)を別系列`jsHeap`として記録する。**`uasm`(意味論的エージェント全体)と`jsHeap`(JSヒープのみ)は計測範囲が異なるため、sample単位のfallbackで混ぜず、片方が欠測でも他方で置換せず、合算しない。** ピークは一定間隔(例: 200 ms/1000 ms)のサンプリングの最大値で近似し、間隔と回数を記録する(測定自体もメモリを使う旨を併記)。

### ケースと反復

- ケース: `structural-tiny`, `structural-medium`, `structural-fine`, `thermal-steady`(任意で`acoustic-harmonic`)。上限探索は別作業。
- 各ケースで、冷間1回、温間N回(既定3)、中止(a)をN回、中止(b)をN回。中止後に同じページで再解析が成功するかも記録する。
- タブの再読込は冷間の前だけ行う。

## レポートのスキーマ(`schemaVersion: 1`、Node側レポートとは別ファイル)

```
{
  schemaVersion: 1,
  scope: "chrome-localhost-wasm-cpu; not gpu, not network, not public site",
  generatedAt, git: {revision, branch, dirty},
  environment: {chromeVersion, userAgent, platform, cpuCount, deviceMemoryGiB, crossOriginIsolated, appVersion},
  repeats,
  cases: [{
    id, physics, meshSize, status: "ok"|"failed", error?,
    cold: {totalMs, solveMs, ...}, warm: {runs: [...], summary: {totalMs: {median,min,max,n}}},
    memory: {available, primarySeries, intervalMs, sampleCount,
             series: {uasm:  {available, source, baselineBytes, peakBytesSampled, afterCancelBytes, afterSettleBytes, sampleCount, unavailable},
                      jsHeap: {available, source, baselineBytes, peakBytesSampled, afterCancelBytes, afterSettleBytes, sampleCount, unavailable}},
             note},
    cancel: {points: {"first-progress": {latencyMs: {median,min,max,n}, states: {...}}, "half-warm-total": {...}},
             recoveredAfterCancel: boolean},
    notes: [...]
  }],
  notes: ["measurements, not limits or guarantees", "GPU, network, other browsers not measured"]
}
```

最終状態は`cancelled` / `completed-before-cancel` / `error`(Node側と同じ語彙)。値はすべて測定値である。

### メモリ系列の扱い(実装: `mergeMemory`)

`memory.series`は計測範囲の異なる系列を分けて持つ。`uasm`= `performance.measureUserAgentSpecificMemory().bytes`(クロスオリジン分離時のみ・意味論的なエージェント全体)、`jsHeap`=`performance.memory.usedJSHeapSize`(非標準・粗い・JSヒープのみ)。系列ごとに、case window内のその系列自身のsampleだけから`peakBytesSampled`(一定間隔サンプルの最大値による近似)・baseline(window直前の最後のsample)・`afterCancelBytes`/`afterSettleBytes`(それぞれ`cancelSettledEpochMs`/`endEpochMs`の+3000 ms以降の最初のsample)を取る。**系列を合算せず、混在最大を総RAMと呼ばず、片方の欠測を他方で置換しない。** `NaN`/`Infinity`/負値/`null`は測定値として採用しない。片方の系列しか値が無い場合も`series`には両方を残し、値の無い系列は`available:false`と`unavailable`の理由を持つ。window内に有効なsampleが1つも無ければ`memory`は`null`と`memoryReason`になる。互換用のフラット項目(`primarySeries`が指す1系列のみ)と`series`を同時に持ち、フラット項目は系列を合算しない。`mergeMemory`は既存契約どおり`report`をその場で更新して返し、`probe`は読み取り専用である。`schemaVersion`は1のまま(系列分離は加算的な変更)。

## 安全規則

- **localhostのみ**: `localhost`、`127.0.0.1`、`[::1]`以外のURLへは移動しない。公開サイトや外部URLを受け付ける引数を作らない。
- **トークン・秘密情報をファイルに書かない**: コネクターのトークンやURLの認証情報を、レポート・ログ・コミット対象に出力しない。レポートにはURLのオリジンのみ(トークンなし)を残す。
- **同時に1つのChromeセッションのみ**: 複数のタブ・ブラウザで同時に測定しない(干渉と資源競合を避ける)。測定は直列、専用の作業タブ1つで行い、終了時に閉じる。
- 読み取り・解析・中止のみを行い、ユーザーデータ(ケース集、保存済みプロジェクト)を変更・削除しない。ページ再読込でケース集が置換され得るため、専用プロファイル・専用タブでのみ実行する。
- 出力先は`.qa/`(git管理外)。
- 開発サーバーは`preview_start`相当で起動し、測定後に停止する。外部へは何も送信しない。

## 実装の手順(将来)

1. `scripts/perf-browser.mjs`の骨組み(引数、localhost検証、`CASES`の再利用、レポート書出し)と、ブラウザ不要のスキーマ・引数検証テスト。
2. ページ内計測スニペット(開始印、`MutationObserver`、メモリサンプラー)を文字列として分離し、純粋関数部分をNodeで単体テスト。
3. コネクター経由で1ケースを実測し、`crossOriginIsolated`とメモリAPIの可否を確認。
4. 全ケースを測定し、Node側(中止を含む)との比較表を作り、ドキュメントに反映。PERF1のbacklog更新は、測定値が揃ってから別作業で行う。

## 完了条件(PERF1に対して)

ブラウザのメモリ・時間・中止応答が、上記ケースで実測され、環境つきで記録されること。メモリ上限と対応規模の決定は、その先の別作業である。

## 2026-10-18 実Chrome部分測定

[実測証拠](evidence/2026-10-18-browser-performance-real-chrome.json)。既存の10×10×40mm構造参照入力を実Chromeでsize8/3/2mmの順に測定。coldは各ケースの初回（同一ページ/既存runtime、ブラウザ/HTTPキャッシュ未統制）で905.563/885.355/1182.657ms、warm各n1は775.220/775.162/1080.749ms。各ケースfirst-event/half-warmの取消は6回ともcancelled、request→terminalかつexecutionSettledの観測149.076〜172.910ms、後続solveも成功。これはコネクタ往復・100ms polling込みのホスト観測値で、上限/保証ではありません。

熱size3mmはcommand timeoutで中断、readonly inspect/listJobsもtimeout（後者delivered:false）。別担当が同タブの初期画面/入力喪失・接続閉を観察しましたがreset原因は未確定。再試行せず失敗を保持しました。メモリは正式semantic診断で未提供のため未観測。peakRAM・対応上限・他ブラウザ・熱時間/取消の値はなく、PERF1はbuildingを維持します。
