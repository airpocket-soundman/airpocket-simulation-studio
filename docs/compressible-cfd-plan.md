# 圧縮性CFDとメッシュフリー方式の調査と導入計画

[English](en/compressible-cfd-plan.md)

調査日: 2026-10-14（SU2・OpenFOAM系・HiSA・Eilmerの調査票は2026-10-16追記）。マッハ2で複雑な3D形状の周囲に生じる衝撃波、マッハ数、圧力係数等を、利用者の計算資源とエージェントから扱うことを目標とする。今回は資料調査と計画のみ。ソルバーの導入、ビルド、WASM移植、試験計算、自作実装は行っていない。

## ソルバー導入順の変更（2026-10-15）

次のソルバーの最優先対象を、牛型の固定ソリッドの周りの通常風速の外部流れに変更する。慣性を含む低Mach非圧縮粘性Navier–Stokesを既存OSSから評価し、対象Reに応じて非定常・乱流の必要性を確認する。既存Stokesの設定変更では実現しない。入出力・API/MCP/Skill整備の優先を維持し、導入はネイティブの単純参照問題から粗い牛型へ進める。[開発計画](roadmap.md)に受け入れ条件を示す。

以下のMach 2向け候補比較とEulerからの段階計画は、圧縮性を追加する後続段階の調査記録として保持する。通常風速の候補選定は別途必要であり、既存の超音速向け順位をそのまま転用しない。自作やメッシュフリー化は既存OSSで不足する要件を確認してから判断する。

## 現状と対象

現在のStokes流と十分発達した流路モデルから、慣性・圧縮性・衝撃波を扱うエンジンへ単に設定を変更することはできない。音響の微小圧力波解析も超音速CFDの代わりにはならない。圧縮性の質量・運動量・エネルギー保存、状態方程式、衝撃波捕獲、境界条件を持つ別アダプターが必要。

最初の範囲は理想気体・非粘性Eulerと固定物体。粘性Navier–Stokes、乱流、境界層、熱伝達、移動物体、流体構造連成、実在気体は別段階。Eulerによる衝撃波の可視化だけで、実物の全抗力・剥離・表面加熱の精度まで保証しない。

牛の画像は目標となる表現例で、使用コード・数値方式・検証条件は画像から特定していない。

## メッシュ不要の意味

| 方式 | 内部の離散化 | ユーザーへの利点と課題 |
|---|---|---|
| 境界適合メッシュ | 物体表面に沿う体積格子 | 既存の外部流資産が豊富。複雑形状と境界層のメッシュ生成が課題 |
| Cartesian格子と埋め込み境界 | 背景格子に物体境界を埋め込む | ユーザーのメッシュ作業を減らせる。内部はメッシュあり。切断セル、薄い隙間、壁境界精度を検証 |
| メッシュフリー | 粒子・点群と近傍関係 | 体積メッシュの接続を不要にできるが、点配置、解像度、壁、近傍探索、安定化は必要 |

製品目標の「形状を置くだけ」を、厳密なメッシュフリーと同一視しない。背景格子で目的を満たせるなら、粒子法へ移る前に評価する。

## OSS候補の比較

○は公開資料で確認、△は今回の用途に追加検証が必要、?は未確認。全候補ともAirpocket接続・WASM実行は未検証。以下の適性と優先度は資料に基づく判断であり、実測ランキングではない。

| 候補 | 方式 | 圧縮性と衝撃波 | 複雑な壁の外部超音速流への適性 | ネイティブ導入の論点 | 方針 |
|---|---|---|---|---|---|
| SU2 | 境界適合FVM/DG等 | ○ | ○、対象設定の検証が必要 | C++、serialを先に調査。MPI・追加機能は別依存 | 第一候補、基準解側 |
| OpenFOAM系 rhoCentralFoam | FVM | ○ | △、メッシュと設定が必要 | 配布系統・版を固定。既存Foundation候補とOpenCFD資料を混同しない | 代替・相互検証候補 |
| HiSA | OpenFOAM系の高速流アダプター候補 | ○ | ○、対象設定の検証が必要 | 対応するOpenFOAM版、ビルド依存、配布条件の確認 | 超音速専用の比較候補 |
| Eilmer/GDTk | メッシュベース | ○ | △、形状・格子準備の確認 | 主にD、C/Fortran/Lua等。移植の依存負担を確認 | 高速流の検証資料と代替候補 |
| AMReXとPeleC | AMR背景格子と埋め込み境界 | ○ | △、複雑境界の手法はあるが対象の検証が必要 | C++、GPU/MPI/化学等の構成を限定。AMReX単体は完成CFDソルバーではない | メッシュ作業削減の優先調査 |
| PySPH | SPH | ○、圧縮性例題あり | △、外部流・壁・流入流出は個別検証 | Pythonと生成コンパイルコード、OpenMP/OpenCL等。ブラウザへの直結とは扱わない | 粒子法の研究・試作候補 |
| Spheral | SPH/ASPH/CRKSPH等 | ○、圧縮性hydrodynamics | △、航空外部流向けの成立性を確認 | C++/Python、並列とビルド依存 | 保存性と圧縮性粒子法の参考候補 |
| GIZMO | MFM/MFV/SPH等 | ○、hydrodynamics | △、主用途の天体計算から壁付き外部流への適合は未確認 | 物理モジュールと並列依存の切り分け | MFM/MFV手法の参考、初期採用は保留 |

公開ライセンスの確認資料: SU2のLICENSEはLGPL 2.1、PySPHはBSD 3条項、SpheralはBSD 3条項、GIZMOの公開文書はGPLを案内。製品へ採用する際は固定した版の各依存・例題・配布物を含めて確認する。他候補の詳細条件は調査項目として残し、配布承認済みとは扱わない。

## WASMとネイティブの調査

SU2はserial構成とWindows等の導入資料があり、ネイティブ側の最初の候補に向く。WASM成立性は、依存を限定した構成、ファイルI/O、メモリ、スレッド、プロセス/API境界をソースで調査してから判断する。既存のC++だからそのまま移植できるとは扱わない。

PySPH等のPythonフロント、CUDA/OpenCL/GPU構成、MPIはそれぞれブラウザ対応と別問題。GPU対応はWebGPU対応を意味しない。全機能のWASM化を先行させず、ネイティブの基準と、小規模なWASM候補の役割を分ける。

候補ごとに固定版、依存、OS、実行形式、メッシュ/入力形式、結果形式、中間結果、停止・再開、メモリ見積もり、配布条件を調査票にする。現時点で公式WASM配布を確認した候補はないが、非存在の証明ではない。

## 無駄を減らす導入順序と判定点

| 段階 | 次の実装前に決めること | 再利用する成果 |
|---|---|---|
| 1 資料調査 | SU2を主候補に、代替の入力・出力・依存・ライセンスを比較。serialと圧縮性Eulerへ対象を限定 | 候補票、共通仕様、参照問題 |
| 2 既存ソルバーのネイティブ評価計画 | 衝撃波管・くさび・鈍頭物体で精度、保存、境界をどう評価するか | 解析設定、基準結果形式、診断・比較指標 |
| 3 形状からの運用計画 | 境界適合自動メッシュと背景格子を比較。入力形状の修復・検査範囲を定義 | CAD/STL管理、領域、単位、流入・流出・壁の契約 |
| 4 WASM最小構成の評価計画 | 依存限定で移植できるか、配信量・初期化・メモリ・時間が許容されるか | モジュール配信、Worker、共通APIとビューア |
| 5 メッシュフリー採否 | 同じ参照問題で精度・計算資源・壁と流入流出・頑健性を比較 | 検証資産と後処理を共有 |
| 6 自作判断 | 既存候補で満たせない要件と、改修・移植・自作の費用を具体化 | 差分だけを開発する範囲 |

「メッシュありを全面自作してからメッシュフリーを全面自作する」は基本にしない。まず既存OSSを基準にする。ネイティブ接続が製品を成立させる場合、ブラウザ移植の難しさだけを理由に全ソルバーを書き直さない。

## 自作が必要になった場合の段階案

1. ネイティブ/WASMで共有する保存変数、理想気体EOS、単位、境界・出力・診断を定義する。
2. 一次精度の1D有限体積Eulerと実績ある数値流束を最小範囲で実装する。HLLE等の頑健な基準と、HLLC等の接触波を扱う選択肢を検討する。
3. 正の密度・圧力、CFL、保存、境界、強い衝撃波と希薄波を検証してから、制限付き高次再構成を追加する。
4. 2D Cartesian格子、くさび・反射・膨張波へ進む。時間積分と空間高次化を同時に大量変更しない。
5. 複雑形状が主目的なら、埋め込み境界と点群/粒子方式を比較して片方を選ぶ。切断セルの安定化、壁、保存、点群の品質を検証する。
6. 3D、小さな複雑形状、局所細分化へ進む。CPU基準の検証後にWebGPU・並列化する。
7. 粘性、境界層、乱流、動く物体は、それぞれ参照問題と必要性を確認して追加する。

EOS、数値流束、時間積分、物理境界の意味、検証問題と結果契約は再利用対象。メッシュフリー化には近傍探索・勾配再構成・体積/面の扱い・保存・点配置・壁モデルが別途必要で、FVMのメッシュ配列を点に置き換えるだけでは成立しない。WCSPH等の低速液体向け設定をマッハ2の気体へそのまま使わない。

## 検証と可視化の計画

- 1D衝撃波管: 密度・圧力・速度、衝撃波/接触波位置、保存、正値性と解像度依存。
- マッハ2のくさび: 衝撃波角と圧力比を参照式へ照合。角度と流入状態を固定する。
- 鈍頭物体: 衝撃波位置、表面Cp、領域サイズ・空間/時間刻み依存。
- 壁・流入流出: 反射と透過、非物理的な負圧/密度、漏れ、境界からの影響を確認。
- 牛等の複雑形状: 最終デモとして扱い、参照問題の代わりにしない。閉鎖性、面向き、細い隙間、表面簡略化を記録。

現在の凸STL体積メッシュの制約では牛のような一般凹形状を扱えないため、別の表面形状/流体領域経路を計画する。複雑形状のWASM対応を現状の取り込み機能だけで保証しない。

結果契約は節点・セル・粒子を区別し、密度、圧力、速度、温度、Mach、時間、残差と収支を保持する。Cpは自由流基準を保存し、シュリーレン風表示は密度勾配として定義する。断面、等値面、流線、時系列を共通ビューアへ接続し、保存/出力間隔と計算時間刻みを区別する。

## 調査票（CFDRESEARCH1、取得日 2026-10-16）

実装・ビルド・試験計算・バイナリ取得は行っていない。各行の根拠は表末の番号付き出典。区分は【確認】=出典で直接確認、【推定】=確認事項からの推論、【未確認】=今回確認できず。ネットワーク取得は公式ページ・GitHub/GitLab API・生ファイルの読取のみ。

### 固定版・ライセンス・配布

| 候補 | 固定候補 | ライセンスと配布条件 | 区分 |
|---|---|---|---|
| SU2 | v8.5.0（2026-04-27、GitHub API）。公式zipはlinux64-mpi/omp、macos64、win64-mpi/omp（win64-ompは28,043,921 B）[S1] | LGPL 2.1。LICENSEは同梱の第三者通知も含む。ParMETIS/METISは非営利の教育・研究用途のみ自由で、営利は評価のみ・再配布は事前承認が必要、TecIOはTecplot条件、CGNSはzlib系、CLI11はBSD 3条項[S2] | 【確認】。ParMETIS同梱を除く構成なら再配布可能かは【未確認】（MPI無しビルドでの除外はmeson.buildの条件分岐から【推定】） |
| OpenFOAM Foundation | v14（2026-07-14）、v13（2025-07-08）[S3] | GPLv3（公式フッター）[S4]。商標は別 | 【確認】 |
| OpenFOAM ESI/OpenCFD（Keysight） | v2606（2026-06-26）、v2512（2025-12-22）[S5] | 「GPL Licenseで配布」（版は同ページ未記載）。ソース、Linux/Windows/macOS向け事前ビルドあり[S6] | 【確認】。GPL版の細目は【未確認】 |
| HiSA | OpenCFD v2512向け1.13.4（tag validated-v2512、2026-04-03）、Foundation v13向け1.13.2（validated-v13、2025-08-10）。対応: OpenCFD 2006〜2512、Foundation 9〜13[S7] | GitLabのLICENSEはGPLv3 only[S8]。公式サイトは明記せず、OpenCFD非推奨の注記あり | 【確認】。OpenFOAM v14/v2606対応は【未確認】 |
| Eilmer/GDTk | v5.0.0（2025-12-31）。前はv4.1.0（2022-02-23）[S9] | GPLv3。文書はCC BY-SA 4.0[S10] | 【確認】。GitHub Releasesは空でtagのみ |

HiSAのOpenFOAM依存: Foundation最新v14は未対応と読めるため、Foundation系を使う場合はv13固定が必要【推定】。ESI系はv2512固定。いずれもGPLのため、ユーザーがダウンロードして自機で実行する構成は成立しやすいが、Studioのバンドル再配布は版ごとにGPL/LGPLの頒布条件（ソース提供・通知）を満たす必要があり、法的判断はこの調査の範囲外。

### 依存・ビルド・実行規模

| 候補 | 依存とビルド | WASM/ブラウザ | 区分 |
|---|---|---|---|
| SU2 | C++17、meson（要>=1.8.2）、Python。基本の直列ビルドは外部ライブラリ不要で、Eigen・CLI11・mel・Catch2は同梱。MPI時はMETIS/ParMETIS、オプションにCGNS、TecIO、PaStiX、BLAS、CoolProp、Mutation++等[S11, S12] | Emscripten移植の公開例は検索で見つからず【未確認】。C++17でファイルI/O中心の単一ソルバーのため、依存を絞れば技術的には可能性があるが、メモリ上限・スレッド・ファイルシステム仮想化は【推定】で未検証 | 配布zipは約28〜38 MB（展開後は【未確認】） |
| OpenFOAM（両系統） | 大規模C++、wmake独自ビルド、ThirdParty（MPI等）別アーカイブ[S13]。環境変数と多数の共有ライブラリに依存 | 公開の移植例は検索で見つからず【未確認】。動的ライブラリ読込、シェル駆動、MPI前提のため直接移植は困難【推定】。Windows向けは事前ビルドあり | 展開後の規模は【未確認】 |
| HiSA | OpenFOAMの上にAllwmakeで追加ビルド。cfMesh改造版は任意[S7] | OpenFOAMに従属。独立移植は不可【推定】 | |
| Eilmer | D言語（ldc2）、gfortran（32bitライブラリ）、C、readline、ncurses、OpenMPI、plotutils、Python/Ruby FFI等。Lua同梱[S14] | LDCはWebAssembly対象を2018年から持つが、druntime/WASIの完成度を示す2025〜2026の資料は見つからず【未確認】。Fortran、Lua、ネイティブFFIを含むため【推定】で困難 | |

### 入出力・中間結果・停止再開

| 候補 | 入力 | 出力 | 残差・中間結果 | 停止・再開 |
|---|---|---|---|---|
| SU2 | .cfg + .su2（ASCII、節点/要素/MARKER_TAG）またはCGNS（単一ゾーン非構造、ADFのみ）。Gmshは.su2へ出力して使う[S15] | OUTPUT_FILES既定はRESTART、PARAVIEW、SURFACE_PARAVIEW。CSV、TECPLOT、STL等も選択可。VOLUME_OUTPUTで場を選択、RES_接頭辞で残差場も保存[S16] | history出力（RMS_RES、AERO_COEFF等）、SCREEN_OUTPUT、-dで項目一覧。出力頻度は設定可。【確認】 | RESTART_SOL=YESと再開用ファイル、非定常はRESTART_ITER[S12]。ソフト停止（信号・停止ファイル）の有無はCDriver.cppの前半に見当たらず【未確認】。SIGTERMによる中断は外部プロセス停止で代替【推定】 |
| OpenFOAM | case/ディレクトリ（system、constant、0）。メッシュはblockMesh、snappyHexMesh等 | 時刻ディレクトリ（ascii既定、binary可）。ParaView用変換は別 | 残差のログ化はfunction object等【未確認】。controlDictでwriteControl指定[S17] | startFrom latestTime、stopAt writeNow/nextWriteで書き出し後停止、runTimeModifiableで動的再読込[S17]。mid-run反映の詳細は【未確認】 |
| HiSA | OpenFOAMのcase形式[S7] | OpenFOAM形式 | 局所時間刻みで定常収束。残差出力の形式は【未確認】 | OpenFOAMに従う【推定】 |
| Eilmer | Luaスクリプト（prep）からグリッド・設定を生成。構造・非構造格子（sfluidblock/ufluidblock） | VTK、Tecplot（tecio）等のwriter、history、loads[S18] | history.d、loads.dあり。halt_on_large_flow_changeを設定にもつ[S19] | max_step、max_time、halt_nowフラグ、.controlファイル再読込（control_count）[S19]。再開は準備スクリプトe4-prep-restartがある【確認】が運用は【未確認】 |

### 圧縮性外部流れの境界条件

| 候補 | 確認できた対応 |
|---|---|
| SU2 | MARKER_EULER（滑り壁）、MARKER_FAR（遠方場）、MARKER_SUPERSONIC_INLET、MARKER_SUPERSONIC_OUTLET、MARKER_INLET、MARKER_OUTLET、MARKER_SYM、MARKER_HEATFLUX、MARKER_ISOTHERMAL（無滑り壁）。SOLVERはEULER/NAVIER_STOKES/RANS、対流法にROE、AUSM系、HLLC等[S20]。【確認】（config_templateの説明文）。各BCがマッハ2の非構造3D形状で安定かは【未確認】 |
| OpenFOAM rhoCentralFoam | 過渡の密度ベース解法でKurganov-Tadmorの中心風上、熱伝達と衝撃捕獲を含む。p、U、Tが必須、乱流と熱物性は設定ファイル[S21]。個別BCの網羅は【未確認】（OpenFOAMのBC一式は別資料で確認する） |
| HiSA | 非反射遠方場と反射壁の特性境界条件、局所時間刻み、陰的連成系、衝撃捕獲スキーム、移動メッシュ（ALE）[S22]。個別BC名は【未確認】 |
| Eilmer | bc/ディレクトリ（超音速流入等の存在はファイル名から【推定】）。例題に鈍頭くさび、6度くさび、斜め衝撃、球、円柱、衝撃波管、前向きステップがある（ディレクトリ名のみ、内容は【未確認】）[S23] |

### 検証問題と採否条件

共通方針: 同一のSI単位・理想気体（γ=1.4）・同一の自由流状態で、候補ごとの出力を共通結果契約へ変換して比較する。以下の許容値は暫定の判定指標で、実測前の仮値（実測で見直す）。

| ID | 問題 | 参照 | 採用側の見る指標（暫定） |
|---|---|---|---|
| V1 | 1D衝撃波管（Sod型、無次元） | 厳密リーマン解 | 衝撃波・接触波位置、密度・圧力の保存、正値性。格子倍化でL1誤差が単調減少 |
| V2 | マッハ2・くさび半角10度の斜め衝撃波 | θ-β-M関係と斜め衝撃波前後の圧力比 | 衝撃波角と圧力比の相対誤差が格子細分で減少。暫定目標は1%以下 |
| V3 | マッハ2・鈍頭円柱または球 | 衝撃離脱距離の既往相関と、候補同士の相互比較 | 表面Cp分布、離脱距離。候補間差は参照値の不確かさ（相関の公表幅）以内 |
| V4 | 流入出・遠方場の反射 | 一様流の保持と領域サイズ依存 | 一様流を置いた時の自由流からの逸脱が小さく、領域を拡大しても結果が変わらない |
| V5 | 粗い牛形状（最終デモ、参照値なし） | 参照解は使わない | 表面閉鎖性、実行完了、保存収支、密度勾配の可視化のみ。精度保証とはしない |

採否の判定（全て満たして採用候補に進む）:

1. 固定版・ライセンス・依存が上表で【確認】に揃い、ユーザーのダウンロード利用またはバンドルが許容される。
2. V1・V2でSI単位の入出力を変換でき、許容内で再現する。
3. 中間結果（残差履歴または場）を実行中に取得でき、停止と再開が手順として確立する（SU2は停止の検証、OpenFOAMはstopAt/latestTime、Eilmerはmax_step/halt_now/再開で実測確認）。
4. V3・V4で非物理的な負圧・負密度が出ず、遠方場が成立する。
5. メモリと実行時間がユーザーの計算資源で見積もれる。WASM採用の場合は配信量・初期化・メモリ上限が別途許容される。

却下条件: ライセンス条件を満たせない、版固定ができない、V1/V2を再現できない、停止・再開が手順化できない、依存がStudioの配布形態で扱えない。WASMは採否の必須条件にせず、ネイティブ基準を先に評価する（既存方針）。

### 暫定の推奨（推定を含む）

- SU2 v8.5.0を第一候補のまま維持。公式zip、CLI、メッシュ形式、BC、履歴、再開の文書が揃っているため。ParMETIS同梱部の条件は営利再配布で課題になりうるので、バンドルではなく利用者ダウンロード方式を先に設計する【推定】。
- OpenFOAM系は相互検証候補。Foundation v14とHiSA 1.13.2(v13)の版差に注意し、検証用にはv13+HiSAまたはv2512+HiSA 1.13.4のどちらか一つを固定する【推定】。
- Eilmerは検証資料としての例題が豊富だが、ビルド依存が重く、WASMは困難と見る【推定】。
- ブラウザ内WASM化の可否は、どの候補も実証されておらず【未確認】。次段階で最小構成の試験が必要。

### 出典（取得日 2026-10-16）

- S1: https://api.github.com/repos/su2code/SU2/releases/latest 
- S2: https://github.com/su2code/SU2/blob/master/LICENSE.md
- S3: https://openfoam.org/download/history/
- S4: https://openfoam.org/download/14-source/
- S5: https://www.openfoam.com/news/main-news
- S6: https://www.openfoam.com/news/main-news/openfoam-v2606
- S7: https://hisa.gitlab.io/download/
- S8: https://gitlab.com/hisa/hisa/-/blob/master/LICENSE
- S9: https://github.com/gdtk-uq/gdtk/tags
- S10: https://github.com/gdtk-uq/gdtk
- S11: https://raw.githubusercontent.com/su2code/SU2/v8.5.0/meson.build
- S12: https://su2code.github.io/docs_v7/Installation/ ・ https://raw.githubusercontent.com/su2code/SU2/v8.5.0/meson_scripts/init.py
- S13: https://openfoam.org/download/14-source/
- S14: https://github.com/gdtk-uq/gdtk （READMEのQuick Start）
- S15: https://su2code.github.io/docs_v7/Mesh-File/
- S16: https://su2code.github.io/docs_v7/Custom-Output/
- S17: https://doc.cfd.direct/openfoam/user-guide-v13/controldict
- S18/S23: https://github.com/gdtk-uq/gdtk/tree/master/src/eilmer ・ https://api.github.com/repos/gdtk-uq/gdtk/contents/examples/eilmer/2D
- S19: https://raw.githubusercontent.com/gdtk-uq/gdtk/master/src/eilmer/globalconfig.d
- S20: https://raw.githubusercontent.com/su2code/SU2/v8.5.0/config_template.cfg
- S21: https://doc.openfoam.com/2212/tools/processing/solvers/rtm/compressible/rhoCentralFoam/
- S22: https://hisa.gitlab.io/
- WASM関連の検索（SU2/OpenFOAMの移植例なし、LDCのWebAssembly履歴）: 各検索結果。LDC 1.11（2018）でWebAssembly対象追加、現状は未確認。

### 今回未検証の事項

SU2のソフト停止機構、ParMETISを外した再配布の可否、各ソルバーのMach 2での実BC動作、OpenFOAMの残差出力方式の詳細、HiSAの個別BC名とv14対応、Eilmerの再開手順と停止ファイル、全候補の展開後サイズ・メモリ量・WASM成立性。ライセンスの法的解釈は今回の範囲外で、採用時に版ごとに確認する。

## 結論と残る調査

SU2をメッシュありの第一調査候補、AMReX/PeleCを形状準備の負担を減らす候補、PySPH/Spheralをメッシュフリーの検討候補とする。自作は未決定。候補ごとの固定版と依存一覧、WASMビルド成立性、複雑な壁・流入流出の例題、採否指標と許容誤差は次の調査項目。

一次資料の一部は旧版ガイドであり、最新の固定版へ適用する前に照合が必要。PeleCは現在Pele-Suite配下へリダイレクトされ、旧ドキュメントURLには取得不能箇所がある。機能・保守状況・配布条件は採用時に再確認する。

## 一次資料

- [SU2ソース](https://github.com/su2code/SU2)・[理論](https://github.com/su2code/su2code.github.io/blob/master/_docs_v7/Theory.md)・[導入](https://su2code.github.io/docs_v7/Installation/)・[ライセンス](https://github.com/su2code/SU2/blob/master/LICENSE.md)
- [OpenCFD系rhoCentralFoam](https://doc.openfoam.com/2212/tools/processing/solvers/rtm/compressible/rhoCentralFoam/)
- [HiSA](https://hisa.gitlab.io/)
- [Eilmer/GDTk](https://github.com/gdtk-uq/gdtk)
- [AMReX](https://github.com/AMReX-Codes/amrex)・[埋め込み境界の説明](https://amrex-codes.github.io/amrex/docs_html/_downloads/008eb6dbfab802633dff40122ece848c/amrex.pdf)・[PeleC](https://github.com/Pele-Suite/PeleC)
- [PySPH](https://github.com/meshfree-research/PySPH)・[ライセンス](https://github.com/meshfree-research/PySPH/blob/master/LICENSE.txt)
- [Spheral](https://github.com/llnl/spheral)
- [GIZMO手法論文](https://arxiv.org/abs/1409.7395)・[公開文書](https://www.tapir.caltech.edu/~phopkins/Site/GIZMO_files/gizmo_documentation.html)
