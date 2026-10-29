# 96 MESH1 — 生成メッシュの表面節点がCAD面上にあるかの幾何適合検査（第2歩）

## 開始条件

[共通指示](../opencode-work-orders-2026-10-23/00-COMMON.md)の書式・禁止事項に従う。基準main `f16853a`。この1作業だけを実行し、親MESH1（CAD境界に適合するメッシュの完成）とは区別する。`src/progress.json` と共有roadmapは編集しない。REG2の `src/cad-patches.js` と既存の `src/mesh-boundary-conformity.js` は触らない。

## 現状（着手前の確認）

- 指示書89（PR #232）の `analyzeBoundaryFaceAssignment` は境界面とCAD面タグの1対1対応（位相）を検査するが、節点とCAD曲面の幾何距離は範囲外として残した（候補(a)）。
- 89の残課題「独立複数体の `faceTag` が体ごとに区別されない」は、`surface` の `bodyIndex` 併用で解消できる。
- `mesh-core.js` のプリミティブ（box/boxes/sphere/cylinder: y軸, 半径12, y∈[-30,30]）は解析的なCAD面を持つ。

## 選定した有界な一歩

読み取り専用の検査 `analyzeSurfaceCadDistance(mesh, source, {toleranceMm})`（`src/mesh-cad-geometry-conformity.js`）と `analyticCadFaces(source)` を追加する。

- プリミティブごとに有界な解析面（平面矩形・円板・円筒側面・球面）と点距離関数を作る。
- `(bodyIndex, faceTag)` 群ごとに許容外節点が最少の解析面へ対応付け、最大節点距離と三角形重心の弦高（情報のみ）を返す。既定許容は `1e-6·max(1, 座標絶対値最大)` mm。
- 診断コード: `MESH_CAD_DEVIATION`（一部節点が許容外）、`_UNMATCHED`（過半の節点がどの面にも乗らない）、`_SHARED`（2群が同一CAD面）、`_UNCOVERED`（どの群も対応しないCAD面）。20件で打ち切り `truncated`。
- STEP等の解析面を持たない入力は `supported:false`（判定しない）。メッシュを変更せず、mesher/solverを呼ばない。要素上限30000・数値式は変更しない。

## 受け入れ条件

1. 実Gmsh WASMの立方体（size 5/2）、円筒（6/3）、球、独立2箱、局所細分箱で `conforming:true`、全CAD面に対応群がある。最大節点距離 ≤ 4e-15 mm。
2. 円筒側面の弦高は正かつ半径未満で細分で減少（0.318→0.105 mm）、平面の弦高は1e-9未満。
3. 合成破損（節点を法線方向に0.01 mm移動、2タグ統合、1タグ削除、寸法違いのsource）がそれぞれ該当コードで検出され、許容0.02 mmでは移動を許容し、入力メッシュは不変。
4. 不正三角形・faceTag欠落・非正の許容は例外、非対応sourceは `supported:false`。
5. 証拠JSONにbase SHA、module/script hash、環境、コマンド、全行の実測値、未確認項目を保存。

## 対象試験

```text
node --test tests/mesh-cad-geometry-conformity.test.mjs
node --test tests/module-boundaries.test.mjs
node scripts/experimental/verify-mesh-cad-geometry-conformity.mjs > docs/evidence/2026-10-29-opencode-96-mesh1.json
npm run check:contracts
git diff --check
```

## 範囲外・残る親受入

STEP読込面（OCC曲面評価が必要）、流体領域メッシュ、REG2パッチ分割、弦高の許容判定、preflight/API/MCP接続（89・96の診断を `generateMesh` 出力へ添付し解析拒否する経路）、一般形状の品質保証。次の候補は (a) preflight接続、(b) Gmsh `getClosestPoint` によるSTEP面距離。

## 納品

証拠 `docs/evidence/2026-10-29-opencode-96-mesh1.json`、変更一覧、未確認をPRに添える。progress更新案（MESH1のlastUpdate追記のみ、statusはqueued維持）は親セッションへ渡す。自己mergeしない。
