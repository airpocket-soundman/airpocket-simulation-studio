# SU2ネイティブ外部流れの導入状況

[English](en/su2-native.md)

2026-10-15。実験用ネイティブアダプター、固定ケース用loopbackホスト、Studio内の表示パネルとブラウザAPIを実装。既存WASM解析とは別経路であり、公開版・通常の解析選択・既存MCPツールへの統合は未完了。任意CADの自動メッシュ作成機能ではない。

## 牛モデルでの直接実行とStudio実行

利用者確認済みの条件は20℃相当の空気、5 m/s、顔から尾、地面なし。代表仮定値は密度1.204 kg/m³、粘度1.81e-5 Pa·s。定常非圧縮RANS、SA、標準壁関数、SU2 FREESTREAM_NU_FACTOR=10を明示した。入力名freestreamNuFactorを推奨し、最初の試験で使ったturbulentViscosityRatioは同じパラメータの旧名として互換扱いする。SAの修正動粘度と分子動粘度の比であり、乱流渦粘度比そのものとは扱わない。

Gmsh WASM 0.3.0で牛のSTEPをmへ正規化し周囲の空気を四面体化した。7,716節点・37,455四面体、牛表面4,262三角形。プリズム境界層はない。直接実行後、実StudioページのnativeFlowApi.startJobから別プロセスを起動し、同じ入力・メッシュ・設定で184反復まで再計算した。圧力7,716値、速度23,148値、メッシュ、表面圧力、VTU/履歴のSHA-256が一致し、最大差は0だった。[記録](evidence/2026-10-15-cow-flow-equivalence.json)、[比較画像](evidence/2026-10-15-cow-flow-comparison.png)。実ブラウザはheadless Chromeで、デスクトップ操作はしていない。

これは経路の再現性の確認で、物理精度の検証ではない。停止条件は圧力log10残差-5のみ。速度・乱流残差は未達で、壁関数のy+計算も最終反復116点で未収束。最大y+は約1706。アダプターは圧力の停止条件達成と全数値収束を区別し、SU2_WALL_MODEL_NOT_CONVERGEDと修正候補を返す。この結果を抗力や局所圧力の定量評価へ使わない。

## ローカル接続

1. Windows x64の任意セットアップ: node scripts/setup-su2.mjs。モジュール読込時の取得やシステムPATH変更は行わない。
2. 検査したSU2メッシュと承認済み入力を用意する。初期の牛メッシュは作業領域の.qa/cow-flow/cow.su2に保持。入力は上の検証記録のinputを参照する。メッシュ生成は現時点で独立した準備工程。
3. origin、executable、meshPath、outputRoot、approvedInputを持つローカルJSONを作り、node scripts/native-flow-host.mjs approved-case.jsonで起動する。originは実際のStudioの完全なorigin。ファイルパスは絶対パスで指定する。
4. Studioの「外部流れ（ネイティブ・試験版）」で接続先と接続コードを入力し、条件を確認して実行する。ローカル開発サーバーとの接続だけを検証した。公開HTTPSからの接続は未検証。

ホストは127.0.0.1のみで待ち受け、Origin/Host/Bearerを検査する。実行対象は設定済みメッシュと承認済み入力に限定し、クライアントから任意ファイルパスを受け取らない。同時1ジョブ・保持4ジョブ、取消と終了待機、結果のSHA-256照合を使う。既存MCP接続とは独立した試験用の認証であり、その権限を流用しない。

## APIと制限

window.nativeFlowApiのconfigure、connect、startJob、getJob、cancelJob、getResult、showResult、setField、capture、getDisplayedResultを使う。開始は実計算であり、showResultは取得済み結果の表示。入力を変えずに結果を取得し、圧力/速度・中央断面・矢印を表示し、JSON/PNGを保存できる。結果は既存caseApiのケースではなく、実験用パネル独自の形式。既存MCPにこれらのツールがあるとは案内しない。

残作業は壁近傍メッシュ/壁処理、全残差と収支/メッシュ収束、独立精度検証、一般メッシュ取込、非定常・追加乱流、共通ジョブ/ケース/測定/MCPへの統合、公開接続とSkill配布同期。WASM移植は先行条件にしない。

## 固定版と初期例題

公式配布: https://github.com/su2code/SU2/releases/tag/v8.5.0 。Windows OpenMP zipのSHA-256は4466fe21aedb5e0bad57afd45f829acbdec6ec79fe8c3f8954ddea06a4b4bc11。ライセンス・通知を保持し、製品再配布の整理は別途必要。

初期の円柱例題は[実行記録](evidence/2026-10-15-su2-native.json)に保存。初期設定の時間切れ、数値設定変更後の成功、取消を区別する。この過去の記録の圧力基準達成を物理精度保証としない。
