# 温度L2投影の独立監査

[English](en/temperature-l2-independent-2026-10-26.md)

固定owner `fe30a121716735bc1ca217b674aaf7cafa339205`。中心1/角0の四三角形fanを、対角線ACの二三角形へ移す非affine問題で、consistent mass `M=(A/24)[[4,1,2,1],[1,2,1,0],[2,1,4,1],[1,0,1,2]]` とcross-load `b=A[1/8,1/24,1/8,1/24]` を独立固定式で検算した。解は `[.5,0,.5,0]`、積分はA/3。point samplingの全0やlumped massの `[.375,.25,.375,.25]` と区別できる。

出力だけでなくM/bそのものを照合し、寸法10倍の面積100倍、平行移動/斜平面回転、非affine場への273.15定数offset、m2積分を検査した。self-rehashしたmass/cross/conditioning/source-target weightsの改ざんも再導出で拒否する。新3+owner10=13成功・失敗/skip0、docs2成功。source SHAは[証拠JSON](evidence/2026-10-26-temperature-l2-independent.json)。source修正は不要だった。

全面被覆・平面・連続P1のスカラー温度に限る。coupled solve、実測校正、positivity-preserving投影の保証ではない。既存coverage/conditioning境界を緩めず、solver/GUI/codec追加0、進捗変更なし。

再現: `node --test tests/planar-temperature-operator-independent.test.mjs tests/planar-temperature-operator.test.mjs`。
