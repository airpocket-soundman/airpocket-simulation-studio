# 明示平面グループの温度P1 L2転送

[English](en/grouped-temperature-operator.md) · [単一平面の温度投影](planar-temperature-operator.md) · [熱流束P1](planar-p1-heat-operator.md)

`grouped-temperature-operator.js`は、利用者が明示した有限個の平面三角形グループに対するpure温度転送である。各グループは平面かつ完全被覆で、複数グループは折れ面や離れた面片を表せる。形状からグループを推定せず、滑らかな曲面、部分被覆、熱接触/連成solver、GUI、実測/校正を追加しない。`solverConnected:false`。

入力は `{units:'mm',mesh:{nodes},sourceFaces,targetFaces,groups}`。nodesは全体で共通の平坦なxyz配列、faceは `{nodes:[globalId0,globalId1,globalId2]}`、groupは `{groupId,sourceFaceIds,targetFaceIds}`。face IDはそれぞれのface配列の0始まりindexである。全source/target faceがちょうど一グループに所属し、unknown/欠落/重複を拒否する。groupIdは一意なASCII英数字/underscore/hyphenの1〜64文字。グループと所属faceの列挙順は正規化するが、全体face順とwinding、global node IDを保存する。座標が一致しても別IDを勝手にweldしない。

既存単一平面APIで各groupのfull coverage、planarity、対向法線、同側重複、面積/容量/finiteを検証する。さらに、同じ側の別group間の三角形を有界に比較する。coplanar面積重複を拒否し、異平面交差は共有global node/edge ID上だけ許す。別IDの点/辺接触、内点交差を拒否する。接触距離の数値許容は1e-6mm、coplanar判定のnormal内積差は1e-10、面積重複floorは1e-12mm²+1e-12×小さい三角形面積である。不安定な三角形交差計算は拒否する。これは既に三角形化された明示集合の限定検査であり、一般CADの修復や滑面交差検出ではない。

グループgの面積A_gで正規化済み行列をもとへ戻し、global IDの行/列へscatter加算する。全体面積Aで再正規化した `M=Σ A_g/A M_g`、`T=Σ A_g/A T_g` を一度だけCholeskyで解き `θ_B=M^-1 T θ_A` を作る。共有節点を別々に投影して平均する方式ではない。source/target各global active IDへ温度は一つで、targetの共有節点は全グループの質量項に参加する。温度scalarは法線反転で符号を変えない。面積のmm²→m²変換は既存local演算子で行い、global組立では面積比を使う。

予算はgroups1〜8、全mesh4096節点、total512faces/side、global active128nodes/side、dense M/T/R各最大16384係数、1MiB rawJSON、graph200000値/depth20、文字列1024字。既存local予算も維持する。global κ∞上限1e10を全体行列に適用し、localが安定でも面積差でglobalが不安定なら拒否する。非正定値/非有限/overflow/残差超過を拒否し正則化しない。compile残差は1e-12×max(1,|Tij|)、apply残差は1e-10×max(1,|θ|)、積分差は後者×全体面積。

fieldはglobal source active各節点へ一つずつの `{units:'degC'|'K',values:[{nodeId,value}]}`。field全体で単位一つ、混在/暗黙変換/重複/未所属を拒否する。入力の絶対零度未満と `|θ|>Number.MAX_VALUE/(128*1e10)` を拒否する。consistent L2は温度のsource最小最大やpositivityを保証しない。投影後の絶対零度境界で1e-10だけ丸め誤差を許し、clampしない。返すdegC*m2/K*m2は**面積×温度の積分**で、熱容量/密度/体積/時間のないエネルギー保存とは呼ばない。

build/apply/loadは最初のawait前にplain record/dense配列をsnapshotしaccessorを実行しない。private発行済みoperatorだけapply/serializeできる。loadはgroup所属、local T/M/area、global行列/Cholesky/R/weights/conditioning/identityを全再導出してrecord全体をcanonical比較する。self-rehash改ざんでも拒否する。geometryRevisionは未使用節点も含む全manifestのidentity。rawIdentityは入力JSON原文UTF8のSHAで認証ではない。既存単一平面/fluxモジュールの挙動を変更しない。

[合成証拠](evidence/2026-10-26-grouped-temperature-operator.json)の折面2三角形は面積各.5mm²、edgeAB共有。片側center fan hat1/境界0、他側0の場合、global `M=(1e-6/24)[[4,2,1,1],[2,4,1,1],[1,1,2,0],[1,1,0,2]]`、`b=1e-6*[1/18,1/18,1/18,0]` から温度差 `[1/6,1/6,1/2,-1/6]` となる。局所投影後の平均はC=1/3,D=0となり一致しない。3D affine20+10x+30y+40zはtarget[20,30,50,60]、積分35e-6degC*m2。scale10/剛体変換では温度不変、積分100倍。これらは独立固定式、実solver/GUI/codec起動なし。COUPLE3親全体の完了とはしない。
