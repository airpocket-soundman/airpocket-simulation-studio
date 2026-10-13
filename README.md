# Airpocket Simulation Studio

3Dモデル上で解析領域を指定し、OSSソルバーで構造・熱・流体・振動音響を解析するアプリの開発計画。

現状は3D領域設定の試作版。STEPのWASM読み込み、STL表示、回転・拡大、CAD面選択、曲面ブラシ選択、固定・荷重の登録、JSON保存・復元を実装。体積メッシュ生成と解析ソルバーは未実装。

アプリ: https://airpocket-soundman.github.io/airpocket-simulation-studio/

開発: `npm ci` → `npm run build` → `npm run dev`。検証: `npm test`。mainへのpushでGitHub ActionsがビルドしPagesへ公開。

現在の部分選択は表示三角形による近似で、CAD面分割・再メッシュへの領域転送は未実装。STEP読込は表示用の三角形と元のCAD面の対応を取得する段階で、正確なCAD形状編集はまだできない。

- [実装する機能](docs/features.md)
- [ソルバー候補と選択方式](docs/solvers.md)
- [材料モデル](docs/materials.md)
- [振動・音響の解析](docs/acoustics.md)
- [構成とプロジェクト分割の判断](docs/architecture.md)
- [開発順序と受け入れ条件](docs/roadmap.md)

作成日: 2026-10-13

配布方針: GitHub Pagesで公開するWebアプリ。計算はブラウザのWeb WorkerとWASMでローカルCPUを使用し、GPU計算はWebGPU対応を検証して追加する。[ブラウザ実行設計](docs/browser-runtime.md)。ユーザーの指示でソースリポジトリを公開へ変更。[利用ライブラリ](THIRD_PARTY.md)。
