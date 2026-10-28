# 89 MESH1 — 生成メッシュの境界面をCAD面へ漏れ・重複なく割り当てる検査（最初の一歩）

## 開始条件

[共通指示](../opencode-work-orders-2026-10-23/00-COMMON.md)の書式・禁止事項に従う。基準main `4e9cef7`。この1作業だけを実行し、親MESH1（CAD境界に適合するメッシュの完成）とは区別する。`src/progress.json` と共有roadmapは編集しない。REG2（PR #221）の円筒/円錐パッチ領域 `src/cad-patches.js` は触らない。

## 現状（着手前の確認）

- `src/mesh-core.js` の `generateMesh` はGmsh WASMでTet4を生成し、`surface` に三角形と `faceTag`（分割時は元CAD面タグ）を付ける。要素上限30000。
- `src/mesh-validity.js` は接続・縮退・有限性・品質を検査するが、四面体の境界面と `surface` のCAD面割当の対応は検査していない。
- MESH2/3・ADAPT1/2・MESHARRAYLIMIT1は局所細分・収束・配列上限であり、境界面割当の網羅性は対象外。

## 選定した有界な一歩

REG2の完了に依存しない読み取り専用の検査 `analyzeBoundaryFaceAssignment(mesh)`（`src/mesh-boundary-conformity.js`）を追加する。

- 四面体の面incidenceから境界面（incidence=1）を求め、`surface` 三角形と節点集合で照合する。
- 診断コード: `MESH_BOUNDARY_MISSING`（未割当の境界面）、`_DUPLICATE`（同一三角形の重複割当・異なるタグを証拠に含む）、`_INTERIOR`（内部面/非要素面に置かれた三角形）、`_UNASSIGNED`（faceTagなし）、`_INVALID`、`_NON_MANIFOLD`。
- CAD面タグごとの三角形数と面積を返す。診断は20件で打ち切り `truncated` を立てる。メッシュを変更せず、mesherやsolverを呼ばない。
- `mesh-core.js` の生成処理、要素上限30000、数値式は変更しない。

## 受け入れ条件

1. 実Gmsh WASMの立方体（size 5/2）、円筒、球、独立2箱、局所細分箱で `conforming:true`、境界面数＝surface三角形数。
2. 立方体の6面それぞれ面積100 mm²（誤差1e-9）、円筒3面の総面積が解析値の2%以内。
3. 合成破損（三角形削除・逆向き重複・タグ欠落・内部面追加）がそれぞれ1件の該当コードで検出され、入力メッシュは不変。
4. 不正な四面体は例外。全面欠落では診断20件で打ち切り。
5. 証拠JSONにbase SHA、module/script hash、環境、コマンド、全行の実測値、未確認項目を保存。

## 対象試験

```text
node --test tests/mesh-boundary-conformity.test.mjs
node scripts/experimental/verify-mesh-boundary-conformity.mjs > docs/evidence/2026-10-28-opencode-89-mesh1.json
npm run check:contracts
git diff --check
```

## 範囲外・残る親受入

節点とCAD曲面の幾何距離、STEP読込・流体領域（外部/内部）メッシュ、REG2パッチ分割の割当、独立複数体の `faceTag` が体ごとに区別されない点（`bodyIndex` 併用が必要）、UI/worker/API接続、一般形状の品質保証。次の候補は (a) 節点-CAD面距離の検査、(b) `generateMesh` 出力への診断添付とpreflight接続、(c) REG2完了後のパッチ割当照合。

## 納品

証拠 `docs/evidence/2026-10-28-opencode-89-mesh1.json`、変更一覧、未確認をPRに添える。progress更新案（MESH1のlastUpdate追記のみ、statusはqueued維持）は親セッションへ渡す。自己mergeしない。
