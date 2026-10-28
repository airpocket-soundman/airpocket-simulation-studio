# 90 FAIL1 — Weibull破壊確率をFEM Tet4要素体積積分へ結合し解析解で照合する

## 開始条件

共通指示 `docs/opencode-work-orders-2026-10-23/00-COMMON.md`（primary checkout、読み取り専用）を先に読む。基準main `01e179e`（#225 マージ済み）。この1作業だけを実行し、親FAIL1「破壊・疲労・接触・非線形を扱う」の完成とは区別する。UI・MCP・worker・保存形式・ソルバーは変更せず、domain層の純関数 `src/weibull-fracture.js` への追加に留める。

## 前提と読む順

指示書81で2母数Weibull体積PIAの純関数 `evaluateWeibullFailure(result, elementVolumesMm3, data)` を検証した。残条件の先頭「解析結果（WASM要素体積）との結合」に対し、要素体積は呼び出し側が与える前提で、解いたTet4メッシュから体積を得る経路が無かった。

1. `docs/opencode-work-orders-2026-10-28/81-FAIL1.md`, `docs/evidence/2026-10-28-opencode-81-fail1.json`
2. `src/weibull-fracture.js`, `src/tetra-geometry.js`（`tetraVolume`、節点mm）
3. `src/fem-core.js` の `solveElastic`（要素一定応力、`displacements` 境界）

## 実装・検証手順

1. `tetraVolumesMm3(mesh)`: Tet4 の体積 mm^3（共有 `tetraVolume`）。節点・要素の形式、添字範囲、退化要素を拒否。
2. `evaluateWeibullFailureOnMesh(mesh, result, data)`: 要素数と応力数の一致を要求し、81の関数へ委譲、`totalVolumeMm3` を添える。要素一定応力×要素体積の総和は FE 応力場の厳密な体積積分。
3. 解析解: (a) 実 `solveElastic`（JS CPU、ν=0、端面 u_z 規定）の一様引張で P_f 閉形式、(b) 純曲げ σ_zz = σ_max·2x/h を実Tet4メッシュの要素重心で評価し、リスク V/(2(m+1))/V_0 (σ_max/σ_0)^m へ次数2収束、(c) 体積総和の厳密性、(d) 不整合メッシュ拒否。
4. 入力は合成値（物性主張なし）。

## 受け入れ条件

(a) P_f 相対誤差<1e-8、有効体積=V（<1e-7）、(b) nx=64 で相対誤差<5e-3 かつ観測次数 2±0.1、(c) 体積総和の相対誤差<1e-12、(d) 要素数不一致・退化・範囲外添字・形式不正を拒否。

## 対象試験

```text
node --test tests/weibull-fem-coupling.test.mjs
node --test tests/weibull-fracture.test.mjs
node --test tests/module-boundaries.test.mjs
npm run check:contracts
git diff --check
```

## 境界と納品

証拠 `docs/evidence/2026-10-29-opencode-90-fail1.json`。`src/progress.json` は編集しない（更新案を納品へ添える）。観測: 実ソルバーの純曲げ（nz=4、nx=8/16/32）はTet4の曲げロッキングで応力が過大となり、リスク相対誤差が約12.5/10.8/10.4で収束しない。これは体積積分ではなくFE応力の離散化誤差であり、本作業の受入から除外した。残る親受入: Tet4曲げロッキング下での破壊確率の要素収束（2次要素または応力回復）、headless/worker・保存・UIへの組込み、表面欠陥Weibull、3母数・信頼区間、き裂進展・応力腐食・混合モード、塑性疲労・多軸疲労、接触の摩擦/ボルト、実測試験データでの照合。
