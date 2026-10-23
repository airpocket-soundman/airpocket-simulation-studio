# 外部流体領域

[English](en/fluid-domains.md)

STEPまたは内蔵部品を読み込み、「部品から囲いまでの余白」を設定して「周囲の流体領域を作る」を実行します。Gmsh/OpenCASCADEのBoolean差分で囲いの箱から部品のソリッド体積を差し引き、残った外部領域にTet4メッシュを生成します。表示用の箱だけを追加する処理ではありません。

元のソリッドはsourceModel.solidに保持し、囲いはsourceModel.enclosureにmmで保存します。囲いが正確なCADの境界箱を余白付きで含むことをメッシュ生成前に確認します。表示三角形の範囲がCADの厳密な範囲と異なる場合には、余白を増やしてください。閉じた内部空洞に生じる別の流体体積は外部領域から除外します。

「外部流体領域サンプル」は30 mm角の囲いから10 mm角の部品を差し引き、26,000 mm³、949要素を確認できます。Z=5 mm・残す側を反転した断面で元の部品空間が見え、100 mm²の内側の面を選択できます。切断による新しい面は生成しません。

外部領域はメッシュ生成・保存復元に対応。球形外部領域では[外部音響](exterior-acoustics.md)と[一方向振動音響](vibration-acoustics.md)も使えます。一般3D流体のソルバーは未接続です。構造ソルバーで誤って計算することを拒否します。任意方向の開口閉鎖と一般の入口出口条件、境界層メッシュ、乱流、共役熱伝達は残作業です。一般流体計算が完了したとは扱いません。十分発達した円管・角柱の層流は別の限定モードです。

ブラウザAPI: `await analysisApi.createExteriorDomain(paddingMm)`、`await analysisApi.loadExteriorExample()`。Node: `exteriorFluidSource(project,paddingMm)`で入力を作り、`generateMesh(initialize,source,{size})`で実メッシュを生成できます。単純部品、複数部品、STEPの密閉空洞と元形状の保存復元を自動検証しています。

球形の外部空気領域は[外部音響](exterior-acoustics.md)でも利用できます。一般3D流れは引き続き未対応です。

[内部領域のCAD抽出と端面ポート](internal-fluid.md)。箱のX/Y/Z平面で開口を閉じ、指定点を含むCAD体積を取り出せます。一般3D流体の計算と任意方向の開口閉鎖は未対応です。

## 版付き共通API/MCP

共有window.fluidDomainApi.prepareと接続prepareFluidDomainでsourceを準備し、startJobのmeshを実行してから成功・executionSettledを確認しapplyMesh/applyFluidDomainMeshでsurfaceを表示入力へ反映できます。新入力の物性・条件・選択・根拠・intentはクリアし、studyはfluidDomainのままです。既存GUIの一括サンプル設定とは別に、流体・音響の物性や条件は明示的に設定してください。[操作契約](automation.md)を参照。

## 明示確認済み開口候補の変換（CFDPORT1）

`confirmOpeningCandidate`（`src/opening-candidate-cap.js`）は、現在の三角形meshと整数`meshVersion`、検出時の候補全体、同じ版の`confirmation`を受けるpure変換です。呼出側がmesh変更ごとに版を更新します。`confirmed: true`、cap ID、利用者が明示した単位外向き法線`outwardNormal`、mmの内点`interiorPointMm`、mmの箱`enclosure`が必要です。候補を現在のmeshから再検出し全フィールドを照合するため、古い版・改ざん・無効component・未解決seamを拒否します。法線は面と平行で、内点は箱内かつ既存cap契約の内側にある必要があります。候補法線の符号から外向きを推測しません。

返却値の`source.openingCaps`は既存半空間cap入力です。`nodeIndices`、`toleranceMm`、`meshVersion`も保持し、入力や配列を変更しません。法線の反転は保持側も反転するため、反転後の内点が必要です。確認成功は閉殻・CAD局所蓋・流体メッシュ生成成功を意味しません。UI/API接続、任意wire、複数体積は本変換の対象外です。
