# 別試験片の予測誤差（限定・読取専用）

[English](en/printed-parameter-holdout.md)

`comparePrintedHoldoutPrediction({rawTraining, rawValidation, options, specimenPairs})` は、訓練JSONだけに既存 `identifyPrintedParameters` を一度適用し、その試験片ごとの係数で別JSONの応力を予測する。検証JSONを再同定せず、試験片間の平均係数も使わない。`specimenPairs` は `{trainingSpecimenId, validationSpecimenId}` の明示配列で、両JSONの全試験片を重複なく一対一で指定する。dataset IDと原文SHA-256はそれぞれ別で、試験片IDの集合も重複を許さない。

分離は記録上の宣言だけである。複製した曲線のIDを書き換えた可能性や、物理的に独立した製造・測定は検証できない。結果は常に `independence:'declared-only'`, `physicalIndependenceVerified:false`, `calibrated:false`, `accuracyVerified:false`。`status:'compared'` は誤差を算出したことだけを表し、合格や材料精度の保証ではない。合否閾値、材料自動適用、UI/CLI/MCP接続を追加しない。

記録条件は正規化後の造形方向、温度、速度、寸法3値、標点長、batchを**完全一致**で要求する。丸め許容差やbatch差を推測しない。機器・校正報告は同一性や精度の証明に使わない。双方のprovenanceはそのまま返し、実測と申告された入力も検証済みとは呼ばない。

## 初期の対応範囲

- 線形・二直線は全点が非負・窓内で、ひずみは厳密増加とする。先頭のひずみ0は応力0の明示原点だけを許す。保持・除荷・繰返し・窓外点を黙って除かない。検証片のひずみ範囲は訓練片の観測範囲内に限り、外挿しない。
- SLSは先頭にひずみ0・応力0の点を1つ置き、その次の点で理想的なstepが入ったという**宣言**に限る。以降のひずみは正で完全に一定。訓練は少なくとも `max(4,minPoints)` 保持点、検証は少なくとも2保持点を要する。実際のstep速度・装置応答は検証しない。検証の振幅と保持経過時間は訓練の観測上限内に限る。保持開始時刻が異なっても、それぞれ最初の保持点を経過時間0として使う。
- raw・対応・条件・履歴の不整合は `PRINTED_HOLDOUT_INVALID` と理由で全体を拒否する。訓練の係数が同定不能なら、そのpairに `training-not-identified` と元の同定理由だけを返し、係数・誤差を発明しない。非有限予測・誤差もpairを拒否する。

予測は線形 `E ε`、二直線の連続区分式、または保持SLS `ε_hold(E∞+E1 exp(−elapsed/τ))`。検証の全点について `residualPa=predictedStressPa−observedStressPa` とする。biasは符号付き平均、MAEは絶対値平均、RMSは二乗平均平方根、maxabsは絶対最大値。countは**原点anchorを含めた全検証点数**であり、SLSの0応答anchorも黙って除かない。全値はPaで、時刻はs、工学ひずみは無次元。異なるpairの誤差は勝手に集約しない。

## 境界と検証

各原文はUTF-8で2,000,000 bytes、最大100 pairs、両datasetを合わせて10,000 samples、結果は4,000,000 bytesまで。optionsとpair配列は最初のawait前にown enumerable data/密な通常配列から複製する。getter・独自iterator・疎配列・余分な欄を拒否する。返却結果は深く凍結し、原文・入力・プロジェクトを変更しない。既存正規化APIを通すため、応力/ひずみの単位と容量条件はその契約も維持する。

独立解析試験は、検証片だけ傾きが違う線形、再同定に必要な点数を持たない二直線検証片、異なる開始時刻/振幅の保持SLSで、予測とPa誤差を閉形式から照合する。ID順序反転、条件不一致、全点履歴拒否、await中の差替え、訓練digest2回/検証1回（検証再fitなし）、100 pairsと合計10,000点の境界も検査する。[固定記録](evidence/2026-11-04-printed-parameter-holdout.json)。構造解析、実測精度、物理的独立性、校正、一般履歴/有限ひずみへの適用、公開、PRINTMEASURE3親の完成は未確認である。
