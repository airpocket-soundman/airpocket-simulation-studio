# 比較time WebMの固定フレーム経路

[English](en/comparison-fixed-webm.md)

保存済みの熱温度・過渡音響の2ケース比較で format=webm / animation=time を指定すると、保存時刻を両端まで含める固定フレーム経路を使う。解析や物理状態の補間は行わない。比較GIF/PNG、回転・表示倍率WebMは従来経路を維持する。

別能力 comparisonTimeWebmExport は VideoEncoder / VideoDecoder / VideoFrame / EncodedVideoChunk とcodec能力照会APIを必要とし、実行時にVP8対応を確認する。不足時は安定理由で拒否し、比較GIFを案内する。実時間録画へ暗黙に戻さない。既存MCPの比較出力・状態・分割成果物・取消・解放を使う。

表示長さは整数1〜15秒、N=min(seconds×24,120)。2秒は48枚、15秒は120枚であり、常に24fpsという意味ではない。物理phase=i/(N−1)で両端を含み、近い保存時刻・許容ずれ・共通色範囲を維持する。presentation時刻は round(i×seconds×1e6/N) マイクロ秒、durationは次の丸め境界との差。最後の物理終端画像を最後の表示区間へ保持し、全区間の和は指定秒数。物理phaseとpresentation時刻は別概念。

1280×640以下、最大120枚・成果物/encoded保持32MiB、native queueと投入数−出力数の双方が各最大2、実行120秒。全VP8 keyframeを符号化し、全入力timestampと出力timestampの同一集合・重複なし・flush完了を確認する。全VideoFrameをcloseする。

pure fixed-webm.js は限定WebMを生成しstrict readerで再解釈する。有限EBMLサイズ、単一VP8映像track、音声/lacing/暗号化なし、1Clusterに1SimpleBlock、相対block時刻0。TimestampScale=1000nsでCluster時刻は整数マイクロ秒。Info DurationとDefaultDurationを明示する。DefaultDurationは先頭区間長のナノ秒値というnominal値であり、丸め後の隣接presentation差（1μs違う場合がある）・全体Durationとは区別する。

pure readerのkeyframeフラグ/寸法宣言の検査はbitstreamの真正性を保証しない。アプリ正規VideoDecoderで全packetを復号し、全timestamp・実decoded寸法・終端を確認してからBlobを返す。ジョブ層もcontainer/proof/各frameの物理選択ledgerを照合して公開する。manifestは recording=fixed-frame / realtime=false、frame数、presentation schedule、検証要約、各panelの保存時刻と符号付きずれを保持する。

背景移動・5秒進捗停滞・取消・切断・古いsource・codec/container失敗・終端未検証時は完成成果物を公開しない。timers/codecs/frames/host lockを解放する。32MiBは一時containerコピーやcodec内部メモリを含むpeak RAM保証ではない。主な理由は WEBM_FIXED_UNSUPPORTED / INVALID / CODEC_FAILURE / OUTPUT_MISMATCH / CANCELLED / TIMEOUT、WEBM_ENDPOINT_UNVERIFIED。

Nodeのcodec fakeとpure否定試験、非等間隔2caseの実adapter/queue ledgerを検証。fake codecは実VP8画質の証明ではなく、独立FFmpeg fixture監査・実ブラウザ新経路出力は別証拠として追加する。[旧比較MediaRecorderの終端欠落実測](evidence/2026-10-24-acoustic-time-webm/README.md)は保持する。single-view timeには類似captureStream/150ms処理が残るが、今回の欠落実測はcomparisonのみで、single-view欠落は未再現・未検証。回転・表示倍率も実時間録画のままで新しい固定終端保証はない。一般形状の物理精度・公開HTTPS・MP4・他engineは未完。

一次資料: [WebCodecs Working Draft](https://www.w3.org/TR/webcodecs/)、[WebM Container Guidelines](https://www.webmproject.org/docs/container/)、[RFC9559](https://www.rfc-editor.org/rfc/rfc9559.html)。[canvas capture draft](https://w3c.github.io/mediacapture-fromelement/)のrequestFrameはpaint時capture要求でencoder到達証明ではない。この限定設計は一般Matroska/全codecの実装を主張しない。
