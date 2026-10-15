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
npm run check:contracts                           # 宣言とfixtureをTypeScriptで検査
node --test tests/module-boundaries.test.mjs tests/contracts.test.mjs tests/contracts-types.test.mjs
```

## ファイルの追加方法

1. `src/` に新規ファイルを作る。
2. `src/module-layers.json` の適切な `layers.<名前>.files` にパス(`src/`相対)を追加する。迷ったら、依存先の最上位レイヤーより上に置く。
3. `node scripts/check-module-boundaries.mjs` を実行し、禁止エッジが出たら依存を直す。許可リストは最後の手段で、理由を必ず書く。

## 独立した変更と統合

UIの制御表示は `src/ui/discipline-controls-ui.js` が担当し、`src/main.js` は状態をgetterで渡して呼び出す。UI変更はこのモジュールと `tests/discipline-controls-ui.test.mjs` を中心に行い、main側には状態の注入・イベント接続だけを足す。分野固有のソルバー処理は `src/solver-adapters/<discipline>-adapter.js` に置き、共通の実行フローは `src/analysis.worker.js` がアダプターを呼び出す。例として温度範囲の後処理は `src/solver-adapters/thermal-adapter.js` にある。変更後は分類表を更新し、境界検査と関係する機能テストを実行する。共有の実行制御やまだアダプターへ移していない処理はworker側の責務として扱う。

## 共有型契約 (`src/contracts/*.d.ts`)

`diagnostics.d.ts`(AnalysisFailure/AnalysisDiagnostic/JobErrorRecord)、`job.d.ts`(JobView/JobEvent/ページ)、`case.d.ts`(Revision/RuntimeIdentity/ケース一覧/比較応答)、`project-input.d.ts`(保存Project envelope、代表的なsource/condition/material/study/units/provenance形状)。`npm run check:contracts` はTypeScriptのstrict/noEmitコンパイラを使い、これらの宣言と `tests/fixtures/contracts-types.ts` の正例・負例を検査する。`SavedProjectBase` は実際に必須のversion/meshes/conditionsをruntime parity testと照合する。これは宣言・fixtureと限定したruntime envelopeに限った検査で、JavaScript実装全体の型検査ではない。`SavedProject` は完全な保存schemaではなく代表的な共通形状である。condition内の `planarRegion` / `cylindricalRegion` は `unknown` のままで、runtime正本の全optional fieldやnested descriptorを網羅しない。解析study/material拡張点も `unknown` index signatureで保存形式の将来拡張を許し、全nested schema・物理範囲・単位変換・provenanceの真偽までは保証しない。fixtureの代表的material例はruntime material validatorで、ProjectUnitsの表現済み単位はruntime thermal input-contract表と機械照合する。別途 `tests/contracts.test.mjs` が既存runtime型のフィールドを照合する(宣言された任意フィールドは観測されるか `OPTIONAL_NOT_OBSERVED` に理由を記載し、索引シグネチャの余剰キーは `INDEXED_EXTRAS` に固定)。型宣言とfixtureは実装上の形状を追加するときに更新する。

## このチェックが扱わないこと

- MOD1は完了していない。本スライスは依存方向の機械検査と限定的な型契約のみ。
- React/WASM移行は含まない。
- フォルダ移動だけでは境界の達成にならない。分類表と依存方向の検査を通ることが条件。
- 同一レイヤー内の循環、関数単位の責務、`globalThis[...]` や別名経由のグローバル参照、実行時に組み立てるspecifier(変数import、`${}` 入りテンプレート、`new Worker(variable)`)は検査しない。DOM検出はトークン化後のコードに対する名前付きパターンの近似で、網羅ではない。
- トークナイザーは正規表現リテラルを直前トークンから推定する簡易実装で、極端な書き方(`)` 直後の正規表現など)では誤読しうる。実リポジトリ全体は独立オラクルテスト(相対 `.js` 文字列は全て認識済みimport)で確認している。
- TypeScriptコンパイラ検査は `.d.ts` とfixtureに限られ、全JavaScriptの型安全性を保証しない。実行時parity照合はコンパイラとは別の検査で、フィールド名と、リテラル/プリミティブ/ユニオン/テンプレートリテラル/それらの配列の型のみを照合する。オブジェクト・interface・`unknown` 型の中身、`CaseComparisonRow` などの索引シグネチャ値、観測されていない任意フィールド(`OPTIONAL_NOT_OBSERVED` 参照)の実形状は検証しない。
