# 82 COUPLE1 — 一方向連成チェーンの共通記述と版の伝播検査

## 開始条件

共通指示 `docs/opencode-work-orders-2026-10-23/00-COMMON.md`（primary checkout、読み取り専用）を先に読む。基準 `origin/main` `6566774` 以降。この1作業だけを実行し、親COUPLE1「熱・構造・音響・流体をつなぐ」の完成とは区別する。COUPLE5（FSI、PR #214）の領域（`src/fsi-partitioned.js`）とソルバー・worker・MCP・UIは変更しない。

## 前提と読む順

既存の限定連成は個別の転送演算子として存在する: 温度→構造（`src/temperature-transfer.js`, `buildTemperatureCaseSource`）、モード振動→外部音響（`src/vibration-source.js`, COUPLE4/4B）、流体圧→構造（`src/curved-pressure-transfer.js`）、平面熱流束の保存転送（`src/planar-heat-transfer.js`, COUPLE3）。これらを横断して「どの保存ケースがどの版の結果を消費したか」を記述・検査する共通層はない。

1. `src/progress.json` の `COUPLE1`（受入: 熱応力・振動放射・共役熱伝達の段階的追加、メッシュ間転送・保存則）
2. `src/case-source-operations.js`（保存ケース由来の温度/振動ソース）
3. `src/project-revision.js`（`sha256:` 物理版）

## 実装・検証手順

1. `src/coupling-chain.js` に純関数 `inspectCouplingChain(stages)` を置く。段 `{id, physics, revision, sources:[{from, kind, revision}]}`。
2. 転送種別は既存演算子があるものだけ許可（`COUPLING_TRANSFERS`、凍結）: temperature thermal→structural、vibration structural→acoustic、pressure fluid→structural、heatFlux thermal→thermal。
3. 検査: id一意、物理種別、`sha256:` 版、既知の生成段、種別と物理の対応、自己参照・循環の拒否（双方向はCOUPLE5で、ここでは反復しない）、トポロジカル順。
4. 版の伝播: 消費時に記録した生成段の版が現在の版と違えば `source-revision-changed`、上流が古い段の下流はすべて `upstream-stale`（推移的）。

## 受け入れ条件

正常チェーンで `valid:true, current:true`、順序が生成→消費。生成段の版変更で直接消費段と推移的下流のみが古いと判定され、無関係な枝は影響を受けない。不正記述・循環は診断コード付きで `valid:false`、成功扱いにしない。

## 対象試験

```text
node --test tests/coupling-chain.test.mjs
npm run check:contracts
git diff --check
```

## 境界と納品

証拠 `docs/evidence/2026-10-28-opencode-82-couple1.json`。`src/progress.json` は編集しない。残る親受入: 保存プロジェクト/ケース集からチェーン記述を自動生成し画面・MCPで古い段を表示する接続、熱応力・振動放射・共役熱伝達それぞれの一般形状での検証、メッシュ間転送の保存則の一般化（非平面・非一致界面）。
