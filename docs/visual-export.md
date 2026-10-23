# 画像・アニメーションの出力

単一ビュー過渡音響の時間WebM保存は、全復号frameと保存軸の両端を確認する固定VP8方式です。previewと他のWebMは従来の実時間方式です。[対応範囲・時刻ledger・限界](single-view-acoustic-fixed-webm.md)。

API/MCPの画像・動画出力ジョブは、開始・状態・取消の応答に読み取り専用の `executionSettled` を返します。初期値は `false` で、描画と成果物処理が終了し、共有出力キューの実行占有を解放した時点でだけ `true` になります。取消は先に `state:"cancelled"` へ移るため、その状態だけで後片付け完了と判断しないでください。保持中は `exportStatus({jobId})` で `executionSettled:true` を確認してから `releaseExport` します。これは解析ジョブとは別の出力実行の状態で、タイムアウトだけでは終了扱いにしません。

接続解除はその接続から開始した出力だけを取り消します。旧sessionは失効します。同じページへ明示的に再接続した後は、保持中の既知jobIdを状態確認できます。取消済み成果物の取得拒否は利用不能状態を示し、session所有権による拒否ではありません。GUI利用者の出力はこの所有取消の対象外です。解放済みjobIdは従来どおり不明となり、終了状態も参照できません。

[English](en/visual-export.md)

時間比較GIFのmanifestには、各描画要求と各panelの実保存時刻/ずれ/case・結果識別を結ぶ `time.frameTimings` がある。[詳細・上限](view-compare-design.md)。GIFは24出力frameを記録する。[比較time WebMの固定フレーム経路](comparison-fixed-webm.md)は、全符号化・復号確認済みframeの物理時刻ledgerと再生時刻を記録する。回転・表示倍率の実時間WebMは従来の方針概要を維持し、同じ保証を持たない。上限超過は失敗して部分成果物を返さない。

`executionSettled` は出力Promise鎖とキュー占有の終了を示す。出力成功やOS/codec内部の資源・メモリ解放を独立に証明する値ではない。

結果表示の「画像・アニメーションを保存」から現在の表示をPNG、アニメーションをWebMで保存できます。モデルだけのPNGと回転にも対応します。画像にはモデル名、表示範囲・単位、断面情報を添えます。最大幅は1920ピクセルです。

「結果の表面」「結果の表面メッシュ」と既存の「内部メッシュ」「断面表示」を組み合わせてください。表面を隠して内部メッシュだけを表示できます。PNG・WebMは現在の表示を使います。

4種類のアニメーション: モデルの一周、構造／固有振動の変形往復、保存した過渡音響フレーム、断面の移動。長さは1～15秒。再生だけとWebM保存を選べます。録画はMediaRecorder対応ブラウザが必要で、利用可能なVP9／VP8方式を選びます。終了・停止時は元のカメラ、変形倍率、断面、時刻へ戻します。

変形往復は計算済み変位の表示倍率を変えるだけで、荷重履歴や非線形過程を再計算しません。固有振動は最大1 mmへ正規化された形状で、実応答振幅ではありません。過渡音響は保存した離散時刻を再生し、動画内に物理時刻を記載します。動画時間は指定秒数へ伸縮した表示用の時間です。フレーム数は描画性能に依存します。単一ビューのGIF、MP4、流線・粒子アニメーションは未対応です。2ケース比較GIFは別経路で回転/時間/表示倍率に対応します。

固定フレームPNG連番（`png-sequence`）のZIPは、同じ入力を再計算しても同一のバイト列になります。`resultRevision`は壁時計時間`result.performance.solveMs`を含むため、再計算のたびに変わります（保存済みのケース・測定・名前付きビューが使う値で、変更しません）。そこで`getResultView`は物理内容だけのハッシュ`physicalRevision`（`result.performance`を除いた同じ出力のSHA-256）を追加で返し、ZIP内`manifest.json`（`schemaVersion` 2）は`resultRevision`の代わりにフレームごとにも`physicalRevision`を記録します。成果物メタデータの`manifest`は従来どおり`resultRevision`を持ち、`physicalRevision`も併記します。`schemaVersion` 1のZIP（`resultRevision`記録）も読み取り互換です。

過渡熱の時間変化は、API/MCPの出力ジョブで`format:"png-sequence", animation:"time"`を指定すると保存温度フレームのPNG連番ZIPとして出力できます。非定常熱の保存フレームが2枚以上あり、表示量が温度である必要があります。`frames`は2〜120、かつ保存枚数以下です。補間せず保存フレーム番号から選ぶため、出力時刻が等間隔とは限りません。各フレームの`snapshotIndex`と`physicalTimeSeconds`、温度を対象とする時間基準をマニフェストに記録します。熱流束は対象外です。実時間の再生・WebM時間出力は引き続き熱に非対応で、画面の一般アニメーション操作からPNG連番は出力しません。対応種別は`exportCapabilities().formats["png-sequence"].timeAnimationResultKinds`、温度指定は`thermalTimeField`で確認します。最上位の`timeAnimationResultKinds`は実時間再生側の音響のみの意味です。この熱PNG連番追加のlocalhostの実Chrome確認結果は下記を参照してください。

2026-10-17 localhost実Chrome証跡: `evidence/2026-10-17-thermal-time-api-real-chrome.json`。実`solveThermal`による小規模四面体結果（T = 20 + t）で、APIの5/10/2秒選択（25/30/22 degC）、途中時刻の熱流束省略と最終時刻の熱流束、無効指定・古い版の拒否を確認しました。PNG連番は0/5/10秒とハッシュを照合し2秒へ復元、比較パネルも5秒表示後に2秒へ復元しました。小規模localhost条件の確認であり、公開環境・任意メッシュは未確認です。補間表示の復元と一般設定変更は自動テストのみです。ブラウザのダウンロードはイベント待機のタイムアウトとデバッガ切断により未確認です。

2026-10-19 断面PNG連番の参照確認: `evidence/2026-10-19-opencode-browserexport1.json`。実`solve`（直方体10×10×40 mm、E=1 GPa、ポアソン0.3、z=0面固定・z=40面に+Z 100 N、mesh size 5 mm、elastic wasm-pcg）の体積メッシュの軸範囲0〜10 mmに対し、`format:"png-sequence", animation:"slice", frames:3`で`slicePosition` 0/5/10 mm（phase 0/0.5/1）のZIPを作りました。独立STORE readerでmanifestと3枚のCRC-32・SHA-256・PNG IHDR（canvas値320×316）を照合し、renderへ渡った`clip-position`とmanifestの`slicePosition`が一致、同じ凍結表示・locale・resultでの再実行はバイト一致しました。取消後は断面位置・断面表示・カメラ・controlsを元へ戻し、部分ZIPは`exportArtifact`で取得不可です。ただしこれはNodeのunit/helper確認で、frameピクセルはtest doubleのPNGであり、実canvasの描画差や実Chrome/MCPの`startExport`→artifactページ全取得→SHA照合は未実施です。120枚成功・4 MiB/24 MiB上限・一般形状の受入は未確認のままです。`manifest.json`は`slicePosition`の単位欄を持たず、mmは形状単位（組み込み形状はmm）に従います。

比較GIFの24枚/端点/delay/物理時刻/倍率と検証範囲は[比較仕様](view-compare-design.md)を参照。単一ビューの実時間熱WebM非対応と、比較の熱時間GIF/WebM対応は別契約です。
