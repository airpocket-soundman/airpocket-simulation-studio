# ソルバーアダプタ境界（MOD1 第2スライス）

[English](en/solver-adapters.md)

`src/analysis.worker.js` の `solve()` 内にあった分野別の if/else 連鎖（creepingFlow / channelFlow / acoustic / thermal / 構造）を、分野ごとの実行アダプタへ切り出した。挙動・エラーメッセージ・結果ペイロードは変更していない。

## 構成

- `src/solver-adapters/index.js` : レジストリ。`resolveSolverAdapter(study)` が `study.kind` でアダプタを引く。未登録または kind なしは従来どおり構造解析（`legacyDefaultKind='structural'`）。
- アダプタ（各 `{kind, progressMessage, execute(ctx)}`）: `creeping-flow-adapter.js` / `channel-flow-adapter.js` / `acoustic-adapter.js` / `thermal-adapter.js` / `structural-adapter.js`（モーダル・塑性・超弾性・MFEM・WebGPU・Tet4 PCG を含む）。
- ワーカーは受理、検証、メッシュ生成、進捗、失敗ステージ、後処理（破壊・疲労・温度範囲チェック）、結果送出のみを担当する。
- 新しい分野を追加するには、アダプタファイルを1つ追加し、`index.js` の `adapters` 配列に1行足す。

## 変更しなかったこと（意図的）

- `operation` は従来どおり `mesh` のみ特別扱いで、それ以外の値は解析として実行される（拒否しない。テストで固定）。
- ワーカー内の事前検証（分野間の組み合わせ制約など）はワーカーに残している。

## 未実施（MOD1 は未完了）

- UI/状態の分離、TypeScript 契約、React/WASM 移行は本スライスの対象外。
- 事前検証のアダプタ側への移管、`adaptiveSolve` や `build` のアダプタ化は未着手。
- 依存規則のクラス分けへの `src/solver-adapters/` 登録はリード側作業。

## テスト

`tests/solver-adapter-registry.test.mjs`（レジストリ参照、未登録 kind のフォールバック、operation の扱い、拒否メッセージ）と既存の `tests/worker-pipeline.test.mjs`。
