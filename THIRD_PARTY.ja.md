# 外部ライブラリ

[English](THIRD_PARTY.md)

- Three.js — MIT — https://github.com/mrdoob/three.js
- Vite — MIT — https://github.com/vitejs/vite
- Gmsh WASM 0.3.0 — GPL-2.0-or-later。変更していない実行環境をgmsh/に分離して配信します。対応するソースとビルド手順: https://github.com/loumalouomega/GMSH-JS/tree/3fdabeeb1dac2417446cefb9f75ecb6645315cd6 。GmshとOpenCASCADEの版は同リポジトリのsubmoduleとビルド手順で固定されています。本アプリもGPL-2.0-or-laterで配布し、対応するアプリソースと依存のlockfileを公開します。
- coi-serviceworker 0.1.7 — MIT — https://github.com/gzuidhof/coi-serviceworker 。PagesでGmshの実行に必要なブラウザ分離を有効にします。
- occt-import-js 0.0.23 — LGPL-2.1 — https://github.com/kovacsv/occt-import-js
- SU2 v8.5.0 — LGPL-2.1 — https://su2code.github.io 。試験的でオプトインのネイティブ外部流れ実行専用です。SU2の実行ファイルはこのリポジトリにもPagesビルドにも同梱しません。`scripts/setup-su2.mjs`を利用者が明示的に実行したときだけ、公式v8.5.0のWindows版zipをダウンロードし、固定したサイズとSHA-256を確認します。取得したファイルは変更せず、別のローカルプロセスとして使います。`src/su2-vtu.js`の`.vtu`読み取りは、限定した非圧縮形式向けのプロジェクト独自コードで、VTKライブラリは含みません。

変更していないJavaScriptとWASMをcad/に分離して配信します。ソースとビルド手順は上流リポジトリで公開されています。Open CASCADEのライセンスと通知は上流ソースに含まれます: https://github.com/Open-Cascade-SAS/OCCT 。ライセンス文書はビルド時にpublic/licensesへコピーします。

CADライブラリは交換可能です。コピー処理後、ビルド前にpublic/cad/occt-import-js.jsとpublic/cad/occt-import-js.wasmを置き換えられます。解析ソルバーを追加する際は別途、配布物とライセンスを確認します。
