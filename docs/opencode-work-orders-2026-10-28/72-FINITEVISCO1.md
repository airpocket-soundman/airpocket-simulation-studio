# 72 FINITEVISCO1 — 材料点で一般化Maxwell（Prony多分岐）の一軸応力ループを検証する

## 開始条件

10月23日の共通指示 `D:/github/airpocket-soundman/airpocket-simulation-studio/docs/opencode-work-orders-2026-10-23/00-COMMON.md`の書式・規則に従う（そのファイルはprimary checkoutにあり、今回の作業では読み取り専用）。基準main `e776ff1dc7f0cf13dfa049dc4d255734f7c55b08`。この1作業だけを実行し、親FINITEVISCO1全体の完成とは区別する。`src/progress.json`・共有roadmap・他番号の指示書は編集しない。

## 前提と読む順

既存成果: 1分岐の有限Green–Lagrange Maxwell材料点参照（`finite-visco-reference.js`、10月23日）、入力履歴の符号化/再生、最終観測比較、検査GUI。いずれも合成・暫定・未校正で、伸び0.95〜1.05の狭い範囲に限る。微小ひずみJ2とNeo-Hookeanは本課題の完了根拠にしない。

1. `docs/roadmap.md` FINITEVISCO1節（項目2「構成則の単要素検証」）
2. `docs/finitevisco-material-point-plan.md`（制限付きエネルギー、線形E区間契約、安定性の注意）
3. `src/finite-visco-reference.js` と `tests/finite-visco-reference.test.mjs`
4. `src/module-layers.json` のdomain層

## 実装・検証手順

1. 既存1分岐参照を変更せずに、新module `src/finite-visco-prony-uniaxial.js` を追加する。エネルギーは ψ = K/2(trE)² + μ∞H:H + Σₖ μₖ(H−Zₖ):(H−Zₖ)、各分岐は既存と同じ線形E区間の厳密更新（小さいdt/τは級数）を用いる。分岐数1〜8、Σμₖ ≤ μ∞、2/3 ≤ K/μ∞ ≤ 3、伸び・J・dt/τの範囲は既存参照と同じにし、範囲を広げない。
2. 軸方向Green歪E11の区分線形（ramp/hold）を規定し、側面を無拘束（S22=S33=0）とする一軸応力材料点を解く。終端S22は終端側方歪に対しアフィンなので反復なしで厳密に解く。各段でS11・公称P11・Cauchy σ11、側方伸び、J、断面積比、仕事、散逸、貯蔵エネルギー、エネルギー収支誤差を返す。
3. 結果は常に `synthetic:true / provisional:true / calibrated:false`、`permanentPlasticStrain:null`。除荷後の応力は粘性記憶であり塑性残留ひずみではないと明記する。
4. 焦点試験を追加: (a) 1分岐で既存参照へ同じFを与え段毎にS11・σ11・散逸一致とS22=S33≈0、(b) 等τ二分岐＝和の一分岐、(c) 載荷・保持・除荷・回復・再載荷ループのエネルギー収支、散逸単調増加、緩和と回復、(d) ガラス極限・完全緩和極限の独立閉形式一軸解、(e) 速度依存と時間刻み細分化での収束、(f) 範囲外・校正済み詐称・過大入力の拒否と入力不変。
5. `src/module-layers.json` のdomain層へ登録し、型宣言 `.d.ts` を追加する。証拠JSONを `docs/evidence/2026-10-28-opencode-72-finitevisco1.json` に保存する。

## 受け入れ条件

焦点試験・`npm run check:contracts`・`git diff --check`・docs試験が通る。証拠には基準SHA、合成パラメータ（合成と明記）、代表ループの段端値、試験コマンドと結果、未確認事項を記録する。材料定数・実測値を発明しない。実験との照合は行わない（データなし）ため校正済み・予測済みと表示しない。

## 対象試験

```text
node --test tests/finite-visco-prony-uniaxial.test.mjs tests/finite-visco-reference.test.mjs tests/docs.test.mjs
npm run check:contracts
```

## 境界と納品

範囲外: 有限変形塑性/粘塑性、損傷・軟化、くびれ、要素/Newton/構造反力統合、GUI/API/MCP、保存形式、実験校正、伸び範囲の拡大（強楕円性根拠なし）、PRF互換の主張。親の受け入れ（実験校正、構造経路、ダンベル）は残る。進捗更新案のみ納品に添え、`src/progress.json` は編集しない。
