# Airpocket Simulation Studio

[English](README.en.md)

3Dモデル上で解析領域を指定し、構造・熱・流体・振動音響をローカル計算するWebアプリ。

v0.30はSTEP・組込み形状の体積メッシュ、線形構造・指定変位・熱応力、圧縮性Neo-Hookean有限ひずみ、定常/非定常熱伝導・対流・熱放射・平面接触熱抵抗、局所/適応細分化と収束診断、周波数/過渡音響・外部放射・指向性・WAV、固有振動と直方体モードから音への一方向連成、CAD内側の点と箱端面による内部流体抽出、CAD認識した円形/角形の十分発達した層流流路、断面表示・測定・ケース比較に対応。構造にはAirpocketと独立したMFEM 4.10 WASMエンジンを選択でき、Airpocket構造のWebGPU + CPU補正も実装。[使い方と対応範囲](docs/analysis-guide.md)。一般3D流体、塑性・破壊、機械的接触、ほぼ非圧縮のゴム、一般曲面/双方向の音響連成と他の候補ソルバーの移植は残作業です。

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

配布方針: GitHub Pagesで公開するWebアプリ。計算はブラウザのWeb WorkerとWASMでローカルCPUを使用し、構造のWebGPU計算は倍精度CPU補正付きの試験版。[ブラウザ実行設計](docs/browser-runtime.md)。ユーザーの指示でソースリポジトリを公開へ変更。[利用ライブラリ](THIRD_PARTY.md)。

追加仕様: [適応メッシュ](docs/adaptive-meshing.md)、[3Dプリント部品（最終段階の任意機能）](docs/printed-parts.md)。画面右下のJP / ENで言語を切り替えられます。

[外部流体領域の作成と制限](docs/fluid-domains.md)

[WebGPU計算とCPU補正の対応範囲](docs/webgpu.md)

[MFEMの独立エンジンとビルド手順](docs/native-solvers.md)

- [材料の温度・速度・方向性](docs/material-dependence.md)

- [ゴムの有限ひずみ解析](docs/hyperelasticity.md)

- [外部放射と遠方界の指向性](docs/exterior-acoustics.md)

- [過渡音響](docs/transient-acoustics.md)

- [固有振動](docs/modal-analysis.md)

- [振動から外部音響への一方向連成](docs/vibration-acoustics.md)

- [CADから内部流体領域を取り出す](docs/internal-fluid.md)

[解析断面と測定](docs/result-sections.md)

[平面矩形のCAD分割](docs/planar-regions.md)
