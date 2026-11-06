# チャネル接線壁の時間平均力連成

COUPLE5/102の合成検証用に、`src/fsi-channel-average-force.js` の `runChannelAverageForce` を追加しました。旧 `runShearPlateCoupled`、チャネルsolver、ベクトルAitkenの挙動は変更しません。この方式は周期x・x一様・非圧縮laminarチャネルと、接線方向に滑る線形ばね質量板だけを対象にします。実測校正・法線壁・圧力連成・ALE・一般FSI・UI/worker/MCPへの接続はありません。

入力は `schemaVersion:1`、`method:'time-averaged-midpoint'`、既存fluid物性、`plate:{mass,stiffness}`、`initialDisplacement`、`dt`、`steps`、`microsteps` と任意のdense Array `initialProfile` です。初期板速度は0です。SI単位は長さm、時間s、密度kg/m³、動粘度m²/s、板の面密度kg/m²、ばね剛性N/m³、せん断力Pa、面積当たりエネルギーJ/m²です。Float64Arrayや疎配列・indexed accessorはこのJSON入力境界では拒否します。独自iteratorは呼びません。

各macrostepで板の平均速度 `V=(v0+v1)/2=(d1-d0)/dt` を壁速度として一定に保ちます。実 `channelShearFluid.advance` を有界microstepごとに呼び、各microstep端の壁せん断を台形積分して `I=∫Fdt` を近似し、板には平均力 `I/dt` を渡します。板の式は `m(v1-v0)/dt+k(d0+d1)/2=I/dt` です。線形・x一様応答に限定するため、0とprobe速度の実solver応答からaffine係数を求め、最終速度でも再計算して相対力残差を検査します。これは一般非線形FSIの反復収束や安定性の証明ではありません。

板が受ける界面仕事 `V I` と流体が受ける仕事 `-V I` は同一の積から計算します。板のmidpointエネルギー恒等式には丸め誤差だけが残ります。一方、流体のSSP-RK3と台形せん断・散逸積分には有限の時間積分誤差が残るため、総エネルギーを厳密保存したとは呼びません。`fluidEnergyDefectJPerM2`、`plateEnergyDefectJPerM2`、総欠損、下壁impulseを含む面積当たり運動量欠損を別々に返し、欠損をゼロへclampしません。半離散散逸率は両壁の半セル勾配と全内部面差分を含みます。

1回の呼出上限はmacrostep4096、microstep4096、全3応答を含むcell-step2000000です。各microstepは既存solverの粘性安定制約でさらに分割します。保存するのはfreezeされた `result.input` の初期入力だけです。JSONで読み戻し、最初から全計算を再実行します。出力profile/history/claimed energyを入力へ混ぜた復元は拒否します。`synthetic:true,calibrated:false` は固定です。ゼロ初期エネルギーの平衡は相対欠損0とし、非平衡のunderflowや非有限値は拒否します。

独立検証は直接記述した半離散一体RK4、1microstepの拡散行列SSP-RK3多項式、仕事交換・運動量・散逸、macro/micro刻み半減です。小格子の合成問題で変位・散逸・エネルギー欠損が二次収束することを確認します。旧102の一次欠損証拠は歴史として保持し、新方式の改善を旧方式の変更や一般条件での精度保証へ読み替えません。詳細数値は [2026-11-07証拠](evidence/2026-11-07-couple5-average-force.json) を参照してください。

[English](en/fsi-channel-average-force.md) / [旧102監査](fsi-channel-shear-plate-audit-2026-11-04.md)
