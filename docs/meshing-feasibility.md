# メッシュ基盤の導入調査

[English](en/meshing-feasibility.md)

2026-10-13にnpmと公式の公開資料を確認。

- `@loumalouomega/gmsh-wasm` 0.3.0: GmshのC APIをWASM化した第三者パッケージ。STEPを含むCAD読込と体積メッシュ生成の候補。約43 MB（展開後）。ブラウザではSharedArrayBufferとcross-origin isolationが必要。GitHub PagesではService Worker経由の対応を検証する必要がある。まだ本アプリには導入していない。
- `@loumalouomega/mmg-wasm` 0.1.0: 表面・体積の再メッシュの候補。約2 MB（展開後）。既存体積メッシュに誤差指標から作ったサイズ場を与える経路を検証する。まだ導入していない。

GmshパッケージはGPL-2.0-or-later、MMGパッケージはLGPL-3.0-or-later。導入時にアプリと配布物、対応するソース、通知、ビルド再現性を確認する。公開リポジトリであることだけでライセンス義務を満たすとは扱わない。

次の検証: 小さな立方体の四面体メッシュ生成、全要素体積と形状体積の比較、正の体積・品質、境界面の対応、Worker中止、Pagesでの起動と非対応時の案内。その後にSTEP実データと局所領域の境界適合へ進む。

資料: [Gmsh WASMのブラウザ条件](https://loumalouomega.github.io/GMSH-JS/guide/browser/)、[Gmsh WASMソース](https://github.com/loumalouomega/GMSH-JS)、[MMG WASMソース](https://github.com/loumalouomega/MMG-WASM)。
