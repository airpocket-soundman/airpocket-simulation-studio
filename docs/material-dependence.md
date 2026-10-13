# 材料の温度・速度・方向性

[English](en/material-dependence.md)

材料物性の詳細欄で「温度・速度・方向性のデータ」を登録します。プロジェクトとケース集にも保存されます。値はSI単位です。ヤング率Pa（通常の入力欄はMPa）、温度°C、ひずみ速度1/sです。

```json
{
  "elasticTemperatureTable": [
    {"temperature": 20, "youngModulus": 1000000000, "poissonRatio": 0},
    {"temperature": 80, "youngModulus": 500000000, "poissonRatio": 0}
  ],
  "strainRateMin": 0,
  "strainRateMax": 1,
  "rateDependent": false,
  "directionality": "isotropic",
  "testConditions": "仮想の参照材料。実部品の設計値ではありません。"
}
```

一様温度の構造解析では、表のヤング率とポアソン比を区分線形補間します。温度は昇順で2〜100行。表の外への補外を拒否します。熱応力を使わない場合は「物性を評価する一様温度」、熱応力を使う場合は部品温度を使用します。温度分布を転送した場合、表を使えるのは全節点が同温度の場合だけです。非一様の温度依存剛性、温度に依存する熱伝導率・膨張係数の積分は未対応です。

Airpocket JS/WASM、WebGPUのCPU補正経路、MFEMはいずれも評価された弾性定数を受け取ります。結果に評価温度と補間値を表示します。100 Nを受ける10×10×40 mmの柱で、50°C・750 MPaなら軸変位0.053333 mmが参照値です。この表は試験値を代替しません。

既存の有効温度上下限を構造解析の使用温度と熱解析の全ステップの温度範囲に照合します。構造静解析のひずみ速度は0として登録範囲に照合します。`rateDependent: true` または `directionality: "orthotropic"` の構造計算は拒否します。これらの構成則の計算はまだ実装していません。

直交異方性の記録には `axes: [[1,0,0],[0,1,0],[0,0,1]]` のような全体座標の単位ベクトル3本が必要です。直交性と右手系を検証します。試験条件は自由記述で、試験規格や湿度、測定速度、方向を記録できます。熱解析にはこの機械的方向性を適用しません。

自動検証: `tests/material-dependence.test.mjs` と `tests/worker-pipeline.test.mjs`。APIでは `setMaterialProperties({..., dependence: ...})` と `setStudy({kind:"structural", materialTemperature:50})` を使用します。無効な登録は元のプロジェクトを変更しません。
