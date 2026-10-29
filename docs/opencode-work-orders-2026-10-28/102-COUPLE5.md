# 102 COUPLE5 — 実CFD2チャネルソルバーとばね質量壁の分離連成

## 開始条件

共通指示 `docs/opencode-work-orders-2026-10-23/00-COMMON.md`（primary checkout、読み取り専用）を先に読む。基準main `c3a73e6`以降。この1作業だけを実行し、親COUPLE5「流体構造の双方向連成」の完成とは区別する。並行するCFD3（圧縮性）は別モジュールを触るため、本作業は流体ソルバー本体 `src/unsteady-ns-channel.js`、76の `src/fsi-partitioned.js`、85の `src/fsi-interface-vector.js`、worker・MCP・UIを変更せず、新規の連成層 `src/fsi-channel-shear-plate.js` に留める。

## 前提と読む順

1. `docs/opencode-work-orders-2026-10-28/76-COUPLE5.md`, `85-COUPLE5.md`（分離反復契約、ベクトルAitken、発散の早期拒否、一体解照合）
2. `src/fsi-interface-vector.js`（`force(kin)` 契約）, `src/unsteady-ns-channel.js`（CFD2非定常チャネル、可動上壁 `topVelocity`）
3. `src/progress.json` の `COUPLE5`（受入: 時間同期・力の保存・安定性）

## 問題設定

周期x・下壁固定のチャネル（H=1 mm、16セル、ρ=1000 kg/m³、ν=1e-6 m²/s、合成値）の上壁を、ばね質量の板（単位面積あたり m [kg/m²]、k [N/m³]）とする。板は接線方向に滑るので流体格子は動かない（ALE不要）。初期変位 d0=1 mm、流体静止。

## 実装・検証手順

1. アダプタ `channelShearFluid`: 板変位の推定 d^{n+1} から壁速度 V=(d^{n+1}−d^n)/Δt を1ステップ一定で与え、実ソルバー `solveChannelUnsteadyNS` を Δt だけ進める（粘性安定限界の1/2で内部分割）。板への力は板速度 v^{n+1} とソルバーと同じゴーストセル壁勾配 F=−μ(v^{n+1}−u_top)/(hy/2)。これを85の `force(kin)` に包み、`coupledStepVector`（Newmark β=1/4, γ=1/2、Aitken、発散拒否）と `diagonalStructure` で解く。
2. 一体参照解 `shearPlateMonolithicReference`: 同じ格子の半離散系（流体列 u_j＋板 x, v）を RK4（h=2e-6 s）で一体積分。
3. エネルギー収支: 流体運動エネルギー＋板エネルギー＋離散粘性散逸（台形積分）の初期値からのずれ。半離散系では dKE/dt = −D + Vτ が厳密に成り立つ。
4. 反復収束: 緩和なし反復の残差比を、実ソルバーの有限差分界面剛性から得た −S⁻¹ dF/dd と照合。板質量 0.05/0.01/0.002/0.0005 kg/m² で none / constant / Aitken の反復数を比較。

## 受け入れ条件

- 一体解との最大相対変位差 < 2e-3（Δt=1e-3 s, T=0.4 s）、Δt 4e-3→2e-3→1e-3 で次数 > 1.8
- 界面力の作用反作用 = 0（厳密）、x方向一様性の崩れ = 0
- エネルギー収支の欠損 < 2%（Δt=1e-3）、Δt半減で次数 > 0.9（v^{n+1} 力と一定壁速度の不一致による一次誤差。正直に一次と記録）
- 機械エネルギーが T 内に初期の5%未満へ散逸
- 緩和なし残差比と −S⁻¹dF/dd の相対差 < 1e-6、`diverging` を ≤6反復で検出
- Aitken が全板質量で ≤3反復、軽い板（≤0.002）で none / constant は `diverging`
- 不正入力（cellsY<4、非正の物性、非正質量、Δt≤0、初期分布長不一致、未知緩和）を例外で拒否

## 対象試験

```text
node --test tests/fsi-channel-shear-plate.test.mjs tests/fsi-interface-vector.test.mjs tests/fsi-partitioned.test.mjs tests/module-boundaries.test.mjs
npm run check:contracts
git diff --check
```

## 境界と納品

証拠 `docs/evidence/2026-10-29-opencode-102-couple5.json`。`src/progress.json` は編集しない（71担当へ更新案を渡す）。残る親受入: 法線方向の弾性壁（ALE/格子移動）、圧力場との結合、エネルギー一次欠損を解消する時間平均力の受け渡し（ソルバー内部ステップの公開が必要）、曲面転送の転置による界面写像、IQN-ILS、非線形/大変位、ブラウザ/worker経路。
