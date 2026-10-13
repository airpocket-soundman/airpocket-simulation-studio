# 外部ライブラリ

[English](THIRD_PARTY.md)

- Three.js — MIT — https://github.com/mrdoob/three.js
- Vite — MIT — https://github.com/vitejs/vite
- occt-import-js 0.0.23 — LGPL-2.1 — https://github.com/kovacsv/occt-import-js

変更していないJavaScriptとWASMをcad/に分離して配信します。ソースとビルド手順は上流リポジトリで公開されています。Open CASCADEのライセンスと通知は上流ソースに含まれます: https://github.com/Open-Cascade-SAS/OCCT 。ライセンス文書はビルド時にpublic/licensesへコピーします。

CADライブラリは交換可能です。コピー処理後、ビルド前にpublic/cad/occt-import-js.jsとpublic/cad/occt-import-js.wasmを置き換えられます。解析ソルバーを追加する際は別途、配布物とライセンスを確認します。
