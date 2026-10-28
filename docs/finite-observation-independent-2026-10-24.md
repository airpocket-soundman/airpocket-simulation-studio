# 最終合成観測比較の独立監査

[English](en/finite-observation-independent-2026-10-24.md)

固定owner `1eef75a6dae30ba7f20c7f806602f6dbf7024d6f`。ownerのせん断oracleと別に、静水圧Greenひずみ `E=eI` の2段ramp/holdを用いた。`dev(E)=0` なのでMaxwell内部変数・散逸は0、`S=3KeI`、参照体積当たりエネルギーは `K(3e)^2/2`。production model/replayをoracleとしてimportせず、非ゼロbulk応答を独立計算した。

新3回帰はこの閉形式、非対称成分の符号付き誤差とエネルギー/散逸の分離、raw形式差とcanonical同一性、同一caller bufferのoffset付き2viewをawait前に所有しgetterを実行しないことを確認する。owner6回帰と計9成功、失敗/skip0。初版fixtureのK/mu=3.75は既存範囲外で正しく拒否されたため、muを1e6（比3）へ修正した。製品修正・閾値緩和はない。

source監査ではraw/canonical/parameter hash、time完全一致、unit/provenance固定、unknown/measured/calibrated拒否、失敗stepIndex保持/no comparisonを確認した。source SHAと詳細は[証拠JSON](evidence/2026-10-24-finite-observation-independent.json)。実測、構造反力、塑性、fit、校正、許容差の合否へ拡張しない。solver/GUI/codec追加0、進捗変更なし。

再現: `node --test tests/finite-visco-observation-independent.test.mjs tests/finite-visco-observation-comparison.test.mjs`。
