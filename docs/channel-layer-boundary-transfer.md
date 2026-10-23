# 限定平行平板Tet4の境界転送契約

[English](en/channel-layer-boundary-transfer.md)

`src/channel-layer-boundary-transfer.js` は限定直交Tet4を下流へ渡す、読み取り専用の面ベース契約です。`getChannelLayerMeshRevision(mesh)` で実geometryのSHA-256を取得し、`createChannelLayerBoundaryTransfer({mesh,expectedMeshRevision,conditions,maxTetEdgeAspectRatio,minimumTetVolumeMm3})` へ渡します。保管されたinspectionは信用せず再検査し、古いgeometry版と非同期hash検査中の変更を拒否します。`transferRevision` はmesh版・境界条件・品質閾値・契約版を束縛します。

6境界を省略せず指定します。lowerWall/upperWallはno-slip-wall、xMinは正のx方向だけのvelocity-inlet（m/s）、xMaxは有限pressure-outlet（Pa）、zMin/zMaxはsymmetryです。欠落・余分なfield・型/役割不一致・斜め/逆向き流入・非有限値は拒否します。単位を暗黙変換しません。

出力は面の安定ID・節点ID・所有Tet ID・外向き単位法線・重心・面積・wallId、境界別の全face IDと合計面積、明示BCを含みます。面の節点順から法線を再計算し、箱の外向き軸と一致しなければ拒否します。各外部面の所有Tetは1個です。節点IDは返却meshRevisionに対応した元meshへ参照します。

下流の `validateChannelLayerBoundaryTransfer(input,transfer)` は正確な入力から再構成して全内容を比較します。改変された法線・所有者・面積・BC・版・重複面を拒否し、受領manifestの自己申告値だけで通しません。

各Tetには体積・全6辺の最長/最短比・重心の最近接plate距離を付けます。明示された最小体積と最大辺比を満たさない場合は全転送を拒否します。節点plate距離も返し、距離は `min(y,gap-y)`、壁面では0です。これはy方向2平板への幾何距離であり、一般壁距離・粘性壁座標・y+ではありません。

参照gap 10 mm、length 2 mm、width 1 mmは42Tet/60外部面。上下plate各2 mm²、入口/出口各10 mm²、z対称面各20 mm²。最小Tet重心plate距離0.025 mm。薄い0.1 mmセルの辺比は `sqrt(2²+1²+0.1²)/0.1` です。回帰は投影shoelace面積、所有Tetへの内外符号、解析的対角線比とplate距離で独立照合します。

既存のproject/CAD境界APIは元面選択と投影を前提とするため、ここから自動接続しません。流入面と壁の交差辺での節点BC優先順位も決めません。下流solver接続・BC実適用・流れ収束・一般3D境界層・y+は未対応です。この契約は面と意図の安全な引き渡しまでを扱います。
