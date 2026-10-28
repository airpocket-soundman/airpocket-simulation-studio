# 91 COUPLE1 — 保存ケースからの連成チェーン生成と実ケースでの失効判定

## 開始条件

共通指示 `docs/opencode-work-orders-2026-10-23/00-COMMON.md`（primary checkout、読み取り専用）を先に読む。基準 `origin/main` `01e179e`（#224 マージ済み）以降。この1作業だけを実行し、親COUPLE1「熱・構造・音響・流体をつなぐ」の完成とは区別する。COUPLE5（FSI、`src/fsi-partitioned.js`）とソルバー・worker・MCP・UIは変更しない。

## 前提と読む順

指示書82で `src/coupling-chain.js` の `inspectCouplingChain` が入ったが、チェーン記述は手書きの合成値だけで検証されていた。保存ケースは既に消費元を記録している: `buildTemperatureCaseSource`/`buildVibrationCaseSource` 経由の適用で `study.temperatureSource.caseReference` / `study.vibrationSource.caseReference` に `{schemaVersion, caseId, revision}` が入り、解析出力 `output.input.study` に残る。保存ケースの版は `src/case-operations.js` の `{name, output}` の正準JSONハッシュ。

1. `docs/opencode-work-orders-2026-10-28/82-COUPLE1.md` と証拠の残条件
2. `src/case-source-operations.js`（caseReference の記録）
3. `src/case-operations.js`（保存ケース版）

## 実装・検証手順

1. `src/coupling-chain.js` に `couplingChainFromCases(cases)` を追加。行 `{caseId, revision, output}` から段 `{id:caseId, physics, revision, sources}` を作る。物理は `output.result.kind` の明示対応のみ（thermal→thermal、elastic/modal→structural、acoustic/acousticTransient→acoustic）。対応しない種別は推測せず `COUPLING_CASE_UNSUPPORTED`。
2. sources は消費側の解析入力に記録された caseReference（temperature/vibration）だけから作る。
3. `inspectSavedCaseChain(cases)` はアダプタ診断があれば `valid:false`、なければ `inspectCouplingChain` に渡す。
4. 実ケース試験: ヘッドレス解析で熱ケースを解き保存版を計算、`createCaseSourceOperations.apply` で温度ソースを構造に適用して解き保存。チェーンが current。熱の境界温度を変えて再解析・再保存すると構造ケースが `source-revision-changed`（記録版=旧熱版、現版=新熱版）。新熱ケースで構造を再適用・再解析すると current に戻る。

## 受け入れ条件

実解析の熱→構造ケースから自動生成したチェーンが生成→消費の順で current。上流入力の変更で下流のみが失効し、再適用で回復する。生成段の欠落・未対応種別・非配列は診断付き `valid:false`。

## 対象試験

```text
node scripts/build-kernel.mjs
node --test tests/coupling-chain-cases.test.mjs tests/coupling-chain.test.mjs
npm run check:contracts
git diff --check
```

## 境界と納品

証拠 `docs/evidence/2026-10-28-opencode-91-couple1.json`。`src/progress.json` は編集しない。残る親受入: ケース一覧API・画面・MCPへの失効表示の接続、構造→音響（モード振動放射）の実ケース連鎖検証、流体圧→構造の保存ケース参照（現状 caseReference なし）、熱応力・振動放射・共役熱伝達の一般形状検証、非一致界面の保存則。
