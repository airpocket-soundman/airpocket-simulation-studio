# 単一ビューの表示用変形GIF

[English](en/single-deformation-gif.md) · [回転GIF](single-orbit-gif.md) · [保存時刻GIF](single-stored-time-gif.md)

保存済みの線形弾性変位、または選択した固有モードの変位を表示し、「変形を往復（表示用）」で「GIFで保存」を押します。表示量はdisplacementだけです。応力・塑性ひずみ・非線形/塑性結果・温度・音響は対象外です。新しい載荷や解析時刻、振動応答を計算しません。

24枚の位相i/24に対し、表示倍率を `S*(1-cos(2πi/24))/2` とします。先頭は0、index12（13枚目）は指定最大倍率S、最後index23は小さい正の倍率で、無限loopの次の先頭0へ戻ります。終端0は重複しません。実際の正負振動、周波数に対応した周期、荷重・時間履歴ではありません。カメラと保存結果・凡例の値は固定し、全画像へ「表示倍率」「固定保存変位」または「正規化モード番号」を記載します。倍率は物理振幅の同定値ではありません。

modalは保存1〜6モードから1つを選びます。選択モードの最大節点変位1の正規化を1e-8範囲で確認し、元vectorを変更しません。実応答振幅ではない旨を示します。静的結果はmode無しです。節点magnitudesとvector normの一致を1e-10尺度で確認し、全値が有限・非負、変位が非ゼロであることを要求します。

この新しいGIFだけの上限は `0<S<=10000`、65536節点、3N変位値1572864byte（8byte見積）です。座標も同じ個数を検査し、通常のdense own dataだけを番号順に読みます。getter/iterator/symbol hookを実行しません。元座標と最大変形座標が全成分Float32有限であることを確認します。中間座標は端点間の線形値です。この検査はカメラ画角内の可視性を保証しません。大きな表示倍率では画面外やカメラ位置まで移動でき、自動fitしません。選択vector以外の全モードを複製しません。

出力は24枚・640×320・RGB332の256色、整数1〜15秒、delay合計100×秒centisecond、無限loop、最大32MiBです。`singleDeformationGifExport`でcanvas/SHA-256対応を確認できます。native codecは不要です。既存`startExport(format:'gif',animation:'deformation')`とstatus/artifact/cancel/releaseを使い、権限を追加しません。表示をsetResultViewで選んでから開始します。

別private Blob proofはanimation/kind/displacement、選択mode、最大倍率、24倍率ledger、camera/result revisionと厳密なbytesSHAを結合します。別mode/倍率や回転/保存時刻のproofは借用できません。bytesのbrand・発行サイズ・32MiBをcopy前に確認し、hash await前に所有copyへ切り離します。診断proofのコピーは発行資格になりません。

取消・拒否・完了のfinallyでcamera/up/fov、倍率、mode選択とonchange閉包、controls・入力・timeViewを復元します。結果が交代した場合は旧結果を新結果へ書き戻しません。120秒watchdogは取消を要求するだけです。所有yield/Blob/SHAが未完了ならlease/画面lockとexecutionSettled falseを保ち、実際のsettlement後に後始末します。従来の回転・保存時刻GIF、WebM経路は別のままです。

[検証記録](evidence/2026-10-27-single-deformation-gif.json)。独立GIF/LZW decoderで24画像・delay・peakを検査し、real Threeの有限座標・倍率式、mode/倍率/bytes改竄、65536/+1、closure復元、所有待機中取消をfake canvasで検査します。初期実装記録では実GUI/GIF出力を未実行としていました。現在の限定実証は以下の2026-10-27追記を参照してください。新solverは実行していません。

静的結果に定義済みmodesがある場合は、保存ケースparserが追加fieldを許しても拒否します。従来viewerがmodes[modalIndex].displacementを優先するため、検査した静的vectorと描画vectorを一致させる局所制約です。modes getterも実行せず拒否します。従来renderer自体は変更しません。

## 2026-10-27の限定実ブラウザ検証

固定runtimef40ae9cの通常main/IAB・英語・前景で、既存の完全保存bundleから正式に取り込んだ171節点/428Tetの静的線形弾性WASMケースを使い、2秒の変形GIFを1回だけ出力しました。[実証記録](evidence/2026-10-27-single-deformation-gif-main/README.md)。元bundleは208374bytes/SHA `991b3352d60fb7294f4cdec931483447b75567e60a8a970c04460db5a23d57c9`。既存bundle.caseArchiveだけを公式caseStoreでimport/exportし、input/mesh/resultは深く同一です。新solveや不足値・project envelopeの捏造はありません。

出力5574849bytes/SHA `093d760aa5fd4e0ec38a23043000f2b873a1a8657f91465b7b387468d72387d1`、86ページ、24枚・640×320・RGB332・総delay200cs・loop0、mode null・最大表示倍率100、i/24 cosine台帳を確認しました。元の最大変位約0.04mmを表示上約4mmへ拡大し、物理振幅や載荷履歴とは区別しています。

独立generic LZW/FFmpegの全24RGBが一致し、全モデル領域の非背景3537〜3973pixelsと13種類の姿勢を検出しました。先頭・最大倍率・最後の画像で棒全体、伸び戻り、表示用captionを目視確認しました。5状態不変、GUI倍率100の復元、settled解放とsession/所有child/token cleanupを確認しました。

保存modal探索で利用可能な入力を得られなかった履歴と、不完全なpublic step3が公式case importで準備拒否された履歴は保持します。step3の境界導出でpure表示準備が進んでも、input不足を勝手に埋めず、完全な既存archiveへ切り替えました。この限定成功は実modal出力、GUI download、実取消matrix、一般形状・公開環境・物理校正を証明しません。[統合検証範囲](evidence/2026-10-27-single-deformation-gif-integration.json)。

固定時刻の温度断面は別能力の[断面GIF](single-slice-gif.md)を使います。変位はそちらの対象外です。
