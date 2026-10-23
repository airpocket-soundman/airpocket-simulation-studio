# 保存可能な平面熱流転送演算子

[English](en/planar-heat-operator.md)

COUPLE3の限定後続、基点 `8c902f3`。`src/planar-heat-operator.js` は既存の非適合平面熱流積分を、保存/再読込して繰り返し適用できる版1の演算子へ進める。温度・流れの反復solver、任意のsource節点場、物性同定、GUI/API接続、実測検証は実装しない。

入力geometryは厳密に `{units:'mm',mesh:{nodes},sourceFaces,targetFaces}`。面は `{nodes:[a,b,c]}`、両側は別の節点集合と反対向き外向き法線を必要とする。平面上の完全一致被覆に限定し、部分被覆・隙間・重複・同向法線・非平面・不正単位・未対応fieldを拒否する。既存の平面許容1e-6 mm、被覆相対許容1e-6を固定し、保存recordから緩和できない。

`buildPlanarHeatTransferOperator(geometry)` は4つのglobal基底 `1,x_m,y_m,z_m` を既存積分器へ通し、各target節点の4係数とsource総熱量の4係数を作る。適用できる熱流は定数、または `q=base+gradient·position_m` のglobal一次場だけ。baseはW/m²、gradientはW/m³、出力は節点荷重Wであり熱流密度ではない。二次場、局所枠、係数不明の補間は推定しない。

演算子はschemaVersion、kind、単位、基底、許容、面積、両側の幾何版、係数、operatorRevisionを持つ。両側の幾何版は選択した面の順序・向き・節点ID・参照座標をそれぞれSHA-256で同定する。選択に無関係な未使用節点はこの版に含めない。operatorRevisionは自分自身を除くrecordのcanonical JSON hash。hashは内容の同一性であり、発行元の認証や署名ではない。

`serializePlanarHeatTransferOperator(op)` は検査済みで深くfreezeした演算子をcanonical JSONへ出力する。`loadPlanarHeatTransferOperator(raw,geometry)` は容量/hash/版を確認し、指定geometryから係数を再構築してrecord全体を比較する。係数改ざん後にhashだけ再計算しても拒否する。JSON.parseしただけの任意objectは適用できず、build/loadを必ず通す。再構築はreload時に行い、その後の適用は係数の積和だけで、重なり積分を再実行しない。

`applyPlanarHeatTransferOperator(op,geometry,flux)` は毎回source/targetの幾何版を確認し、古いgeometryへの適用を拒否する。入力はhash await前にsnapshotする。source外向きとtarget外向きの和を保存則として確認する。許容は絶対1e-18 W＋係数項の絶対値和に対する相対1e-12で、ゼロ総量/符号変化でも相対差の分母ゼロや強制正規化を作らない。非有限の中間積和は拒否する。

容量は4,096節点、各側512面、座標絶対値1e6 mm、入力geometry/保存JSON各1MiB。列挙前に全体のsource/target境界boxが許容内で一致することも必要とする。これにより、等面積でも極端に細長い非一致形状が旧積分器の空間gridを巨大列挙することを防ぐ。上限をrecordで上書きできない。

合成1 mm²・平均2 W/m²を別分割へ移し、全target節点を独立P1式 `A(2qi+qj+qk)/12` と比較、総熱量2e-6 Wを確認した。保存/再読込、回転/平行移動、符号反転、ゼロ総量、幾何変更、再hash改ざん、容量超過、overflowも検査。focused17件、型宣言/実module型fixture、日英文書、差分検査が成功。[証拠](evidence/2026-10-23-couple3-persisted-operator.json)に実recordと節点荷重を保存する。実ブラウザー・全連成・実測の合格を意味しない。
