# 単一ビューの表示用変形GIF

[English](en/single-deformation-gif.md) · [回転GIF](single-orbit-gif.md) · [保存時刻GIF](single-stored-time-gif.md)

保存済みの線形弾性変位、または選択した固有モードの変位を表示し、「変形を往復（表示用）」で「GIFで保存」を押します。表示量はdisplacementだけです。応力・塑性ひずみ・非線形/塑性結果・温度・音響は対象外です。新しい載荷や解析時刻、振動応答を計算しません。

24枚の位相i/24に対し、表示倍率を `S*(1-cos(2πi/24))/2` とします。先頭は0、index12（13枚目）は指定最大倍率S、最後index23は小さい正の倍率で、無限loopの次の先頭0へ戻ります。終端0は重複しません。実際の正負振動、周波数に対応した周期、荷重・時間履歴ではありません。カメラと保存結果・凡例の値は固定し、全画像へ「表示倍率」「固定保存変位」または「正規化モード番号」を記載します。倍率は物理振幅の同定値ではありません。

modalは保存1〜6モードから1つを選びます。選択モードの最大節点変位1の正規化を1e-8範囲で確認し、元vectorを変更しません。実応答振幅ではない旨を示します。静的結果はmode無しです。節点magnitudesとvector normの一致を1e-10尺度で確認し、全値が有限・非負、変位が非ゼロであることを要求します。

この新しいGIFだけの上限は `0<S<=10000`、65536節点、3N変位値1572864byte（8byte見積）です。座標も同じ個数を検査し、通常のdense own dataだけを番号順に読みます。getter/iterator/symbol hookを実行しません。元座標と最大変形座標が全成分Float32有限であることを確認します。中間座標は端点間の線形値です。この検査はカメラ画角内の可視性を保証しません。大きな表示倍率では画面外やカメラ位置まで移動でき、自動fitしません。選択vector以外の全モードを複製しません。

出力は24枚・640×320・RGB332の256色、整数1〜15秒、delay合計100×秒centisecond、無限loop、最大32MiBです。`singleDeformationGifExport`でcanvas/SHA-256対応を確認できます。native codecは不要です。既存`startExport(format:'gif',animation:'deformation')`とstatus/artifact/cancel/releaseを使い、権限を追加しません。表示をsetResultViewで選んでから開始します。

別private Blob proofはanimation/kind/displacement、選択mode、最大倍率、24倍率ledger、camera/result revisionと厳密なbytesSHAを結合します。別mode/倍率や回転/保存時刻のproofは借用できません。bytesのbrand・発行サイズ・32MiBをcopy前に確認し、hash await前に所有copyへ切り離します。診断proofのコピーは発行資格になりません。

取消・拒否・完了のfinallyでcamera/up/fov、倍率、mode選択とonchange閉包、controls・入力・timeViewを復元します。結果が交代した場合は旧結果を新結果へ書き戻しません。120秒watchdogは取消を要求するだけです。所有yield/Blob/SHAが未完了ならlease/画面lockとexecutionSettled falseを保ち、実際のsettlement後に後始末します。従来の回転・保存時刻GIF、WebM経路は別のままです。

[検証記録](evidence/2026-10-27-single-deformation-gif.json)。独立GIF/LZW decoderで24画像・delay・peakを検査し、real Threeの有限座標・倍率式、mode/倍率/bytes改竄、65536/+1、closure復元、所有待機中取消をfake canvasで検査します。この版の実GUI/GIF出力・実solverは未実行です。

静的結果に定義済みmodesがある場合は、保存ケースparserが追加fieldを許しても拒否します。従来viewerがmodes[modalIndex].displacementを優先するため、検査した静的vectorと描画vectorを一致させる局所制約です。modes getterも実行せず拒否します。従来renderer自体は変更しません。
