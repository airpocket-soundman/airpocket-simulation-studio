# グループ温度投影の独立監査

[English](en/grouped-temperature-independent-2026-10-27.md)

固定候補 `ba1844027c06e59f3d27294d4516a7c0ea4eb35c` をsource監査し、必須修正は見つからなかった。各groupを既存平面full-coverage/対向法線ゲートで検証し、global IDへM/Tをscatter加算した後に一度だけ解く。κ∞・容量・plain snapshot・load時の全再導出とself-rehash拒否を維持している。

独立oracleでは折面の面積を.5/1mm²と不均一にした。`M=(1e-6/24)[[6,3,1,2],[3,6,1,2],[1,1,2,0],[2,2,0,4]]`、片側center hatの`b=(1e-6/18)[1,1,1,0]`から、温度差は`[1/9,1/9,5/9,-1/9]`。production積分/solve helperを使わずM/bを固定式と直接比較した。共有節点の局所投影平均ではこの結果にならない。20°C baselineの積分は30e-6+1e-6/6、273.15定数offsetも面積で保存する。

追加4回帰はこのoracle、明示共有点の単一DOFと別ID点接触拒否、部分辺の非整合接触拒否、未使用座標のrevision拘束とfield順序正規化を検証する。初版2fixtureはsource/targetに同IDを使い既存plane gateに正しく拒否されたため、別側IDへ修正した。contactの期待assertは緩めていない。owner16件と計20成功、失敗/skip0。source SHAと制約は[証拠JSON](evidence/2026-10-27-grouped-temperature-independent.json)。

全面平面groupの限定pure APIであり、surface推定・連成solver・GUI・校正は対象外。面積×温度の保存をエネルギー保存と呼ばない。solver/GUI/codec追加0。実行: `node --test tests/grouped-temperature-operator-independent.test.mjs tests/grouped-temperature-operator.test.mjs`。
