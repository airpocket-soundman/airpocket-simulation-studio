# Tet10保存点取得の独立監査（2026-11-07）

[English](en/tet10-native-query-independent-audit.md)

基準 `af24992` の [専用query](tet10-native-query.md) を読取監査し、既存39044B raw fixtureだけで検証しました。FEM solver・product worker・GUIは起動していません。新しい3独立回帰は、保存構造の拒否、独立の二次変位場、FD同内容差替えを対象にします。

必須のsnapshot契約漏れを見つけました。疎配列に非indexの数値文字列keyを加えるとown key件数だけでは欠損を見逃します。物理hashから除外される `result.performance` をこの形へ変更すると元実装は受理しました。owner修正 `7985b0f` で全indexのown descriptor検査を追加し、続く `604d5ab` で長さをown data descriptorから1回取得・容量検査後の全経路に同じ値を使うよう修正しました。後者は配列Proxyのlength get trapによる検査後の割当長差替えを防ぎます。巨大値の割当は実行せず、4回目だけ16385となる有界反例でget trap0を確認しています。

独立数値oracleはローカル座標の `u=[.0007xy,-.0004yz,.0011zx]` mm、ν=.31、E=1e9Paです。節点/表示boxを `[100000,-200000,300000]` mmだけ並進し、解析微分の全normal/engineering shearと等方応力を非節点点・面・角・共有中心で照合しました。構成したpolynomial記録は補間検証用で、元荷重解や新しい実FEM解とは呼びません。共有中心は最小index0、十分外側は拒否されます。

別の独立試験はFDを読んだ直後に同じraw bytesでpathを別inodeへ置換し、SHAが同一でも `input-changed` を返すことを確認します。元fixtureは不変です。[日付付き証拠](evidence/2026-11-07-tet10-native-query-independent.json) に最終試験とhashを記録します。修正後の必須残指摘はありません。内容整合は署名・平衡・校正・一般Tet10/CAD・case/view/compareの成立保証ではありません。
