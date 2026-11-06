# 測定条件別の同定集計

[English](en/printed-identification-groups.md) · [同定UI](printed-identification-ui.md)

既存の同定画面は試験片の個別結果に加えて、条件別の集計を表示します。方向・温度・速度・ロット・寸法・標点長が異なる場合、混在した全体平均は表示せず条件別を見るよう案内します。材料値の変更や解析は行いません。

`identifyPrintedParametersByCondition(rawDatasetJson, explicitOptions)` は既存の `identifyPrintedParameters` と測定JSON parserを使います。返却する `identification` は既存結果（全体acrossを含む）と同じです。新しい `grouping` だけがnormalized記録のbuildDirection、temperatureC、speedMmPerSecond、batch、dimensionsMm、gaugeLengthMmで群を作ります。数値はObject.isで比較し、許容差・丸め・方向の同一視をしません。負のゼロも保持します。違う入力単位が同じ正規化値になれば同じ条件です。

各群の同定できた試験片だけから平均と標本標準偏差を計算します。1片では標準偏差をnull（不明）とし、0にはしません。同定できない片には理由だけを残し、係数を補いません。全片が未同定の群のstatisticsもnullです。標準偏差は試験片間の散布であって、パラメータ共分散や測定精度ではありません。calibrated / accuracyVerified / covarianceAccuracyVerifiedは常にfalseです。

最大100群・100片・各モデル3係数。元の2MB/総10000点・二直線512窓内点上限を維持します。原文SHA/model/明示条件を群報告へ束縛し、平均は割った項を加算、標準偏差はscaled hypotで有限性を確認します。worker/UIは全片の一意所属、条件形式、返信の原文/モデル/条件一致、各群の個別係数から再計算した統計、null意味を検査します。既存の取消・世代・SHA1枠・10秒worker・保存URL規則は維持します。

実測・校正・独立検証は追加していません。親PRINTMEASURE3全体の完了ではなく、既存の合成同定を条件混在なしで読むための限定増分です。

[検証証拠](evidence/2026-11-04-printed-identification-groups.json)


UIは占有中の準備枠で元JSONを既存importerにより正規化し、条件metadataだけをsnapshotして全memberを元条件と照合します。範囲内でも20°Cを999°Cへ差し替える返信、所属の入替え、出典表示の差替えは拒否します。準備の実完了まで同じSHA1枠を保持し、重い同定は引き続きworkerで処理します。
