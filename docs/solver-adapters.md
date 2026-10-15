# ソルバーアダプタ境界（MOD1 第2スライス）

[English](en/solver-adapters.md)

`src/analysis.worker.js` の `solve()` 内にあった分野別の if/else 連鎖（creepingFlow / channelFlow / acoustic / thermal / 構造）を、分野ごとの実行アダプタへ切り出した。挙動・エラーメッセージ・結果ペイロードは変更していない。

## 構成

- `src/solver-adapters/index.js` : レジストリ。`resolveSolverAdapter(study)` が `study.kind` でアダプタを引く。未登録または kind なしは従来どおり構造解析（`legacyDefaultKind='structural'`）。
- アダプタ（各 `{kind, progressMessage, execute(ctx)}`）: `creeping-flow-adapter.js` / `channel-flow-adapter.js` / `acoustic-adapter.js` / `thermal-adapter.js` / `structural-adapter.js`（モーダル・塑性・超弾性・MFEM・WebGPU・Tet4 PCG を含む）。
- アダプタは任意の `validate({phase,data})` フックを持てる（全アダプタが実装）。分野別の事前検証はここへ移した（下記）。
- ワーカーは受理、共通検証、メッシュ生成、進捗、失敗ステージ、後処理（破壊・疲労・温度範囲チェック）、結果送出を担当する。
- 新しい分野を追加するには、アダプタファイルを1つ追加し、`index.js` の `adapters` 配列に1行足す。

## 変更しなかったこと（意図的）

- `operation` は従来どおり `mesh` のみ特別扱いで、それ以外の値は解析として実行される（拒否しない。テストで固定）。
- 事前検証の呼び出し位置・順序・エラー文字列・失敗ステージ（`preparation`）。`validate` はワーカーの従来の3箇所で呼ばれる: `pre-load`（gmsh 読込前）、`loaded`（gmsh 読込直後）、`configured`（「Simulation modules loaded」観測後、mesh/solve クロージャ構築前）。複数の規則が同時に成立する場合の優先順位も従来どおり。

## 事前検証の移管（第5スライス）

`src/solver-adapters/validation.js` に共通ガードを置き、各アダプタの `validate` が分野ごとの順序で呼ぶ。

- creepingFlow（`pre-load`）: `validateProject`、`validateStokesStudy`、Airpocket CPU ソルバー限定。
- 全分野（`loaded`）: 直交異方性は静的線形 CPU 構造のみ。
- 全分野（`configured`）: 塑性負荷率、塑性、モーダル、遠方場・過渡音響・振動の各検証（構造専用機能を他分野が持つ場合も従来どおり拒否）。
- 分野別（`configured`）: 材料検証（構造・熱のみ）、境界条件の種別チェック（「他分野の境界条件」エラー）、非構造での適応メッシュ・WebGPU/MFEM 拒否（流れ・Stokes・熱・音響）、超弾性制約（構造）、球面放射の前提（音響）。

### ワーカーに残したもの

- 受理、`requireResolvedCadConditions`（`operation!=='mesh'` 以外）、STL ソース検証（`validateStlSource`/`validateProject`/形状一致/適応・CAD パッチ非対応）: ソース形式の検証で分野に依存しないため。
- 外部流体領域は解析不可の検証（`fluidDomain`）: `source.kind`・`study.kind`・`mode` を横断する条件で、単一分野の規則ではないため。
- 破壊・疲労評価と温度範囲チェック（`postprocess` ステージ）、メッシュ生成、適応ループ、進捗、キャンセル、結果送出。

## build / 適応ループの移管（第7スライス）

- 任意フック `buildOptions({data})`: ワーカーの `build()` が `data.options` の後ろへ展開する分野別メッシュオプションを返す。creepingFlow のみ実装（`maxElements` を `min(8000, options.maxElements ?? 8000)` に制限）。従来の `stokes?{…}:{}` 分岐と同じ位置・同じ値。
- 任意フック `adaptive({data,mesh,solve,progress,observe})`: 適応細分化ループの呼び出し（上限パラメータの既定値を含む）。構造のみ実装（応力・ひずみ指標が構造結果に依存するため）。他分野は `validate` が適応を既に拒否しており到達しない。到達した場合の防御として、ワーカーは `adaptive` を持たないアダプタに同じメッセージ「Adaptive refinement currently supports structural analysis only」で失敗させる。
- ワーカーに残したもの: `build`/`solve` クロージャ、メッシュ生成呼び出し、円筒・平面 CAD 領域とユーザー細分化指定の合成、メッシュ観測、`operation==='mesh'` と適応の分岐、`stokes`/`flow` による境界転送のスキップ（`boundary-transfer` ステージ）、`thermal` の温度範囲チェック。いずれも共通オーケストレーションまたは後処理で、フック化すると挙動差の危険が大きいため。
- 固定: `tests/solver-adapter-build.test.mjs`（移管前コードで取得した22ケース: 構造適応・熱適応拒否・メッシュのみ・STL・fluidDomain・流れ/Stokes の build と要素数上限。タイミングを除く全メッセージのダイジェストを含む）。

## 未実施（MOD1 は未完了）

- UI/状態の分離、TypeScript 契約、React/WASM 移行は本スライスの対象外。
- `build` の分野固有部分と適応ループ呼び出しはアダプタへ移管済み（下記）。メッシュ生成本体・進捗・適応ループ本体（`src/adaptive.js`）は共通のまま。

## テスト

`tests/solver-adapter-validation.test.mjs`（39ケースの拒否メッセージ・失敗ステージ/コード・優先順位を、移管前のコードで取得した固定値で検証）、`tests/solver-adapter-registry.test.mjs`（レジストリ参照、未登録 kind のフォールバック、operation の扱い、拒否メッセージ）と既存の `tests/worker-pipeline.test.mjs`。
