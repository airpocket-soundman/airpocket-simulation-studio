# 101 PRINTMEASURE3 — 合成曲線から小ひずみCAEパラメータを同定し、真値回復・不確かさ・拒否を検証する

## 開始条件

[2026-10-23共通指示](../opencode-work-orders-2026-10-23/00-COMMON.md)の書式と規則に従う。基準main `c3a73e6`（73・74・86 PRINTMEASURE、95 FINITEVISCO1 統合済み）。親PRINTMEASURE3（queued）の最初の一歩だけを実行し、親全体の完成とは区別する。実測データはまだ無いため合成データのみを使い、実測と称さない。`src/progress.json` は編集しない。

## 前提と読む順

63・73・74・86で、dataset取込契約（工学応力・ひずみへの正規化、provenance、校正は報告のみ）、試験機プロファイル照合、試験片3MF、試験片照合ができた。同定はまだ無い。FINITEVISCO1の材料点は並列で損傷追加が進むため変更しない。

1. `src/printed-measurement-dataset.js`（`importPrintedMeasurementDataset`、`accuracyVerified:false`）
2. `src/printed-specimen-link.js`、`src/printed-test-machine-profile.js`（所見と拒否の書式）
3. `src/finite-visco-prony-uniaxial.js`（Prony分岐の表現。今回は参照のみ）

## 実装・検証手順

1. 新module `src/printed-parameter-identification.js` を domain 層へ登録し、型 `src/contracts/printed-parameter-identification.d.ts` を追加する。
2. 入口 `identifyPrintedParameters(rawDatasetJson, options)` は生JSON文字列のみ受け取り、必ず `importPrintedMeasurementDataset` を通す（解析済みobjectは拒否）。
3. モデル: 線形弾性（原点通過最小二乗でE）、連続二直線弾塑性（E・降伏応力・接線係数、単調載荷のみ）、一分岐標準線形固体の応力緩和（E∞・E1・τ）。閾値（ひずみ窓、最小点数、許容相対標準誤差、接線比、保持ひずみ許容差）は呼出側必須で既定値を持たない。
4. 不確かさは最小二乗の標準誤差（二直線の降伏は折点の輪郭曲率を含む、緩和は3パラメータGauss-Newton共分散）。測定精度ではない。
5. 同定不能時は数値を返さず理由付きで `identified:false`（点数不足、降伏なし・窓端、標準誤差過大、緩和時間が観測窓外、非正の係数、非単調）。結果は常に `calibrated:false / accuracyVerified:false`。
6. 合成データ生成は試験fixture `tests/fixtures/printed-identification-synthetic.mjs`（既知パラメータ、seed付きGaussノイズ）に置き、productionへ入れない。

## 受け入れ条件

焦点試験で、3モデルの真値が標準誤差の4倍以内で回復、線形Eの2σ被覆が60 seed中51以上で散布/標準誤差比が0.7〜1.4、ノイズ10倍で標準誤差が約10倍、同定不能6例で拒否、不正dataset（crosshead、未文字列、合成の校正報告）と不正optionsの拒否、入力不変。証拠を `docs/evidence/2026-10-29-opencode-101-printmeasure3.json` に保存する。

## 対象試験

```text
node --test tests/printed-parameter-identification.test.mjs tests/printed-measurement-dataset.test.mjs tests/printed-specimen-link.test.mjs tests/module-boundaries.test.mjs tests/docs.test.mjs
npm run check:contracts
git diff --check
```

## 範囲外・未確認

実測曲線、校正・測定精度、有限ひずみ・多分岐Pronyの同定とFINITEVISCO材料点との照合、除荷・繰返しを含む弾塑性同定、同定値の `printed-equivalent-material` への受け渡し、UI/MCP接続。次の一歩候補: 同定値で `finite-visco-prony-uniaxial` を駆動し合成曲線を再現する往復検証、または同定結果を等価材料の `identified` 根拠へ結ぶ契約。進捗更新案は証拠JSONに添える。
