# SU2ネイティブ外部流れの導入状況

[English](en/su2-native.md)

2026-10-15。実験用アダプターは`scripts/su2-native.mjs`。製品のブラウザソルバー、GUI、MCPにはまだ登録していない。既存のWASM解析とは別のネイティブ実行経路であり、ブラウザだけで利用できる完成機能ではない。

SU2 v8.5.0公式Windows OpenMP配布物で起動と公式の定常非圧縮円柱例題を確認した。公式設定の5000反復上限に対し105反復で圧力のlog10残差-10.0074に到達し、VTU速度・圧力場を生成した。これは起動・計算経路の確認であり、独立参照解との精度検証や牛の解析ではない。例題の密度998.2 kg/m³、粘度0.000798 Pa·s、速度8e-6 m/sを牛の空気条件へ転用しない。

配布元: https://github.com/su2code/SU2/releases/tag/v8.5.0 。`SU2-v8.5.0-win64-omp.zip`のGitHub提供SHA-256は`4466fe21aedb5e0bad57afd45f829acbdec6ec79fe8c3f8954ddea06a4b4bc11`。アーカイブ内のwin64-omp.zipをさらに展開する。システムPATHや常駐サービスは変更しない。取得時にハッシュを照合する。SU2のライセンス・通知を取得物とともに保持し、製品への再配布条件の整理は別途必要。

アダプターは明示した物性・速度・m単位の既存SU2メッシュ・壁/遠方境界名・反復上限・残差目標から設定を生成する。新しいジョブディレクトリだけに書き込み、シェルを使わず1スレッドで起動する。中間CSV残差、入力/メッシュ版、最終VTU/CSVのハッシュを返す。取消・時間切れは子プロセスのcloseを待つ。圧力残差の達成、プロセス正常終了、物理精度を区別し、結果は暫定とする。

残作業は、独立参照値と収支/収束検証、3Dメッシュと境界層、対象Reでの乱流/非定常の選定、VTUの共通結果への変換、共有ジョブ・MCP・ブラウザ接続、保存/表示/出力、配布Skillと実行例。これらが揃ってから牛型モデルを実行する。WASM移植は先行条件にしない。

公式例題設定: https://github.com/su2code/SU2/blob/v8.5.0/TestCases/incomp_navierstokes/cylinder/incomp_cylinder.cfg 。メッシュ: https://github.com/su2code/TestCases/tree/master/incomp_navierstokes/cylinder 。メッシュの固定commitとハッシュは再現可能な取得スクリプトで固定することが残課題。

アダプター実測ではCFL 100・多重格子3段を明示し、56反復で圧力log10残差-6.00649に到達した。実プロセスの取消・時間切れも終了待機を確認。数値設定は公式例題とは異なる。[検証記録](evidence/2026-10-15-su2-native.json)。Windowsでの任意セットアップは`node scripts/setup-su2.mjs`。モジュール読込だけではダウンロードしない。
