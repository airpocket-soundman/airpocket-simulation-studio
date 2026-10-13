# ブラウザ実行とGitHub Pages

[English](en/browser-runtime.md)

2026-10-13のユーザー指定: Webアプリとして制作し、GitHub Pagesで公開。初期版はブラウザ内で利用者のローカル計算資源を使う。

## 基本構成

- TypeScript / React / Three.jsの静的ビルドをGitHub Actionsで生成し、GitHub Pagesへ配信。
- リポジトリ名を含むベースパス、WASM・WorkerのURL、MIME、HTTPSを公開環境で確認。
- CAD読み込み・メッシュ生成・解析をWeb Workerに分離。CPU計算はWASMを優先。画面操作と中止操作を保つ。
- 初期は単一スレッドの計算。マルチスレッドWASMはSharedArrayBufferとcross-origin isolationの条件を満たす場合だけ有効化。Workerに移すことと計算のマルチコア化は別。
- GitHub Pagesで必要なCOOP/COEPヘッダーを直接設定できると仮定しない。Service Workerによる対応は、再読み込み・キャッシュ・ブラウザ互換性を実サイトで検証してから採用。単一スレッド版を必ず用意。
- 3D描画のGPU利用と、解析計算のGPU利用を別管理。WebGPU計算は対応API・アダプターを検出し、CPU版を残す。
- モデルは利用者のブラウザで処理し、初期版にモデルのサーバー送信処理を設けない。保存はIndexedDB等とプロジェクトファイルの書き出し・読み込み。容量超過・保存失敗を通知。

## ソルバー採用の条件

ネイティブ実行ファイルをブラウザから直接起動することはできない。候補OSSをWASMへ移植するか、ブラウザ向けのOSS計算ライブラリを組み合わせた別エンジンを導入する。C/C++だけでなくFortranやBLAS、疎行列、MPI等の依存を個別確認する。ブラウザ向けエンジンを作った場合は元のCalculiX等と同じソルバー名を名乗らない。

採用ゲート: ライセンスと再現可能ビルド → Workerで例題実行 → 参照値・収束確認 → 中止・メモリ不足処理 → Pages上で動作 → 公開対応リストへ追加。

CPU/GPUという実行バックエンドと、解析ソルバーの選択は分ける。WASMに変換するだけではGPU対応にならない。WebGPUではWGSL等で計算処理を用意し、演算精度、収束、CPU結果との差を検証する。倍精度がネイティブ同様に利用できると仮定しない。

大規模な非線形解析、CFD、広帯域音響はブラウザのメモリと計算時間が課題。実測から対応規模を決め、実行前に見積もりを表示。初期版の制限を隠して全候補ソルバー・全材料モデルの対応を約束しない。

## 公開

ユーザーの明示的な指示でソースリポジトリを公開へ変更し、GitHub Pagesでアプリと開発管理ボードを公開済み。

## 公式資料

- [GitHub Pagesの静的ホスティングとプラン](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Emscripten pthreadsと必要なヘッダー](https://emscripten.org/docs/porting/pthreads)
- [WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API)
