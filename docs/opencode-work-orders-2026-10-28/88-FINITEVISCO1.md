# 88 FINITEVISCO1 — 乗法分解上のHencky Prony材料点で客観性と微小ひずみ極限を検証する

## 開始条件

10月23日の共通指示 `D:/github/airpocket-soundman/airpocket-simulation-studio/docs/opencode-work-orders-2026-10-23/00-COMMON.md`の書式・規則に従う（そのファイルはprimary checkoutにあり、今回の作業では読み取り専用）。基準main `1ad0fced74a8b8077ea405d9fb4d21f71dc9eded`（#218＝72を含む）。この1作業だけを実行し、親FINITEVISCO1全体の完成とは区別する。`src/progress.json`・共有roadmap・他番号の指示書は編集しない。

## 前提と読む順

既存成果: 72の合成Prony一軸材料点（`finite-visco-prony-uniaxial.js`、Green–Lagrange線形E区間の厳密更新）、1分岐参照（`finite-visco-reference.js`）。いずれも合成・暫定・未校正で、伸び0.95〜1.05に限る。72は全歪Eの加法的な分岐記憶であり、乗法分解・任意回転の検査は未実施。

1. `docs/opencode-work-orders-2026-10-28/72-FINITEVISCO1.md` と証拠JSON
2. `src/finite-visco-prony-uniaxial.js` と試験
3. `docs/finitevisco-material-point-plan.md`（制限付きエネルギー、安定性の注意）
4. `src/module-layers.json` のdomain層

## 実装・検証手順

1. 72を変更せず、新module `src/finite-visco-hencky-multiplicative.js` を追加する。F = Fe Fv、各分岐は弾性左Cauchy–Green be_kを状態に持ち、試行 be_tr = f be_n fᵀ（f = F_{n+1}F_n⁻¹）、主対数空間で dev εe = dev ε_tr·exp(−dt/τ)、体積成分は粘性流れなし。Kirchhoff τ = K tr ε I + 2μ∞ dev ε + Σ 2μₖ dev εe,k、σ = τ/J。パラメータ・分岐数・伸び（Cの主伸び）・J・dt/τの範囲は72と同じで広げない。
2. 一般F用の `initFiniteViscoHencky`/`stepFiniteViscoHencky`（任意回転可）と、72と同じ入力形式の一軸駆動 `runFiniteViscoHenckyUniaxial`（側面σ22=σ33=0を保護付きsecantで解く）を提供する。散逸は中点評価のアルゴリズム散逸（非負）とし、72のような厳密エネルギー収支は主張しない。
3. 結果は常に `synthetic:true / provisional:true / calibrated:false`、`permanentPlasticStrain:null`。
4. 焦点試験: (a) 微小ひずみ極限（E11振幅1e-5）で72の駆動とS11・散逸が一致し刻み細分化で誤差減少、3%では差が残ることを記録、(b) 時間変化する重ね合わせ回転Q(t)で σ(QF)=QσQᵀ、散逸・貯蔵エネルギー不変、純剛体回転で応力・散逸ゼロ、(c) 載荷・保持・除荷・回復・再載荷ループの側面無拘束・散逸単調・緩和と回復、(d) ガラス極限・完全緩和極限の独立閉形式Hencky一軸解、(e) 速度依存と刻み収束、(f) 範囲外・校正済み詐称・外部状態・過大入力の拒否と入力不変。
5. `src/module-layers.json` のdomain層へ登録し、`.d.ts` を追加する。証拠JSONを `docs/evidence/2026-10-28-opencode-88-finitevisco1.json` に保存する。

## 受け入れ条件

焦点試験・`npm run check:contracts`・`git diff --check`・docs試験が通る。証拠には基準SHA、合成パラメータ（72と同じ合成値と明記）、代表ループの段端値、72との比較（微小ひずみ極限の収束と3%での実差）、試験コマンドと結果、未確認事項を記録する。材料定数・実測値を発明しない。

## 対象試験

```text
node --test tests/finite-visco-hencky-multiplicative.test.mjs tests/finite-visco-prony-uniaxial.test.mjs tests/finite-visco-reference.test.mjs tests/docs.test.mjs
npm run check:contracts
```

## 境界と納品

範囲外: 有限変形塑性/粘塑性、損傷・軟化、くびれ、要素接線・Newton・構造反力統合、GUI/API/MCP、保存形式、実験校正、伸び範囲の拡大（二次Henckyは多凸でなく根拠なし）、PRF互換の主張。親の受け入れ（実験校正、構造経路、ダンベル）は残る。次の一歩候補: 一般Fの整合接線（数値差分との照合）と単要素パッチ試験。進捗更新案のみ納品に添え、`src/progress.json` は編集しない。
