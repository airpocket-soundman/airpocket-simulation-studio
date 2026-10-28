# 85 COUPLE5 — 多自由度界面のベクトルAitken・発散検出・単体解照合

## 開始条件

共通指示 `docs/opencode-work-orders-2026-10-23/00-COMMON.md`（primary checkout、読み取り専用）を先に読む。基準main `9445c0a`以降。この1作業だけを実行し、親COUPLE5「流体構造の双方向連成」の完成とは区別する。並行するCFD2第2歩が流体ソルバー本体を触り、COUPLE1連成チェーン（PR #224）も進行中のため、本作業は流体ソルバー・worker・MCP・UIを変更せず、連成層の純関数（新規 `src/fsi-interface-vector.js`）に留める。76の `src/fsi-partitioned.js` は変更しない。

## 前提と読む順

1. `docs/opencode-work-orders-2026-10-28/76-COUPLE5.md`（単一自由度ピストンでの分離反復契約。残条件に「多自由度界面での双方向反復」）
2. `src/fsi-partitioned.js`, `tests/fsi-partitioned.test.mjs`
3. `src/progress.json` の `COUPLE5`（受入: 時間同期・力の保存・安定性）

## 実装・検証手順

1. `src/fsi-interface-vector.js`: n自由度界面。流体は線形作用素 F = f0 − Ka d − Ma a（対称付加剛性・付加質量行列、非対角項で自由度が結合）、構造は対角質量ばね。両場は同じ t^{n+1}・同じNewmark(β=1/4, γ=1/2)運動学。緩和は none / constant / ベクトルAitken（ω ← −ω r_{k−1}·Δr / Δr·Δr）。
2. 発散検出: 残差ノルムが `divergenceWindow` 回連続で増大したら `converged:false, reason:'diverging'` で早期に拒否（max-iterationsまで回さない）。
3. 参照解: 同じ連成系のモノリシックNewmark解（密行列ガウス消去）。収束した分離反復はこれを再現すること。
4. 解析収縮行列 J = −S⁻¹(Ka + Ma/(βΔt²))、S = diag(k + m/(βΔt²))。2×2の固有値を閉形式で求め、緩和なしの残差比と照合。
5. 反復数比較: 付加質量比（最大固有値ベース）1.5/3/6相当で、最適定数緩和 ω=2/(2−λ1−λ2) とAitkenの最大反復数を比較。

入力は合成値（物性主張なし）。CFDソルバー結合、曲面転送 `pressureNodalForces` 転置との接続、ALE、非線形は行わない。

## 受け入れ条件

- 分離解とモノリシック解の相対差 < 1e-9（300ステップ、Δt=1e-4 s）
- 界面力の作用反作用 各成分和 = 0 N（厳密）
- 緩和なし残差比と解析スペクトル半径の相対差 < 1e-6、`diverging` で拒否、窓4で ≤6反復で検出
- Aitken ≤ 6反復かつ最適定数緩和より少ない（全比率）
- 不正入力（非対称行列、非有限、自由度不一致、未知緩和、ω0∉(0,1]、状態長不一致）を例外で拒否

## 対象試験

```text
node --test tests/fsi-interface-vector.test.mjs tests/fsi-partitioned.test.mjs
npm run check:contracts
git diff --check
```

## 境界と納品

証拠 `docs/evidence/2026-10-28-opencode-85-couple5.json`。`src/progress.json` は編集しない（71担当へ更新案を渡す）。残る親受入: 実CFD圧力場との結合（流体側を本作業の `force(kin)` 契約に適合させるアダプタ）、曲面転送の転置を界面写像に使う接続、IQN-ILS等の準ニュートン、非線形/大変位、ALE、ブラウザ/worker経路。
