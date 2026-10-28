# 限定有限粘弾性の材料点reference

[English](en/finite-visco-reference.md) / [設計と一次資料](finitevisco-material-point-plan.md)

`src/finite-visco-reference.js`は、1branchの有限Green–Lagrange材料点を合成・暫定・未校正として計算するpure境界。`synthetic:true/provisional:true/calibrated:false`を固定し、製品solver、J2、Neo-Hookean、UI、API/MCP、project保存schemaへは接続していない。FINITEVISCO1の受入完了ではない。構成式は設計案の独自限定referenceで、原論文/PRF等の完全実装ではない。

```js
const state = initFiniteViscoReference({
  synthetic:true, provisional:true, calibrated:false,
  parameters:{bulkModulusPa:2e6, equilibriumShearModulusPa:1e6,
    branchShearModulusPa:5e5, relaxationTimeSeconds:2}
});
const trial = evaluateFiniteViscoReference({state, F:[[1,0,0],[0,1,0],[0,0,1]]});
const next = stepFiniteViscoReference({state, F:[[1.005,0,0],[0,1,0],[0,0,1]], dtSeconds:1});
// next.stateを次のstepへ渡す。trialは時間/状態を進めない。
```

全3APIはexactなdata fieldsだけを受理する。stateは深いfreezeと非公開WeakMapの発行由来で検証し、初期はI/Z=0。版/単位/parameterを改変したcopy、JSON clone、他module発行stateは拒否する。**再開は同じmodule instanceの発行済みstateに限る。永続JSONのrestore/replayは未実装**であり、hashを書換えただけの偽履歴を認めない。旧stateから分岐する参照計算は可能。祖先stateや全historyは内部保持しない。計画の全history入出力APIを今回は作らず、state単体1MiB、最大4096stepに限定した。

F/C/E/Zは3×3テンソルでengineering shearを使わない。ψはJ/m³-reference、DはW/m³-reference、work/dissipation incrementはJ/m³-reference。S/P/σはそれぞれsecond Piola/first Piola/Cauchy、単位Pa。物理反力N、試験片断面、応力自由試験片の変形は計算しない。E=(FᵀF−I)/2、H=devE、ψ=K(trE)²/2+μ∞H:H+μ1(H−Z):(H−Z)、Zdot=(H−Z)/τ。S=∂ψ/∂E、P=FS、σ=FSFᵀ/Jを返す。

stepは**E-linear path**。F端点を線形補間した履歴と異なる。Cのendpoint固有値が共通区間内なら凸性で全E-linear区間も同範囲、従ってJも[.95³,1.05³]に収まる。任意空間回転QでF→QFとしてもmemory/energy/Dは不変で、P/σは正しく回転する。

実装は `x=dt/τ` が1e-6〜1e6のみ。範囲外・0dt・非増加/非有限時間は計算前拒否。K,μ∞,μ1は1〜1e12Pa、τは1e-6〜1e6s、2/3≤K/μ∞≤3、0<μ1/μ∞≤1、累積時間≤1e9s。主伸長.95〜1.05（C固有値検査に1e-14の丸め余裕）、J.85〜1.16、反転/特異/非有限Fは拒否。これらは数値scopeで物理精度やStVK型の安定性保証ではない。圧縮下の強楕円性喪失とJ→0障壁欠如は設計文書のまま制限として残る。

exact memory updateはexpm1と小x級数を使う。散逸積分はcompleted-squareの非負Gram形式で評価し、負値clampをしない。仕事は別のstress-path積分式から求め、Δψ+ΔDとの誤差を `1e-10+1e-10*scale` で検査する。失敗時に入力や最後のstateを変えない。全historyやstateのserialized再生を成功扱いにしない。

独立検証はSimpson2000分割によるS:Edot/D積分、保持指数解、長時間rampの別primitive、9成分のenergy Richardson差分とP、時間依存大回転/参照基底変換/非共軸履歴、同じE-linear pathの分割同値、滑らかな曲線の刻み収束、stress-free reduced recovery、4096stepと不正/改ざん/型の拒否を含む。四次energyに対してh=1e-4/5e-5のRichardson差分を用い、Pを1e-6Pa+1e-10相対で照合する。

[数値証拠](evidence/2026-10-23-finite-visco-reference.json)は実行環境、実測、期待値、限定範囲を保持する。完全緩和で回復する純粘弾性のため永久塑性、降伏/損傷/くびれ/破断、FDM/実材料の予測、実験校正、構造solver、製品公開は未実装/未検証。

入力 F は通常の Array.prototype を持つ密な 3×3 配列に限定する。Array 派生型や独自 prototype は拒否し、呼出側配列のメソッドを経由した所有権の漏出や凍結を防ぐ。
