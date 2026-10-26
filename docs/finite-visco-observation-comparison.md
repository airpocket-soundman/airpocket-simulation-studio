# 有限材料点の最終合成観測比較

[English](en/finite-visco-observation-comparison.md) / [入力履歴replay](finite-visco-input-history.md)

`compareFiniteViscoFinalObservation(historyRaw, observationRaw)` は製品非接続のpure境界。既存履歴をI/Z0から一度replayし、**最終時刻の合成観測1件だけ**と比較する。任意時刻・補間・近傍時刻・時刻補正・全観測列・state restore・構造solver・材料fit/校正を追加しない。元reference/replay APIや保持量は変更していない。

両引数はUTF8のprimitive stringまたは通常Uint8Array。各1MiB、深さ16、値100000、文字列1024、array4096の既存限定patternを用い、重複decoded key・未知field・非有限指数・巨大数・不正UTF8を拒否する。object・Buffer/派生型・SharedArrayBufferは拒否。両rawを最初のawait前にintrinsic copyし、own buffer/byteLength accessorを呼ばず、prototype偽装sharedもbrand検査で拒否する。呼出後の変更を計算やhashへ混ぜない。元入力は成功/失敗とも変更しない。

観測JSONのexact fields:

```text
schemaVersion: 1
kind: finite-visco-final-synthetic-observation
model: synthetic-green-lagrange-maxwell-reference-v1
synthetic: true, provisional: true, calibrated: false
units: {time:s, stress:Pa, energyDensity:J/m3-reference}
historyIdentity: {rawIdentity:sha256:..., canonicalIdentity:sha256:...}
parameterRevision: sha256:...
timeSeconds: 最終dt累積値（完全一致）
origin: {kind:synthetic-reference, description:空でない説明}
values: {S:3x3, energyDensity:非負有限値,
         cumulativeDissipationDensity:非負有限値}
```

Sはsecond Piolaの全9成分、engineering shearやCauchy stressではない。historyIdentityは既存replayが返すraw/canonicalの双方へ完全一致を要求する。空白だけ異なるhistoryもrawが違うので観測を流用しない。parameterRevisionはreplayが実際に使ったparameter objectのcanonical JSON（辞書key辞書順、末尾newlineなし）UTF8 SHA-256を**再計算**する。元reference stateの内部parameterRevision文字列とは別定義である。観測の自己申告hashを信用しない。hashとorigin.descriptionは署名・真正な由来・実験校正の証明ではない。

成功は `completed:true/status:compared`。観測−再計算のS差全9成分と最大絶対成分差をPaで返す。energyDensityと累積散逸の符号付き差/絶対差をそれぞれJ/m³-referenceで返し、応力と一つの最大値へ混ぜない。合否threshold・相対誤差除算・calibrated/pass判定はない。synthetic/provisional/calibrated:falseは固定。履歴や全state/観測列を返さない。

構造的に不正なrawは安定code付き例外。履歴constitutive失敗は `completed:false/status:history-rejected` と元failureのcode/stepIndex/completedStepsだけを保持し、比較結果を返さない。成功履歴のidentity/parameters/time不一致は `FINITE_VISCO_COMPARISON_HISTORY_MISMATCH` / `PARAMETERS_MISMATCH` / `TIME_MISMATCH` で拒否する。時刻許容を設けず、失敗段階を補間しない。

独立shear E-linear rampの指数解析式でS12・energy・累積Dを照合し、既知の±応力/energy差、raw/canonical/parameter/time不一致、byte境界・late mutation・getter非実行・shared偽装・strict JSON・途中失敗を回帰する。[証拠](evidence/2026-10-24-finite-visco-observation-comparison.json)。これは合成材料点の数値比較であり、実材料/応力自由試験片/反力/永久塑性/損傷/くびれの検証ではない。solver/UI/MCP/project保存へ接続せず、FINITEVISCO1の完了を意味しない。


2026-10-27追補: 初版の製品非接続は当時の境界の記録。pure API/構成則/入力契約は変更せず、[最終合成観測比較UI](finite-observation-inspector.md)から所有Workerでこの関数を呼ぶ入口を追加した。構造solver、MCP、project保存、実測校正へは接続しない。
