# REG2 曲面領域の拡張設計(円錐・球面・一般曲面)

[English](en/reg2-curved-regions.md)

REG2「寸法領域をCAD境界へ反映」の残課題は、平面矩形([planar-regions.md](planar-regions.md)、[oblique-planar.md](oblique-planar.md))と円筒([cylindrical-cad.md](cylindrical-cad.md))以外の曲面の厳密な分割です。本書は現状調査、次の最小増分の選定、検証・限界・試験・リスクをまとめた設計メモです。円錐パッチは実装済みで(下記「接続結果」)、球面と一般曲面は未着手です。

## 現状(調査結果)

- 分割は `src/cad-patches.js` の `fragmentCadPatches`。平面は矩形の4線から平面を作り、円筒は `src/cylindrical-cad.js` の `makeCylinderPatch`(母線をGmshのOpenCASCADE `revolve`)で面を作り、`occ.fragment` で外部面に埋め込みます。後に各パッチの面積(`getMass`)を式と1e-7で照合し、外部境界に残っているかを検査します。
- メッシュ側(`src/mesh-core.js`)は表面三角形に `patchConditions` を付与し、`planarPatches` / `cylindricalPatches` と `meshAreaMm2` を保存します。復元時は `validatePlanarMesh` / `validateCylindricalMesh` が範囲と面積を再検査します。
- 境界転写(`src/boundaries.js`)は平面を1e-7、円筒を min(3%, 許容)で面積誤差判定します。荷重は面積・外向き法線で積分するため総荷重を保ちます。
- 選択は表示三角形上の `planarTriangles` / `cylindricalTriangles`、API は `studioApi.selectPlanarRegion` / `selectCylindricalRegion`。CAD再読込は `src/cad-update.js` が寸法から選び直します。
- 上限は合計20領域、単一CAD体積、STL不可。円錐・球面・一般曲面は未対応です。

## 候補と推奨

1. 円錐: 円筒と同じ「回転で面を作る」構成で、半径が軸方向に線形変化するだけです。面積は閉形式で、OCCTのrevolveで `Cone` 面1枚ができることを試験で確認済み。最小・低リスク。
2. 球面(緯度経度の矩形): 母線を円弧にしたrevolveで可能。極・赤道の特異点の扱いが必要。
3. 一般曲面のUV矩形: OCCTのUV境界(`getParametrizationBounds`)で任意の曲面を矩形に切れるが、面積が寸法で閉形式にならず、寸法の定義(UVは長さではない)が課題。

推奨は 1(円錐)→ 2(球面)→ 3 の順です。円錐と球面は「回転面」として同じ枠組みで、寸法(長さ・角度)で面積が解析的に決まるため「面積誤差の検証」が厳密にできます。一般UV矩形は寸法の意味が不明確なため最後にします。

## 本増分で実装したもの(カーネル)

`src/conical-cad.js`(`src/module-layers.json` の domain 層に追加)と `tests/conical-cad.test.mjs`。

- `validateConicalPatch(d)`: 原点・軸・基準方向・`radius`(軸方向開始側)/`radiusAtMax`(>0)・軸方向範囲・開始角・角度幅を検査。円筒と同じ座標系 `cylindricalFrame` を再利用。
- `conicalPatchArea(d)`: 角度(rad) × 平均半径 × 母線長。半径が等しいときは円筒の面積式と一致。
- `conicalPatchPoint` / `conicalPatchContains`: 寸法上の点と包含判定(折り返し角度対応)。
- `makeConicalPatch(g, d)`: 円筒と同じrevolve。試験で、組込み円錐に対して面種別が `Cone`、`getMass` が式と相対1e-9で一致することを確認。

## 接続結果(実装済み)

公開契約(操作名・入力ポインタ一覧)を変えないため、新しい`selectConicalRegion`は作らず、`selectCylindricalRegion`のスペックに任意の`radiusAtMax`を追加しました(`radius`が軸方向開始側の半径、`radiusAtMin`は使わない)。`cylindricalFrame`が検査(正の半径、exactCad必須、半頂角45度以下)し、`cylinderPatchArea/Point/Contains/makeCylinderPatch`が円錐へ振り分けます。境界転写・メッシュ保存・復元検査・CAD更新・UIは円筒の経路をそのまま使います。詳細は[cylindrical-cad.md](cylindrical-cad.md)。以下は当初案です。

## 当初のAPI案

```js
studioApi.selectConicalRegion(0, {
  origin: [0, 0, 0], axis: [0, 1, 0], reference: [1, 0, 0],
  radiusAtMin: 12, radiusAtMax: 6, tolerance: 0.3,
  axialMin: -10, axialMax: 10, startDegrees: 315, sweepDegrees: 90, exactCad: true
});
```

接続範囲: `conicalTriangles`(表示三角形選択)、`fragmentCadPatches` の種別追加(`type:'conical'`、`Cone`面の存在確認)、`mesh-core` の `conicalPatches` 保存、`validateConicalMesh`、`boundaries.js` の許容(円筒と同じ3%上限)、`cad-update.js` の再選択、`regions.js` の検証、`project-input.d.ts`、UI。20領域上限は共通。

## 検証

- 面積誤差: CAD面積は式と相対1e-7(カーネルは1e-9で確認)。計算メッシュ面積は三角形近似のため円筒と同じく3%を上限とし、細分化で単調改善することを試験する。
- 荷重保存: 総荷重は指定値を維持。面圧は三角形面積と外向き法線で積分し、反力とのつり合い(円筒試験と同じ方式)を確認。円錐は法線が軸と傾くため、反力の軸成分も検査する。
- 保存・復元: 寸法・CAD面積・メッシュ面積を保存し、復元時に範囲と面積を再検査。再メッシュで境界が保たれることを確認。

## 限界

- 円錐は両端の半径が正のものに限る(頂点を含む円錐、半径0は特異点のため対象外)。
- 球面・一般曲面・複数CAD体積・流体領域・接触熱抵抗・STLは対象外のまま。
- 面積の3%上限はメッシュ近似に対する判定で、応力の収束を保証しません。

## 試験計画

1. カーネル(実装済み): 面積式と円筒への縮退、包含判定、無効入力の拒否、OCCT revolveの面種別と質量。
2. 接続時: 組込み円錐とSTEP円錐での分割、折り返し角度、全周帯、誤った半径・範囲の拒否、細分化で面積差が減ること、総荷重と反力のつり合い、ケース保存復元、CAD更新後の再選択、Worker経路。
3. 球面を追加する場合: 極をまたぐ範囲と赤道、緯度経度の面積式 R²·Δλ·(sinφ2−sinφ1) との照合。

## リスク

- STEPの円錐面は軸・半頂角が丸め誤差を持ち得る。包含判定の許容は `getClosestPoint` による面上照合(平面の方式)で補強する。
- revolveが曲面を複数面に分けたり、頂点付近で縮退する可能性。面が1枚でなければ拒否する(円筒と同じ)。
- 円錐面は表示メッシュで三角形が軸と傾くため、円筒の法線条件(軸との内積0.25以下)をそのまま使えない。
- 一般UV矩形は寸法の定義が曖昧で、REG2の「寸法で定義」を満たさないおそれがある。
