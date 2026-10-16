# ブラウザ性能測定の計画 (PERF1 / P2 残り)

English: [en/perf-browser-plan.md](en/perf-browser-plan.md)

**状態: スクリプト実装済み、実ブラウザでの測定は未実施。** `scripts/perf-browser.mjs`(コネクター経由、テストは偽コネクター)は実装済みだが、実ブラウザの値はまだ無い。以下の「方式」はCDP/タブAPI前提の当初設計で、実装はstdioコネクター(`jobStatus`/`jobEvents`/`cancelJob`)経由に変更した(ページ内`performance.now()`ではなくホスト側の観測時刻、メモリはオペレーター貼付けの`window.__perfProbe`で任意取得)。使い方は[performance-measurement.md](performance-measurement.md)。旧記述: Node側の測定は[performance-measurement.md](performance-measurement.md)(`scripts/perf-measure.mjs`)にある。本書は、PERF1が求める「ブラウザでのメモリ・時間・中止応答」を測る`scripts/perf-browser.mjs`の設計を定める。実装前は、ブラウザの値について何も主張しない。得られる値は測定値であり、対応規模の上限や保証ではない。

## 目的と範囲

- 測る: 実Chrome上のアプリ(ローカル配信)での、ケースごとの冷間・温間の所要時間、ページのメモリ、中止応答、中止後のメモリ解放。
- 測らない(明記する): GPU/WebGPU描画、ネットワーク・転送量・回線条件、Chrome以外のブラウザ、複数端末、メモリ上限・メモリ不足時の挙動(別計画)。公開HTTPSサイトの測定は対象外(PUBLICHTTPS1が未検証のため)。

## 方式

既存の実Chromeドライバーと同じ方式を使う。ブラウザ操作はコネクター(`scripts/studio-browser-mcp.mjs` / `scripts/browser-bridge.mjs`)経由、または`scripts/qa-browser.cua.js`が使うタブAPI(`tab.goto`, `tab.playwright.locator(...)`, `evaluate`)で行う。`scripts/perf-browser.mjs`はその上のオーケストレーターで、ケース定義は`scripts/perf-measure.mjs`の`CASES`を再利用し、同じ10x10x40 mmの直方体を同じメッシュサイズで解析する(Nodeの値と比較できるようにするため)。

### ページ側の前提

- ページは`crossOriginIsolated === true`であること。メモリ測定の`performance.measureUserAgentSpecificMemory()`はクロスオリジン分離下でのみ使える。アプリは`public/coi-serviceworker.js`と`vite.config.js`のヘッダーで分離を得る。分離されていなければ、メモリ欄は`null`、理由`not-cross-origin-isolated`を記録し、時間と中止だけを測る(黙って成功扱いにしない)。
- 計測用の読み出しはページ内`evaluate`で行い、アプリのソースは変更しない。

### 呼び出す操作

1. `tab.goto(http://localhost:<port>/?lang=en)`で新規読込(冷間は、そのタブでの最初の解析)。温間は同じページでの再実行(ページ再読込なし)。
2. ケースの読込: 既存のデモ読込ボタン、または`perf-measure.mjs`のケースをエクスポートしたプロジェクトJSONの読込。メッシュサイズは画面の設定欄で指定する。
3. 解析: `#solve-run`をクリックし、`#status`が完了表示になるまで待つ。時間はページ内の`performance.now()`で取る(クリック直前に`evaluate`で開始印を設定し、`#status`の変化を`MutationObserver`で検出)。ホスト側のRPC往復は含めない。
4. 中止: 解析の実行中に、ページの中止操作をクリックする(コネクター側の`cancel`ではなく、利用者と同じ経路)。`#status`が中止表示になり実行が止まるまでの時間を、ページ内の`performance.now()`で測る。中止点はNodeと揃える: (a) 最初の進捗表示後、(b) 同ケースの温間総時間中央値の50%経過時点。
5. メモリ: 各段階で`await performance.measureUserAgentSpecificMemory()`を呼ぶ。(i)読込直後(基準)、(ii)解析完了直後、(iii)中止直後、(iv)数秒後(GC要求が可能な場合のみ要求した後)。`bytes`と、`breakdown`のうちWorker由来の分を分けて記録する。補助として`performance.memory.usedJSHeapSize`(非標準・粗い)を参考欄に別記する。ピークは一定間隔(例: 200 ms)のサンプリングの最大値で近似し、間隔と回数を記録する(測定自体もメモリを使う旨を併記)。

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
    memory: {available, reason?, baselineBytes, afterSolveBytes, afterCancelBytes, afterSettleBytes, peakBytesSampled, samples: {intervalMs, count}},
    cancel: {points: {"first-progress": {latencyMs: {median,min,max,n}, states: {...}}, "half-warm-total": {...}},
             recoveredAfterCancel: boolean},
    notes: [...]
  }],
  notes: ["measurements, not limits or guarantees", "GPU, network, other browsers not measured"]
}
```

最終状態は`cancelled` / `completed-before-cancel` / `error`(Node側と同じ語彙)。値はすべて測定値である。

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
