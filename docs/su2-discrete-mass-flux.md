# SU2離散境界質量流束の取得可否（CFD1 / 61）

[English](en/su2-discrete-mass-flux.md)

2026-10-23。**既存SU2アダプターから離散境界数値流束を取得する経路は未実装。CFD1の質量収支受入は未達。** `su2Capabilities().discreteBoundaryMassFlux` と新しい実行結果metadataは `supported:false`、`SU2_DISCRETE_BOUNDARY_FLUX_UNAVAILABLE` を返す。`requireSu2DiscreteMassFlux` は同じcodeで拒否し、節点診断や自己申告CSVを数値流束として受理しない。通常hostの認証付きcapabilitiesにも反映される。

## 一次ソースと実行物の確認

公式v8.5.0 tagをcommit `12eb826f049ef7f67df974dfcb44cf36ee07c0f8` に固定した。[CFlowOutput.cpp](https://github.com/su2code/SU2/blob/12eb826f049ef7f67df974dfcb44cf36ee07c0f8/SU2_CFD/src/output/CFlowOutput.cpp#L194-L261)の `MARKER_ANALYZE` / `SURFACE_MASSFLOW` は節点の密度・速度・境界normalを用いる診断である。[CIncEulerSolver.cpp](https://github.com/su2code/SU2/blob/12eb826f049ef7f67df974dfcb44cf36ee07c0f8/SU2_CFD/src/solvers/CIncEulerSolver.cpp#L2215-L2303)の境界残差加算とは取得経路が異なる。[FDS実装](https://github.com/su2code/SU2/blob/12eb826f049ef7f67df974dfcb44cf36ee07c0f8/SU2_CFD/src/numerics/flow/convection/fds.cpp#L219-L228)は両側の値と散逸を用いるため、節点積分で代替しない。

既存固定SHAのSU2_CFD.exeに `-d discovery.cfg` のfield discoveryだけを実行。最大10秒・stdout/stderr合計2MiB、追加downloadなし。初回はmesh次元情報不足でexit1、次元header `NDIME=2` だけのstubを置いた再試行はexit0。これは有効な計算meshではなく、反復・解法実行・物理試験ではない。rawには `SURFACE_MASSFLOW` の診断fieldがあるが、FDS数値境界流束の取得を裏付けるfieldは確認できなかった。ソース・実行物・設定・raw出力のhashは[証拠](evidence/2026-10-23-opencode-61-cfd1.json)に保持した。

## 不足機構と次の実装境界

必要なのは、境界処理で `ComputeResidual` 後、`LinSysRes.AddBlock` と同じ数値寄与をmarker別に保持する専用instrumentation。domain所有節点のみを数え、MPI/threadの二重加算を避け、壁を含む全境界の寄与を同じiterationで確定する。外向き符号へのnormal反転箇所を保持し、数値寄与の成分と物理質量流束の単位・次元2でのspan正規化を別途証明する必要がある。現時点ではその対応を推測しない。

exportには固定solver/source/config/input/result版、iteration、次元、marker、符号、単位、完全性、raw hashを持たせる。出力形式を実物で確認後、欠落・重複・非有限・版不一致を拒否する有界parserを作る。今回はsolver patch/build、parser形式の発明、config変更によるsolveは実施していない。

将来の収支は外向き正でnetを和、相対分母をinflow/outflowの大きい方とする。両方0なら絶対条件だけで判定し、ゼロ除算で成功を作らない。絶対/相対許容は次の実行前に物理単位・出力精度・参照ケースに基づいて固定する。今回は実離散流束なしのため、収支値も許容達成も報告しない。既存節点遠方積分とCfD参照の残課題は維持する。
