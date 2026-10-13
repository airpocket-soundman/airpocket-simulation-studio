# 外部流体領域

[English](en/fluid-domains.md)

STEPまたは内蔵部品を読み込み、「部品から囲いまでの余白」を設定して「周囲の流体領域を作る」を実行します。Gmsh/OpenCASCADEのBoolean差分で囲いの箱から部品のソリッド体積を差し引き、残った外部領域にTet4メッシュを生成します。表示用の箱だけを追加する処理ではありません。

元のソリッドはsourceModel.solidに保持し、囲いはsourceModel.enclosureにmmで保存します。囲いが正確なCADの境界箱を余白付きで含むことをメッシュ生成前に確認します。表示三角形の範囲がCADの厳密な範囲と異なる場合には、余白を増やしてください。閉じた内部空洞に生じる別の流体体積は外部領域から除外します。

「外部流体領域サンプル」は30 mm角の囲いから10 mm角の部品を差し引き、26,000 mm³、949要素を確認できます。Z=5 mm・残す側を反転した断面で元の部品空間が見え、100 mm²の内側の面を選択できます。切断による新しい面は生成しません。

外部領域はメッシュ生成・保存復元に対応。球形外部領域では[外部音響](exterior-acoustics.md)と[一方向振動音響](vibration-acoustics.md)も使えます。一般3D流体のソルバーは未接続です。構造ソルバーで誤って計算することを拒否します。任意方向の開口閉鎖と一般の入口出口条件、境界層メッシュ、乱流、共役熱伝達は残作業です。一般流体計算が完了したとは扱いません。十分発達した円管・角柱の層流は別の限定モードです。

ブラウザAPI: `await analysisApi.createExteriorDomain(paddingMm)`、`await analysisApi.loadExteriorExample()`。Node: `exteriorFluidSource(project,paddingMm)`で入力を作り、`generateMesh(initialize,source,{size})`で実メッシュを生成できます。単純部品、複数部品、STEPの密閉空洞と元形状の保存復元を自動検証しています。

球形の外部空気領域は[外部音響](exterior-acoustics.md)でも利用できます。一般3D流れは引き続き未対応です。

[内部領域のCAD抽出と端面ポート](internal-fluid.md)。箱のX/Y/Z平面で開口を閉じ、指定点を含むCAD体積を取り出せます。一般3D流体の計算と任意方向の開口閉鎖は未対応です。
