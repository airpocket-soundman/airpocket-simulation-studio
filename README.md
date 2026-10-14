# Airpocket Simulation Studio

[English](README.en.md)

3Dモデル上で解析領域を指定し、構造・熱・流体・振動音響をローカル計算するWebアプリ。

v0.42はSTEP・組込み形状と閉鎖した単一凸STLの体積メッシュ、線形構造・指定変位・熱応力、正の等方硬化を持つJ2微小ひずみ塑性の指定倍率による載荷履歴・弾性除荷、圧縮性Neo-Hookean有限ひずみ、単軸比例線形弾性のS–N疲労評価、外部CAD周囲の定常3D低Reynolds数Stokes流、定常/非定常熱伝導・対流・熱放射・平面接触熱抵抗、局所/適応細分化と収束診断、周波数/過渡音響・外部放射・指向性・WAV、固有振動と直方体モードから音への一方向連成、CAD内側の点と箱端面による内部流体抽出、CAD認識した円形/角形の十分発達した層流流路、断面表示・測定・ケース比較に対応。構造にはAirpocketと独立したMFEM 4.10 WASMエンジンを選択でき、Airpocket構造のWebGPU + CPU補正も実装。J2塑性はAirpocket CPU専用で、MFEM/WebGPU・適応解析・固有振動・熱応力との組み合わせは未対応です。[使い方と対応範囲](docs/analysis-guide.md)、[J2塑性の設定と制限](docs/plasticity.md)、[閉鎖STLの体積メッシュ](docs/stl-meshing.md)、[S–N疲労評価の設定と制限](docs/fatigue.md)、[Stokes流の設定と精度限界](docs/stokes-flow.md)。慣性を含む一般Navier–Stokes流・乱流、有限ひずみ塑性・塑性疲労・多軸疲労・複雑な繰返し載荷の実験校正・亀裂進展・破壊、機械的接触、ほぼ非圧縮のゴム、一般曲面/双方向の音響連成と他の候補ソルバーの移植は残作業です。

疲労評価には完全両振り（応力比−1）の実測S–N振幅曲線と試験条件・出典が必須です。引張平均応力へのGoodman補正と単一一定振幅のMiner使用率に対応し、登録範囲外の寿命は外挿しません。材料名や引張強さだけでは寿命数値を生成しません。

Stokes流は外部直方体領域、Re≤0.1、最大2000節点・8000四面体のCPU GMRES試作です。流体の粘度・密度を入力し、外箱の一様速度と固体no-slipを使います。慣性・乱流を含まず、有限外箱の抗力は無限領域の球の厳密抗力とは異なります。v0.42は232テスト、公開配信物26項目、公開画面38項目を確認済みです。

アプリ: https://airpocket-soundman.github.io/airpocket-simulation-studio/

開発管理ボード: https://airpocket-soundman.github.io/airpocket-simulation-studio/development.html

公式進捗は src/progress.json で管理し、公開時に更新する。ローカル開発メモは各ブラウザだけに保存し、JSONで書き出せる。

開発: `npm ci` → `npm run build` → `npm run dev`。検証: `npm test`。mainへのpushでGitHub ActionsがビルドしPagesへ公開。

STLの体積メッシュは最大2000三角形、外向きの単一閉鎖凸形状に限定します。穴、複数殻、凹形状、不整合な面は拒否し、自動修復は行いません。STLの条件選択は三角形単位で、再メッシュへの転送は投影近似です。面積誤差を表示し15%を超える場合は停止します。STLの適応解析・CAD領域分割・流体領域生成は未対応です。STEPでは平面矩形・円筒領域のCAD分割に対応し、その他の曲面部分領域は投影近似です。一般的なCAD形状編集には対応していません。

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

[円筒の部分領域をCAD分割](docs/cylindrical-cad.md)

[斜め平面と回転指定](docs/oblique-planar.md)

[画像・アニメーション出力](docs/visual-export.md) · [MCPと専用skill](docs/automation.md)

v0.39は公開樹脂物性91件（メーカー87件・特許試験配合4件）を同梱。PP・PE・ABSのガラス／タルク含有率違いとPC・PA66・POM・PS・PSU・PPSに加えPBT・PET・PA6・PEEK・PC/ABSを検索・比較できます。等方近似とポアソン比の仮定を明示して適用し、出典と手修正を保存します。[材料ライブラリ](docs/polymer-library.md)。

v0.40ではStokesのP2/P1 Taylor–Hoodを選択でき、保存・点測定・断面表示にも二次速度を反映します。[設定と制限](docs/stokes-flow.md)。

v0.42ではSTEP更新前に面と条件を照合し、未解決の条件を保存・再選択できます。未解決中の解析は拒否します。[CAD更新](docs/cad-update.md)。

[v0.42の脆性破壊評価](docs/brittle-fracture.md): 欠陥寸法・靱性・残留応力の上下限と表面状態を登録し、静的線形弾性のモードI公称応力を評価します。き裂進展・破壊確率・寿命は未対応です。
