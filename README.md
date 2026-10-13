# Airpocket Simulation Studio

[English](README.en.md)

3Dモデル上で解析領域を指定し、OSSソルバーで構造・熱・流体・振動音響を解析するアプリの開発計画。

v0.5ではSTEP・組込み形状の体積メッシュ、線形構造解析、定常・非定常熱伝導（対流放熱・合計熱入力を含む）、局所細分化と再解析、周波数音響・スイープ・結果測定を実装。[使い方と対応範囲](docs/analysis-guide.md)。流体・吸音境界・非線形・破壊・接触はまだ未対応。

アプリ: https://airpocket-soundman.github.io/airpocket-simulation-studio/

開発管理ボード: https://airpocket-soundman.github.io/airpocket-simulation-studio/development.html

公式進捗は src/progress.json で管理し、公開時に更新する。ローカル開発メモは各ブラウザだけに保存し、JSONで書き出せる。

開発: `npm ci` → `npm run build` → `npm run dev`。検証: `npm test`。mainへのpushでGitHub ActionsがビルドしPagesへ公開。

現在の部分選択は表示三角形による近似で、CAD面分割は未実装。再メッシュへの転送は投影近似で、面積誤差を表示し15%を超える場合は停止する。STEP読込は表示用の三角形と元のCAD面の対応を取得する段階で、正確なCAD形状編集はまだできない。

- [実装する機能](docs/features.md)
- [ソルバー候補と選択方式](docs/solvers.md)
- [材料モデル](docs/materials.md)
- [振動・音響の解析](docs/acoustics.md)
- [構成とプロジェクト分割の判断](docs/architecture.md)
- [開発順序と受け入れ条件](docs/roadmap.md)
- [APIと高速な検証](docs/testing.md)

作成日: 2026-10-13

配布方針: GitHub Pagesで公開するWebアプリ。計算はブラウザのWeb WorkerとWASMでローカルCPUを使用し、GPU計算はWebGPU対応を検証して追加する。[ブラウザ実行設計](docs/browser-runtime.md)。ユーザーの指示でソースリポジトリを公開へ変更。[利用ライブラリ](THIRD_PARTY.md)。

追加仕様: [適応メッシュ](docs/adaptive-meshing.md)、[3Dプリント部品（最終段階の任意機能）](docs/printed-parts.md)。画面右下のJP / ENで言語を切り替えられます。
