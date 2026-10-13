# 斜めの平面上の矩形領域

[English](en/oblique-planar.md)

平面の矩形選択で「矩形の座標を回転する」を有効にし、X/Y/Z回転角度を入力します。選んだ軸は回転後の面に垂直な軸です。面の位置は原点からその軸に沿った距離（mm）、範囲の上下限は残りの回転後の2軸の座標です。回転はX、Y、Zの順で適用します。

例えば、Z軸を選び、Y回転30度・面位置40 mm・範囲2〜8 mmを2方向とも指定すると、Y軸まわりに30度回転した部品の端面に36 mm²の矩形を作れます。荷重方向は別に指定します。面を回転しても荷重の全体座標の方向は変わりません。

単一STEPまたは直方体の平面に対応。矩形全体が1枚の外側CAD平面に含まれることを検査し、CAD分割でメッシュを境界に合わせます。面の全体を覆う矩形も指定できます。回転座標と寸法を保存し、復元時には回転情報と実際の座標の整合性を確認します。

APIでは正規直交した2軸と平面上の原点でも指定できます。

```js
const a = Math.PI / 6;
studioApi.selectPlanarRegion(0, {
  frame: {
    origin: [40 * Math.sin(a), 0, 40 * Math.cos(a)],
    u: [Math.cos(a), 0, -Math.sin(a)], v: [0, 1, 0]
  },
  min: [2, 2], max: [8, 8]
});
studioApi.addCondition({type: 'force', value: 100,
  direction: [Math.sin(a), 0, Math.cos(a)]});
```

任意軸のAPIデータに回転角度情報がない場合は、UIでは任意平面として表示します。寸法の再適用は可能です。回転角度を変えて再選択するには、UIの軸と面位置を入力してください。曲面、複数部品、接触熱抵抗への矩形指定は未対応です。

tests/oblique-planar.test.mjsは30度回転STEP、36 mm²の面積、荷重・反力、面全体の固定、表示座標の丸め、保存回転情報の検証を確認します。公開配信物と画面のテストにも同じSTEP例を追加しています。[Gmsh API](https://gmsh.info/doc/texinfo/gmsh.html#Namespace-gmsh_002fmodel)でCAD平面への投影点と領域内判定を行います。
