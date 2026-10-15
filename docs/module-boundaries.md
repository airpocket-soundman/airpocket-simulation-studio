# モジュール境界チェック (MOD1 第1スライス)

English: [en/module-boundaries.md](en/module-boundaries.md)

`src/` のES import依存方向を機械的に検査し、あわせて既存の診断・ジョブ・ケース識別の形を型宣言(`.d.ts`のみ)として固定する。

## レイヤー

分類表は `src/module-layers.json`。`src/` 配下(サブディレクトリ含む)の全 `.js` はちょうど1つのレイヤーに属さなければならない。

| レイヤー | 役割 | import してよい先 |
| --- | --- | --- |
| contract | 純粋な契約・識別・スキーマ(project-revision, runtime-identity, analysis-failure, job-event-payload, browser-operation-* など) | なし |
| domain | ソルバー、メッシュ、材料、領域、解析別入力契約、`solver-adapters/` | contract |
| operations | プロジェクト/ケース/ジョブ操作API(studio-api, analysis-preflight, cases, case-comparison など) | contract, domain |
| session | ブラウザセッション/MCP橋渡し、analysis-client(DOMなし) | contract, domain, operations |
| ui | DOM/three.js表示と `main.js`、`ui/` | contract, domain, operations, session |
| dashboard | 進捗ボード(board*, progress*) | contract, ui |
| worker | `analysis.worker.js`, `cad.worker.js` | contract, domain |

## ルール

- 上表以外のレイヤーへのimportは禁止(逆方向・横断を含む)。
- 外部パッケージ(`three` など)は、レイヤーの `externals` に列挙されたものだけ許可。現在は ui のみ。
- JSON/CSS/`?raw` 等の非JS importは、レイヤーの `assets` に列挙されたものだけ許可。
- `dom: false` のレイヤー(contract/domain/operations/session/worker)では、次のブラウザグローバル使用を禁止: `document.getElementById` 等の限定DOM API、`localStorage`/`sessionStorage`、`navigator.gpu/serviceWorker`、`HTMLElement`、`requestAnimationFrame`、`window.`、`location`、`history.pushState` 等、`fetch(`、`new Worker`/`new SharedWorker`。コメント・文字列/テンプレート/正規表現リテラルの中身とプロパティ参照(`x.location`, `api.fetch(`)は対象外。つまり session は「DOM要素を触らない」ことを強制しており、「ブラウザ非依存」までは保証しない(下記の許可リスト参照)。
- import抽出は正規表現ではなくトークン化で行い、静的import/`export ... from`、動的 `import(...)`(文字列/置換なしテンプレート、第2引数あり)、`new URL('./x.js', import.meta.url)`、`new Worker('./x.js')` をエッジとして扱う(Workerやアセットの URL 読み込みもレイヤー検査を受ける)。CRLF/CR/BOM、バックスラッシュ区切りの指定子・分類表エントリも同じ扱い。
- 分類表にないファイル、表にあって存在しないファイルは失敗。
- 例外は `allowlist` に理由つきで記録する。違反が解消された古い例外も失敗する(削除を強制)。

現在の許可リスト(既存違反・意図的な例外、隠さず理由つきで記録):

1. `project-import.js` -> `three`, `three/addons/loaders/STLLoader.js` (operations層がSTL読込にthree.jsを使用)。
2. `print-zip.js` -> `three/addons/libs/fflate.module.js` (3MF用zipがthree同梱のfflateを利用)。
3. `analysis-client.js` -> `analysis.worker.js` (edge) と `new Worker` (dom): session がWebWorkerを `new Worker(new URL(...))` で起動する。プロセス境界であり、worker層は session の mayImport に含めない。
4. `main.js` -> `cad.worker.js` (edge): ui がCAD workerを URL 読み込みで起動する。
5. `analysis.worker.js` の `fetch()` (dom): worker が自身でWASMを取得する(workerスコープの `fetch` でありDOMアクセスではない)。

1-2は純粋なパーサー/直接依存への置換が後続課題。dom許可は `kind: "dom"`, `to: <グローバル名>` で1つずつ指定する。

## 実行

```
node scripts/check-module-boundaries.mjs          # 検査
node scripts/check-module-boundaries.mjs --graph  # 解析したimportグラフを表示
node --test tests/module-boundaries.test.mjs tests/contracts.test.mjs
```

## ファイルの追加方法

1. `src/` に新規ファイルを作る。
2. `src/module-layers.json` の適切な `layers.<名前>.files` にパス(`src/`相対)を追加する。迷ったら、依存先の最上位レイヤーより上に置く。
3. `node scripts/check-module-boundaries.mjs` を実行し、禁止エッジが出たら依存を直す。許可リストは最後の手段で、理由を必ず書く。

## 共有型契約 (`src/contracts/*.d.ts`)

`diagnostics.d.ts`(AnalysisFailure/AnalysisDiagnostic/JobErrorRecord)、`job.d.ts`(JobView/JobEvent/ページ)、`case.d.ts`(Revision/RuntimeIdentity/ケース一覧/比較応答)。いずれも既存実装から導出した宣言のみで、コンパイラ依存はない。`tests/contracts.test.mjs` が実際の実行時出力と宣言フィールドを照合し(必須欠落・未宣言フィールド・宣言型の違反を検出し、宣言された任意フィールドは実行時サンプルで1回は観測されるか `OPTIONAL_NOT_OBSERVED` に理由つきで列挙されていなければ失敗する。索引シグネチャを持つ型の余剰キーも `INDEXED_EXTRAS` に固定)、契約が黙ってずれないようにする。追加するときは実装に存在する形に限り、同時に照合テストを足す。

## このチェックが扱わないこと

- MOD1は完了していない。本スライスは依存方向の機械検査と限定的な型契約のみ。
- React/WASM移行は含まない。
- フォルダ移動だけでは境界の達成にならない。分類表と依存方向の検査を通ることが条件。
- 同一レイヤー内の循環、関数単位の責務、`globalThis[...]` や別名経由のグローバル参照、実行時に組み立てるspecifier(変数import、`${}` 入りテンプレート、`new Worker(variable)`)は検査しない。DOM検出はトークン化後のコードに対する名前付きパターンの近似で、網羅ではない。
- トークナイザーは正規表現リテラルを直前トークンから推定する簡易実装で、極端な書き方(`)` 直後の正規表現など)では誤読しうる。実リポジトリ全体は独立オラクルテスト(相対 `.js` 文字列は全て認識済みimport)で確認している。
- 型宣言はコンパイル検証されない。照合はフィールド名と、リテラル/プリミティブ/ユニオン/テンプレートリテラル/それらの配列の型のみ。オブジェクト・interface・`unknown` 型の中身、`CaseComparisonRow` などの索引シグネチャ値、観測されていない任意フィールド(`OPTIONAL_NOT_OBSERVED` 参照)の実形状は検証しない。
