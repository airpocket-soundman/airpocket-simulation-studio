# 単一ビューの回転GIF保存

[English](en/single-orbit-gif.md) · [出力仕様](visual-export.md)

計算結果または保存結果を表示し、表示量・時刻・モード・色範囲を選ぶ。「画像・アニメーションを保存」で種類を「モデルを一周」にして「回転GIFで保存」を押す。現在の結果を変えず、カメラだけを回す短いプレビューである。単一ビューの時間変化・変形・断面GIFは拒否する。既存のPNG/WebM、二ケース比較GIFは別経路のまま。

`singleOrbitGifExport`と`formats.gif`が対応を示す。読み取り可能な2D canvasとSHA-256が必要で、MediaRecorder/native codecは不要。既存の`startExport`へ`format:'gif',animation:'orbit',seconds:1..15`を追加し、method/scopeは増やさない。表示中の結果版を`getResultView`で取得する。既存のstatus/artifact分割取得/cancel/releaseを使う。

固定24枚、phase=i/24、1周の重複終端は入れない。delayは正の整数centisecondで合計seconds×100。GIF89a/RGB332/256色、無限loop、640×320、成果物32MiB上限。GIF専用captureは上204pxへ元画像をaspect維持で中央配置し、下116pxのcaptionは幅640を確保する。PNG/WebMの既定captureは変更しない。source viewport/capture寸法が途中で変われば拒否する。これは色数を落としたプレビューで、滑らかな24fps・数値精度・最大process memoryを保証しない。

private発行済みBlob proofは24枚のカメラ/delay/letterbox、field、camera、resultRevision、選択時刻とモード、原Blob全bytes SHAへ結合する。manifestはintrinsic Uint8Array/ArrayBuffer brand、非共有buffer、発行時と同じ長さかつ32MiB以内を**copy前**に検査する。clone Blob、比較GIF、改変bytes、別field/time/camera/modeの流用を拒否する。モードnull/undefinedはどちらも「modeなし」で、mode0と区別する。load/serializeによる証明の復元は提供しない。

選択した補間表示2秒を回転中も維持する場合、`selectedPhysicalTimeSeconds:2,interpolated:true,timeSelectionBasis:'viewer-interpolated'`を記録し、captionも「補間表示2秒（固定）」とする。内部sliderが保存frame0を指していても、そのframe温度と呼ばない。補間時に`selectedStoredFrameIndex`は出さず、static/modalへ保存時刻を捏造しない。

field/time/range/layers/clip/modeの同一resultRevision内変更、source変更、camera up/fov変更を拒否する。finallyでcamera up→lookAt→projectionの順、モードのonchange閉包、時刻/入力、lockを復元する。取消は協調式で、未settled yieldをraceで置き去りにしない。cancelledでもexecutionSettledになるまでは同じrenderer枠を保持し、部分GIFは公開しない。

独立GIF/LZW decoderで24画像・delay合計・palette・letterbox画素を検査した。JA/EN fakeUIでSave実配線/API bytes同一、補間2秒、field/time/range/resize/モード閉包/up/fovの拒否・復元を確認した。実GUI/GIF出力・ダウンロードの確認は別予算であり、現時点では未実行。初回132件中5件のslice参照はfresh worktreeの既存WASM欠如で準備失敗し、solver未到達。fake対象125件は全成功で、WASM取得・solver再試行はしていない。[証拠](evidence/2026-10-27-single-orbit-gif.json)。
