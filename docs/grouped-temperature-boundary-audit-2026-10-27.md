# 平面グループ温度転送の境界・保存監査

[English](en/grouped-temperature-boundary-audit-2026-10-27.md)

固定source `ba1844027c06e59f3d27294d4516a7c0ea4eb35c` を、数値積分・global行列の別担当監査とは独立に読取確認した。対象はgroup間交差/接触、face所属、snapshot上限とload再導出。**必須修正の指摘はない**。製品sourceを変更せず、独立した明示形状と保存改ざんの4回帰を追加した。[JSON](evidence/2026-10-27-grouped-temperature-boundary-audit.json)にsource Git blob SHA1/SHA256と作業木CRLF hashを分けて保存する。

別IDでのcoplanar点/辺接触、非coplanarの面内点接触と部分辺接触は拒否。共有global node/edgeのみの接触は成功し、共有vertexを持っていてもその先へ伸びる内点交差は拒否した。fixtureは座標/IDを直接指定し、production clip/intersection関数をoracleに呼んでいない。

faceの二重/欠落/範囲外/unknown所属、未使用nodeの追加変更、非有限/非数値、過大node/face/group、疎配列/継承recordを拒否した。nested getterを実行せず、load呼出後のcaller変更がsnapshotへ入らないことを確認。受信recordのgeometry版/local演算子版/group所属/M/R/source IDを改変して再hashしても、load再導出との比較で拒否した。raw容量・depth超過も拒否する。

新4試験は4成功/0失敗/0skip。これは文書の数値許容を持つ明示三角形集合の限定監査であり、一般CAD交差分類・滑面精度・連成物理の証明ではない。solver/GUI/codec/CI起動、公開や親status昇格は行っていない。
