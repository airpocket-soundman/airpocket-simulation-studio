# 画像・アニメーションの出力

[English](en/visual-export.md)

結果表示の「画像・アニメーションを保存」から現在の表示をPNG、アニメーションをWebMで保存できます。モデルだけのPNGと回転にも対応します。画像にはモデル名、表示範囲・単位、断面情報を添えます。最大幅は1920ピクセルです。

「結果の表面」「結果の表面メッシュ」と既存の「内部メッシュ」「断面表示」を組み合わせてください。表面を隠して内部メッシュだけを表示できます。PNG・WebMは現在の表示を使います。

4種類のアニメーション: モデルの一周、構造／固有振動の変形往復、保存した過渡音響フレーム、断面の移動。長さは1～15秒。再生だけとWebM保存を選べます。録画はMediaRecorder対応ブラウザが必要で、利用可能なVP9／VP8方式を選びます。終了・停止時は元のカメラ、変形倍率、断面、時刻へ戻します。

変形往復は計算済み変位の表示倍率を変えるだけで、荷重履歴や非線形過程を再計算しません。固有振動は最大1 mmへ正規化された形状で、実応答振幅ではありません。過渡音響は保存した離散時刻を再生し、動画内に物理時刻を記載します。動画時間は指定秒数へ伸縮した表示用の時間です。フレーム数は描画性能に依存します。GIF／MP4直接保存と流線・粒子アニメーションは未対応です。

固定フレームPNG連番（`png-sequence`）のZIPは、同じ入力を再計算しても同一のバイト列になります。`resultRevision`は壁時計時間`result.performance.solveMs`を含むため、再計算のたびに変わります（保存済みのケース・測定・名前付きビューが使う値で、変更しません）。そこで`getResultView`は物理内容だけのハッシュ`physicalRevision`（`result.performance`を除いた同じ出力のSHA-256）を追加で返し、ZIP内`manifest.json`（`schemaVersion` 2）は`resultRevision`の代わりにフレームごとにも`physicalRevision`を記録します。成果物メタデータの`manifest`は従来どおり`resultRevision`を持ち、`physicalRevision`も併記します。`schemaVersion` 1のZIP（`resultRevision`記録）も読み取り互換です。

過渡熱の時間変化は、API/MCPの出力ジョブで`format:"png-sequence", animation:"time"`を指定すると保存温度フレームのPNG連番ZIPとして出力できます。非定常熱の保存フレームが2枚以上あり、表示量が温度である必要があります。`frames`は2〜120、かつ保存枚数以下です。補間せず保存フレーム番号から選ぶため、出力時刻が等間隔とは限りません。各フレームの`snapshotIndex`と`physicalTimeSeconds`、温度を対象とする時間基準をマニフェストに記録します。熱流束は対象外です。実時間の再生・WebM時間出力は引き続き熱に非対応で、画面の一般アニメーション操作からPNG連番は出力しません。対応種別は`exportCapabilities().formats["png-sequence"].timeAnimationResultKinds`、温度指定は`thermalTimeField`で確認します。最上位の`timeAnimationResultKinds`は実時間再生側の音響のみの意味です。この熱PNG連番追加の実Chrome確認は未実施です。
