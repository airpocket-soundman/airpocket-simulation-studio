# 限定平行平板の Tet4 変換（CFDMESH1）

[English](en/channel-layer-tet4.md)

`src/channel-layer-tet4.js` は既存の `createChannelLayerCellQuality` と同じ入力を受け取り、品質検査が許可した直交セルだけを各6個の Tet4 に変換する純粋処理です。長さは mm、体積は mm³、面積は mm² です。入力は変更しません。

全セルで同じ軸順の Freudenthal 分割を使い、y 座標面の4節点を共有します。各 Tet の符号付き体積が正で有限であること、内部面がちょうど2回・反対向きに現れること、外部面が箱の6平面上にあることを検査します。重複要素・重複位置・内部の開いた面・非適合面は拒否します。全体積と6面の面積の相対誤差上限は 1e-12 です。既存の高さ・アスペクト比閾値は緩和しません。

`inspectChannelLayerTet4` は生成結果を読み取り専用で再検査し、境界三角形に `lowerWall` / `upperWall` と `wallId` 0 / 1 を付けます。他の4面の `wallId` は null です。参照条件 gap 10、length 2、width 1、壁層高さ 0.1・0.2・0.4 mm は7セル、32節点、42 Tet、内部54面、外部60面、体積20 mm³、上下壁各2 mm²になります。

公開再検査には `units='mm'` と `output='limited-channel-tet4'` が必要です。生成と再検査の固定容量は合計512壁層、2056節点、3078 Tetです（export定数 `CHANNEL_TET4_MAX_WALL_LAYERS` / `CHANNEL_TET4_MAX_NODES` / `CHANNEL_TET4_MAX_ELEMENTS`）。planの `maxLayers` 指定で上限を増やすことはできません。生成では品質報告・節点・Tet配列を作る前、再検査では面incidenceを作る前に過大要求を拒否します。最小高さの許容差は要求値と実測高さの相対1e-12であり、絶対1e-12 mmの下限を設けません。小さな寸法でも要求高さを大幅に下回る薄層を拒否します。

これは限定形状の幾何検査です。一般 Gmsh 境界層、solver/UI 接続、流れ計算、solver への壁tag転送、y+、一般物理精度検証は未対応です。

検証: `node --test tests/channel-layer-tet4.test.mjs tests/channel-layer-cell-quality.test.mjs tests/mesh-validity.test.mjs`。符号付き体積と壁面積は試験側の独立式でも照合します。
