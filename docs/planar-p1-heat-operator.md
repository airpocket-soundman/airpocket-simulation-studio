# 平面P1節点熱流の保存演算子

[English](en/planar-p1-heat-operator.md)

`src/planar-p1-heat-operator.js` はCOUPLE3の限定pure境界。旧global-affine演算子のkind/API/保存値は変更せず、新kind `planar-p1-heat-transfer`を追加した。任意の**連続P1 source節点値**を扱うが、同一平面・対向outward法線・許容内完全一致被覆だけ。曲面、部分被覆、温度転送、熱流体反復solver/UI/API/MCPへは接続しない。

## 入力と意味

geometryは旧affineと同じ `{units:'mm',mesh:{nodes},sourceFaces,targetFaces}`。各面はnode ID3個。source/targetのIDを分離し、面の向きがそれぞれoutwardを定義する。buildでは旧 `buildPlanarHeatTransferOperator` を先に使い、matching AABB、same-side重なり、面ごとの被覆・平面・対向法線の既存拒否を再利用する。許容はplane1e-6mm、coverage相対1e-6のまま。完全被覆はこの許容内の意味で、gapとoverlapの相殺を許さない。

source各nodeに1個のq_i[W/m²]を指定する。`{units:'W/m2',values:[{nodeId,value},...]}`で、未使用/欠落/重複node、非有限値、W単位の節点荷重、global-affine形式、per-faceの不連続fieldは受理しない。節点順は正規化してfluxRevisionを求め、入力objectを変更しない。

```text
q_A(x) = Σ_i N_Ai(x) q_i
T_ji = ∫interface N_Bj N_Ai dA     [m²]
b_Bj = Σ_i T_ji q_i              [W, B inward positive]
w_Ai = ∫interface N_Ai dA        [m²]
sourceW = Σ_i w_Ai q_i
targetW = Σ_j b_Bj; targetOutwardW = -targetW
Σ_j T_ji = w_Ai;  Σ_i T_ji = ∫ N_Bj dA
```

source各triangleのP1とtarget形状関数の積を、clipで作った共通細分三角形上の3辺中点則で2次exact積分する。節点値の平均や旧4個affine basisへのfitで代用しない。mm²→m²は一度だけ1e-6を掛ける。行/列のpartition、apply時の保存を絶対1e-18＋相対1e-12で照合する（係数の単位はm²、結果はW）。正負が相殺して総量0でも項の絶対値和をscaleに用い、ゼロ分母を作らない。微小負の丸め係数もclampせず、barycentric/finite/partition検査を行う。

## APIと保存

```js
const operator = await buildPlanarP1HeatTransferOperator(geometry);
const raw = serializePlanarP1HeatTransferOperator(operator);
const {operator:loaded,source} = await loadPlanarP1HeatTransferOperator(raw,geometry);
const result = await applyPlanarP1HeatTransferOperator(loaded,geometry,{
  units:'W/m2',values:[/* 全source nodeIdとvalue */]
});
```

operatorは深いfreezeと発行済みobject管理で保護し、target row/source termのID順を固定する。保存にはgeometry版、source面積重み、全疎係数、単位、kind/schema、operatorRevisionを持つ。loadは渡されたgeometryから全係数を再導出し、自己申告hashを再計算した係数改ざんも拒否する。loader返値はoperatorそのものではなく `{operator,source}`。sourceはraw UTF8 byte数/SHA256で、署名/校正/精度の保証ではない。

geometry/source fieldはhashの最初のawait前にprivate snapshotを取る。geometry版は使用node ID/座標とsource/target face列を固定し、無関係な未使用座標をinterface版には含めない。field版は単位とnode ID/valueを固定する。古い使用geometryをapplyへ渡すと拒否し、入力変更中の非同期完了で版と計算を分裂させない。失敗時も入力/既存operatorを変えない。

## 予算と検証

最大4096 geometry nodes、各side512面、source-target pair列挙は最大512²。異なる(target,source)node pairの疎項を最大16384に制限し、16385項目をMapへ追加する前に拒否する。入力geometry/保存JSONは各1MiB、graph200000値/深さ20、座標±1e6mm。過大raw、深さ、非通常Array/accessor/疎配列、未知field、非有限、数値overflowを拒否する。出力の最終byte検査だけに仕事量を依存しない。一般形状へ上限を広げていない。

[独立数値証拠](evidence/2026-10-23-planar-p1-heat-operator.json)と試験は次を確認する。

- unit-squareのsource対角A–C、target対角B–Dが交差する共通fan4で、別担当が手積分したT全16係数と一致。source q=[0,0,1,0]のtarget荷重は[1,5,5,5]/48×1e-6W、総1e-6/3W。
- source center6/corners0の非global-affine hatからtarget対角A–Cへの荷重[.75,.25,.75,.25]×1e-6W、総2e-6W。独立積分式は三角形上の ∫fg=A/12[(Σf)(Σg)+Σf_i g_i]で、productionのclip/barycentricを使わない。
- 混合正負q=[1,0,-1,0]では総量0だがtarget荷重[1/12,0,-1/12,0]×1e-6Wを保つ。符号反転、移動/回転、旧affine一致、保存再読込と再hash改ざん拒否、入力不変を検証。
- 128面fanで4672項を受理、256面fanで疎項予算を拒否。4096nodes/512facesの正規上限例は成功。1MiB rawを受理し+1byte拒否。実runtime importの型正例/負例も通常試験へ含める。

これは合成平面referenceの限定受入。材料同定、実験精度、一般曲面/非一致被覆、反復連成や製品公開、COUPLE3親全体の完了ではない。

旧geometry validatorのcoverage許容1e-6は維持するが、P1はさらに行/列momentを1e-18+1e-12×scaleで照合する。そのため旧coverage検査に通る微小不足でもP1係数の追加受入で拒否され得る。欠損熱量を発明して保存させない。

独立監査で、未使用節点の座標をnull/真偽値/文字列に置き換えるとapplyだけが受理する不整合を再現し、全座標の明示number/finite検査へ修正した。使用節点だけの幾何identityを確認する前にも、未使用節点を含む全入力の型・単位・容量検査を行う。交差分割の転送を逆向きに構築した全16係数が元行列の転置と一致すること、flux配列順に依存しない版と荷重も独立確認した。[監査証拠](evidence/2026-10-23-planar-p1-independent-audit.json)。
