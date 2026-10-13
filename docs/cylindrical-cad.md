# 円筒曲面の部分領域をCADで分割

[English](en/cylindrical-cad.md)

「円筒を角度・長さで選ぶ」で「円筒領域をCAD分割する」を有効にすると、半径・軸・原点・軸方向の開始/終了・開始角度・角度幅から実際の円筒CAD面を分割します。単一STEP、組込み円筒・中空管に対応し、回転・移動した円筒も共通APIで指定できます。

角度は基準方向から軸について右ねじの方向に測ります。Y軸・基準X方向では正角度は−Zへ進みます。315度から90度のような折り返しや、360度の帯にも対応。「円筒CAD分割サンプル」は端の全周帯を固定し、中央の90度・20 mmの曲面に123 Nを掛けます。

黄色・橙・青のパッチは寸法の輪郭に沿って描画します。角度と軸方向の端にメッシュの辺を合わせます。CAD面積は半径×角度(rad)×軸方向長さ。計算メッシュは三角形で曲面を近似するため面積差が残り、3%を超える場合は拒否します。合計荷重は指定値を維持し、面圧は三角形の面積と外向き法線で積分します。曲率による面積誤差と応力の収束は別の検証です。

```js
studioApi.selectCylindricalRegion(0, {
  origin: [0, 0, 0], axis: [0, 1, 0], reference: [1, 0, 0],
  radius: 12, tolerance: 0.3, axialMin: -10, axialMax: 10,
  startDegrees: 315, sweepDegrees: 90, exactCad: true
});
studioApi.addCondition({type: 'force', value: 123, direction: [-1, 0, 0]});
```

半径許容差は表示三角形の選択に使用します。CAD半径・範囲が一致しなければ拒否します。最大20領域（平面矩形と合わせて）。任意曲面・円錐・球面・複数CAD体積・流体領域・接触熱抵抗は未対応です。以前の保存データはexactCadがなければ投影方式を維持します。

ケースに寸法とCAD面積・三角形面積を保存し、復元時に範囲と面積を検査します。tests/cylindrical-cad.test.mjsは角度折り返し、全周帯、回転STEP、荷重保存、細分化による面積差の改善を確認。Workerテストは反力と保存復元を確認します。CAD構築には[GmshのOpenCASCADE revolveとfragment](https://gmsh.info/doc/texinfo/gmsh.html#Namespace-gmsh_002fmodel_002focc)を使用します。
