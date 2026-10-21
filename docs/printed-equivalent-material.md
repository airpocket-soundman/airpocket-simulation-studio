# 印刷条件付き等価異方性材料

[English](en/printed-equivalent-material.md)

2026-10-21。PRINT2の限定単位として、既存 `materialProperties.orthotropic` に `printedEquivalent` 根拠recordを関連付ける。材料同定・実測・層/壁/インフィルの詳細解析を実装したものではない。PRINT2全体はbuildingのまま。

recordはschemaVersion1、model=`equivalent-orthotropic`、id、units、specimen、material、printer、print、constants、basis、validityを持つ。`tests/fixtures/printed-equivalent-material.mjs` は全項目を持つ合成例で、実在機種・物理試験・測定値を表さない。

- unitsはlength=mm、modulus=Pa、direction=1、temperature=degC、strainRate=1/s、fraction=1を明示する。欠損/他単位を推測変換しない。
- specimenはidと3寸法mm、materialはname/batch、printerはmodel。printは単位buildDirection、layerHeightMm、wallCount、wallThicknessMm、infillFraction、infillPattern。未知wallThicknessMmは明示nullのまま保存し、壁数から推定しない。
- constantsはyoungModuliPa、poissonRatios、shearModuliPa、axesを既存orthotropicと完全一致させる。既存の右手直交軸/正定値検査を再利用し、材料変更後の古い根拠recordを拒否する。
- basis.kindはtheoretical、assumed、identified。sourceとidentification/independentValidationを明示する。理論/仮定はidentification=nullで、測定同定を装わない。identifiedのdatasetはid/revision/specimenIdsを持ち、同定用試験片を含む。独立検証datasetは同定と異なるidと試験片を必要とする。revisionは各dataset内の版なので同じv1等を許可する。これは宣言された参照の整合検査であり、原測定データの認証ではない。
- validityはtemperatureRangeC、strainRateRangePerSecond、layerHeightRangeMm、infillFractionRange。造形条件が範囲外なら拒否し、静的構造の速度0と明示study.materialTemperatureの適用範囲も検査する。動的/熱応力への転用はしない。

正規材料validatorとproject保存/loadでrecordを確認し、preflightは `PRINTED_EQUIVALENT_INVALID` で拒否理由を示す。Workerの実材料評価でも温度/速度範囲を再確認する。旧recordなし異方性入力は既存動作を維持する。

`materialProperties.printedStructure` は明示壁/インフィルモデル用の予約拒否境界。現時点で明示モデルsolverは未実装のため単独でも拒否し、printedEquivalentとの併用も拒否する。等価剛性と明示構造の二重加算経路は作らない。3MF/G-codeの表示/取込は変更しない。

[検証証拠](evidence/2026-10-21-printed-equivalent-material.json)。合成10×10×40mm棒、Ez3e9Pa、100Nの理論変位0.04/3mmと反力-100Nを実Workerで検証。保存→archive→復元→再計算で変位、9定数、軸、recordIDを照合する。校正精度・実造形の精度保証ではない。

残作業は実機/材料batch/積層方向/温湿度/層高/壁厚/インフィルを記録した試験片、校正した力・変位・寸法計測、生の応力ひずみと機器版、同定手順/版、有効範囲、同定に使っていない独立試験片と不確かさの取得。詳細壁/層/インフィルモデルと実測比較は未完。測定値は今回提供されていない。
