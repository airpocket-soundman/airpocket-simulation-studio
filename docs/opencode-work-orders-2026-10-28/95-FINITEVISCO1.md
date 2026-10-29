# 95 FINITEVISCO1 — 有限ひずみ粘弾性網と平衡網J2弾塑性の並列材料点で残留ひずみと散逸を検証する

## 開始条件

10月23日の共通指示 `D:/github/airpocket-soundman/airpocket-simulation-studio/docs/opencode-work-orders-2026-10-23/00-COMMON.md`の書式・規則に従う（そのファイルはprimary checkoutにあり、今回の作業では読み取り専用）。基準main `f16853a`（#218＝72、#234＝88を含む）。この1作業だけを実行し、親FINITEVISCO1全体の完成とは区別する。`src/progress.json`・共有roadmap・他番号の指示書は編集しない。

## 前提と読む順

既存成果: 72の合成Prony一軸材料点、88の乗法分解Hencky Prony材料点（`finite-visco-hencky-multiplicative.js`、F=FeFv、客観性と微小ひずみ極限を検証済み）、既存の微小ひずみJ2（`plasticity-core.js` の `j2Return`、等方硬化、後退Euler半径方向戻し）。88は粘性記憶のみで `permanentPlasticStrain:null`。

1. `docs/opencode-work-orders-2026-10-28/88-FINITEVISCO1.md` と証拠JSON
2. `src/finite-visco-hencky-multiplicative.js` と試験
3. `src/plasticity-core.js` の `j2Return`
4. `src/module-layers.json` のdomain層

## 実装・検証手順

1. 72・88を変更せず、新module `src/finite-visco-prf-j2.js` を追加する。粘性網は88の `stepFiniteViscoHencky` をそのまま使い、その平衡項 2μ dev ε(全) を平衡網の 2μ dev εe,p に置き換える。平衡網は F = Fe Fp、試行 be_tr = f be_p fᵀ、主対数空間のKirchhoff応力でJ2半径方向戻し（降伏 σy + Hκ、線形等方硬化）、体積成分は塑性流れなし。パラメータ・分岐数・伸び・J・dt/τの範囲は88と同じで広げない。σy∈[1,1e12] Pa、0<H≤10μ。
2. 一般F用 `initFiniteViscoPrfJ2`/`stepFiniteViscoPrfJ2` と一軸駆動 `runFiniteViscoPrfJ2Uniaxial`（側面σ22=σ33=0、保護付きsecant）を提供する。行に塑性軸対数ひずみ・相当塑性ひずみ・粘性散逸・塑性散逸（σyΔγ、`j2Return` と同じ慣例）を出す。
3. 結果は常に `synthetic:true / provisional:true / calibrated:false`。
4. 焦点試験: (a) 粘性分岐を完全緩和させた微小ひずみ極限（E11振幅1e-5、反転を含む）で `j2Return` の一軸応力解とσ11・相当塑性ひずみが一致し、3%では差が残ることを記録、(b) 時間変化する重ね合わせ回転で客観性、純剛体回転で応力・塑性流れゼロ、(c) 載荷・保持・部分除荷・保持・再載荷で側面無拘束、散逸単調、除荷中の塑性増分ゼロ、緩和と回復、再載荷は前回ピーク近傍まで弾性、仕事=貯蔵+散逸（2%以内）、(d) 塑性軸ひずみまで除荷して長時間保持すると応力がピークの1e-3未満（残留ひずみの意味の確認）、(e) 校正済み詐称・H≤0・余分な欄・範囲外・偽造状態の拒否と入力不変。
5. `src/module-layers.json` のdomain層へ登録し、`.d.ts` を追加する。証拠JSONを `docs/evidence/2026-10-29-opencode-95-finitevisco1.json` に保存する。

## 受け入れ条件

焦点試験・`npm run check:contracts`・`git diff --check`・docs試験・module境界試験が通る。証拠には基準SHA、合成パラメータ（K・μ・分岐は72/88と同じ合成値、σy・Hも合成値と明記）、代表ループの段端値、エネルギー収支、`j2Return` との比較（微小ひずみ極限と3%での実差）、試験コマンドと結果、未確認事項を記録する。材料定数・実測値を発明しない。

## 対象試験

```text
node --test tests/finite-visco-prf-j2.test.mjs tests/finite-visco-hencky-multiplicative.test.mjs tests/finite-visco-prony-uniaxial.test.mjs tests/module-boundaries.test.mjs tests/docs.test.mjs
npm run check:contracts
```

## 境界と納品

範囲外: 損傷・軟化、くびれ、移動硬化、速度依存塑性（粘塑性）、要素接線・Newton・構造反力統合、GUI/API/MCP、保存形式、実験校正、伸び範囲の拡大、PRF互換の主張。親の受け入れ（実験校正、構造経路、ダンベル、損傷）は残る。次の一歩候補: 一般Fの整合接線（数値差分照合）と単要素パッチ試験、または損傷変数の導入。進捗更新案のみ納品に添え、`src/progress.json` は編集しない。
