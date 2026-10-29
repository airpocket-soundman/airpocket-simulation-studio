# 100 FINITEVISCO1 — 粘弾性網＋J2平衡網の材料点に等方スカラー損傷を加え荷重低下と除荷剛性低下を検証する

## 開始条件

10月23日の共通指示 `D:/github/airpocket-soundman/airpocket-simulation-studio/docs/opencode-work-orders-2026-10-23/00-COMMON.md`の書式・規則に従う（そのファイルはprimary checkoutにあり、今回の作業では読み取り専用）。基準main `c3a73e6`（#218＝72、#234＝88、#242＝95を含む）。この1作業だけを実行し、親FINITEVISCO1全体の完成とは区別する。`src/progress.json`・共有roadmap・他番号の指示書は編集しない。

## 前提と読む順

roadmap FINITEVISCO1節の「荷重低下・破断は損傷/軟化として別々に構成」に沿う。既存成果: 72の合成Prony一軸、88の乗法分解Hencky Prony、95の粘弾性網＋J2平衡網（`finite-visco-prf-j2.js`、損傷なし）。

1. `docs/opencode-work-orders-2026-10-28/95-FINITEVISCO1.md` と証拠JSON
2. `src/finite-visco-prf-j2.js` と試験
3. `src/module-layers.json` のdomain層

## 実装・検証手順

1. 72・88・95を変更せず、新module `src/finite-visco-damage.js` を追加する。ひずみ等価仮定でτ = (1−d) τ_eff とし、有効応答は95の `stepFiniteViscoPrfJ2` をそのまま使う。駆動力Y＝有効貯蔵エネルギー密度、履歴 r = max Y、指数則 d = 1 − exp(−⟨r − Y0⟩/Yf)。dは[0,1)で単調非減少。Y0・Yf∈[1e-6,1e12] J/m3。
2. 散逸の帳簿: 粘性・塑性増分は (1−d_{n+1}) 倍、損傷散逸増分は Y_mid Δd（台形）。仕事＝(1−d)ψ_eff＋粘性＋塑性＋損傷散逸。
3. 一般F用 `initFiniteViscoDamage`/`stepFiniteViscoDamage` と一軸駆動 `runFiniteViscoDamageUniaxial` を提供する。ひずみ等価のため側面無拘束条件は有効応力で同値になり、95の一軸経路を一度解いて行ごとに損傷を適用する。
4. 結果は常に `synthetic:true / provisional:true / calibrated:false`、`regularization:'none-local-material-point-mesh-dependent'`。
5. 未対応組合せ（特性長さ・破壊エネルギー・regularization・引張圧縮分離・要素削除・速度依存損傷）は名前で拒否する。
6. 焦点試験: (a) 単調引張で閾値以下は95と同一、荷重ピーク後に低下（最終/ピーク < 0.2）、dの単調性と[0,1)、側面無拘束、仕事収支2%以内、(b) 高速分岐で部分損傷後の除荷勾配が無損傷の(1−d)倍、除荷と履歴未満の再載荷でd不変、超過後に再成長、(c) 重ね合わせ回転で客観性、純剛体回転でd=0、(d) 未対応組合せ・校正済み詐称・範囲外・余分な欄・損傷欄欠落・偽造状態の拒否と入力不変。
7. `src/module-layers.json` のdomain層へ登録し、`.d.ts` を追加する。証拠JSONを `docs/evidence/2026-10-29-opencode-100-finitevisco1.json` に保存する。

## 受け入れ条件

焦点試験・`npm run check:contracts`・`git diff --check`・docs試験・module境界試験が通る。証拠には基準SHA、合成パラメータ（K・μ・分岐・σy・Hは72/88/95と同じ合成値、Y0・Yfも合成値と明記）、単調載荷のピークと代表行、エネルギー収支、除荷勾配比、試験コマンドと結果、未確認事項を記録する。材料定数・実測値を発明しない。

## 対象試験

```text
node --test tests/finite-visco-damage.test.mjs tests/finite-visco-prf-j2.test.mjs tests/finite-visco-hencky-multiplicative.test.mjs tests/finite-visco-prony-uniaxial.test.mjs tests/module-boundaries.test.mjs tests/docs.test.mjs
npm run check:contracts
```

## 境界と納品

範囲外: メッシュ依存の正則化（特性長さ・破壊エネルギー・クラックバンド・非局所/勾配損傷）— 局所損傷のため構造に入れると軟化はメッシュ依存になることを明記する。引張圧縮分離、異方性損傷、要素削除・破断判定、要素接線・Newton・構造反力統合、くびれ、GUI/API/MCP、保存形式、実験校正、伸び範囲の拡大。親の受け入れ（実験校正、構造経路、ダンベル、正則化）は残る。次の一歩候補: 一般Fの整合接線と単要素パッチ試験、またはクラックバンド正則化（要素特性長さでYfを尺度化）の導入。進捗更新案のみ納品に添え、`src/progress.json` は編集しない。
