# 単一ビューの保存時刻GIF

[English](en/single-stored-time-gif.md) · [回転GIF](single-orbit-gif.md) · [温度時刻WebM](single-view-thermal-fixed-webm.md)

保存した温度または瞬時音圧の結果を表示し、「画像・アニメーションを保存」で「保存時刻（音響・温度）」を選び「GIFで保存」を押します。回転GIFと同じ24枚・640×320・RGB332の256色プレビューです。カメラは固定し、凡例と実保存時刻・要求時刻・ずれを含めます。GIFの色は量子化され、動画の長さは表示用です。物理時間の積分精度・補間精度・実測精度を保証しません。

元履歴は2〜61枚、全節点スカラーの合計64MiBまでです。全フレームの値が節点数と一致し有限、時刻は非負・有限・厳密昇順であることを検査します。温度はtransientなtemperature/degC、音響はacousticTransientのinstantPressure/Paだけに対応します。熱流束や静的温度・断面のGIFは拒否します。変位は別能力の[表示用変形GIF](single-deformation-gif.md)を使います。既存の回転GIFと時刻WebMの経路は変更しません。

24出力画像の位相はi/23です。最初・最後の実保存時刻を必ず含め、その間は物理区間の等間隔要求時刻に最も近い保存フレームを選びます。同距離なら低いindexを選びます。同じ保存フレームを複数回使う場合があり、61枚すべての収録を保証しません。新しい時刻の解析や補間は行いません。要求時刻・実時刻・符号付きずれactual−requestedをmanifestへ24件保存します。

長さは整数1〜15秒。各画像のdelayは整数centisecondで、合計が100×秒数に一致します。無限ループ、最大32MiB、120秒で取消を要求するwatchdogです。canvasの読み取りとSHA-256を必要とし、MediaRecorderやnative codecは不要です。`singleStoredTimeGifExport`で対応を確認し、既存`startExport`の`format:'gif',animation:'time'`とstatus/artifact/cancel/releaseを使います。新しい権限やmethodは増やしません。`formats.gif`/`singleOrbitGifExport`は従来の回転能力を表します。

新private Blob proofはfield/kind/unit、元result revision、固定camera、全時刻軸・24件ledger・delayと発行時の厳密bytesSHAを保持します。jobは準備したanimationからmanifestを選び、回転・温度・音響のproofを借用できません。bytesはintrinsic brand/サイズ/32MiBをcopy前に確認し、hash await前に所有copyへ切り離します。診断proofのコピーや同じGIF bytesを持つ別Blobは発行資格になりません。

全scalar履歴の再copyは行わず、既存結果lease下で時刻metadataだけをsnapshotします。処理中の結果・field・view/camera・source履歴reference/time・capture寸法変更を拒否し、取消・timeout・エラーでartifactを公開しません。finallyで元のtimeView（補間表示を含む）、camera、controls、画面入力を復元します。`executionSettled`はこの後始末の完了を表し、cancel直後のstateだけでは完了扱いしません。

[検証記録](evidence/2026-10-27-single-stored-time-gif.json)。独立GIF/LZW readerで全24画像とdelayを検査し、非一様時刻・同距離選択・両端・単位・proof取り違え・bytes改竄・途中取消/timeout・UI復元をfake canvasで確認します。初期実装時点では実ブラウザ書出しを未実行として記録しました。現在の限定実証は以下の2026-10-27追記を参照してください。

watchdogは取消要求であり、未完了の所有yield・Blob読取・digestを完了扱いにしません。その処理が実際にsettleするまでsource/host lockとexecutionSettled falseを保持します。注入したnever-settling promiseなら未完了のままです。通常yieldは有限timerです。

sourceは呼出側iteratorやmap hookを実行せず、番号付きのown data descriptorだけを読みます。疎な値・独自配列prototype・symbol hook・対象値getterは実行せず拒否します。

## 2026-10-27の限定実ブラウザ検証

固定runtime66ce457の通常main/IAB・英語・前景で、既存の合成94節点熱ケースから2秒の保存時刻GIFを正式stdioで1回だけ出力しました。[実証記録](evidence/2026-10-27-single-stored-time-gif-main/README.md)。5574849bytes/SHA-256 `5f800ca2cd4ffb4ed78b2e98549b0e3255727481752e0e8d3645d0b8a0519687`、86ページ、24枚・640×320・RGB332・総delay200cs・無限loop0を確認しました。保存時刻0/5/10秒の選択回数は6/12/6で、終端10秒のずれ0、固定camera、24件ledgerが一致しました。同距離選択はこの実例には発生せず、低indexのtie規則は自動検査だけの範囲です。

独立generic GIF/LZWとFFmpegの全24枚RGBは一致し、全画像の640×204モデル領域に非背景4566〜4574pixels、scene hashは保存時刻に対応する3種類でした。先頭・中央・最後の画像で青→緑→赤の箱、凡例と時刻キャプションを目視確認しました。5状態不変、GUIの元の補間2秒への復元、settled後の解放とsession/所有child/tokenの後始末を確認しました。

音響の実書出し、実取消matrix、GUIダウンロード完了、一般形状・公開環境・物理精度や校正は証明していません。初期のpixel期待値訂正、2回の既存WASM準備拒否（solver未到達）、所有await/配列hook修正の履歴は変更せず保持します。[統合検証の範囲](evidence/2026-10-27-single-stored-time-gif-integration.json)。
