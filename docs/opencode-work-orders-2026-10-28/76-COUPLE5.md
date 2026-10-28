# 76 COUPLE5 — 分離反復の連成契約を解析解ピストンで検証する

## 開始条件

共通指示 `docs/opencode-work-orders-2026-10-23/00-COMMON.md`（primary checkout、読み取り専用）を先に読む。基準main `e776ff1`。この1作業だけを実行し、親COUPLE5「流体構造の双方向連成」の完成とは区別する。並行する75 CFD2が流体ソルバー本体を触るため、本作業は流体ソルバー・worker・MCP・UIを変更せず、連成層の純関数に留める。

## 前提と読む順

COUPLE2/3/4/4Bは片方向の音響連成と曲面圧力転送（`src/curved-pressure-transfer.js`）であり、時間方向の双方向反復は未実装。

1. `src/progress.json` の `COUPLE5`（受入: 時間同期・力の保存・安定性）
2. `src/curved-pressure-transfer.js`, `tests/curved-pressure-transfer.test.mjs`（力/仕事の転置関係の既存契約）
3. `docs/roadmap.md` 137行（COUPLE5は個別検証後に公開）

## 実装・検証手順

1. `src/fsi-partitioned.js` に Dirichlet-Neumann 分離反復の契約を置く: 界面変位→流体圧→構造変位、各ステップ収束まで反復、緩和なし/Aitken。両場は同じ t^{n+1} と同じ Newmark(β=1/4, γ=1/2) 運動学で評価する（時間同期）。構造へ渡す力は流体へ返す力の符号反転そのもの（力の保存）。
2. 解析解のある最小問題: 長さLの流体柱を閉じるピストン（質量m・ばねk）。線形化した流体は p = p0 − κd − ρLa（付加質量 ρLA、付加剛性 κA）。厳密解 d(t)=d_eq+(d0−d_eq)cos ωt、ω²=(k+κA)/(m+ρLA)。
3. 検証: (a) 解析解との誤差と時間2次収束、(b) 離散エネルギー（構造運動+ばね+流体付加質量運動+圧縮）の保存、(c) 界面力の作用反作用、(d) 付加質量比 m_a/m=2 で緩和なしの反復が解析収縮率 −(κA+m_a/(βΔt²))/(k+m/(βΔt²)) で発散し、Aitkenが収束すること、(e) 不正入力の拒否。
4. 入力は合成値（物性主張なし）と明記する。CFDソルバーとの結合、多自由度界面、曲面転送との接続は行わない。

## 受け入れ条件

各指標に許容値と単位を示す: 相対誤差<2e-3（128分割/周期）、観測次数 2±0.05、エネルギー相対ドリフト<1e-9、界面力和=0 N、発散率と解析値の相対差<1e-6、Aitken≤5反復。非収束は `converged:false` と理由で返し成功扱いにしない。

## 対象試験

```text
node --test tests/fsi-partitioned.test.mjs
npm run check:contracts
git diff --check
```

## 境界と納品

証拠 `docs/evidence/2026-10-28-opencode-76-couple5.json`。`src/progress.json` は編集しない（71担当へ更新案を渡す）。残る親受入: 実CFDソルバー（圧力場）と構造FEMの多自由度界面での双方向反復、曲面転送 `pressureNodalForces` の転置を界面写像に使う接続、非線形/大変位、メッシュ移動（ALE）、ブラウザ/worker経路。
