# 単一ビュー過渡音響の固定時刻WebM

[English](en/single-view-acoustic-fixed-webm.md)

単一ビューの「過渡音響の時間変化」をWebMで保存する場合と、API/MCPの `startExport` で `format:"webm", animation:"time"` を指定する場合だけ、保存音響結果の固定フレーム方式を使う。`singleTimeWebmExport` 能力を確認する。再生だけのpreview、回転・変形・断面WebM、熱の時間変化は従来の扱いを維持し、熱の時間出力はPNG連番だけである。

入力は `acousticTransient` の有限・非負・厳密増加の保存時刻2〜2048点。元結果の先頭から末尾へ物理phase `i/(N-1)` を対応させ、最も近い保存フレームを選ぶ。同距離は小さいindexを選ぶ。補間せず、解析もしない。要求物理時刻、実保存時刻、符号付きのずれ `actual-requested`、保存indexを各出力frameに記録する。先頭・末尾は元保存軸の両端を必ず選ぶ。保存時刻が多い場合、全保存frameを必ず通る方式ではない。

表示時間は1〜15秒、出力数は `N=min(seconds*24,120)`。整数microsecondの再生timestamp/durationは表示時間に合計し、物理時刻と区別する。カメラは固定。captionを含む全画像を1280×640内へ縮小し、32MiBの既存byte上限を使う。比較時刻WebMのVP8 encoder/mux/decoderをそのまま再利用し、全入力・出力timestamp、strict WebM構造、全復号timestamp・寸法と終端を検証する。未出力queue2、stall5秒・全体120秒、frame/codecs close、終了後callback無効化も共有する。非対応や未完検証は失敗し、実時間録画へfallbackしない。

検証済みBlobだけにprivate WeakMapのproofを結び、発行時はcaptured native Blob readerから得た元bytesのSHA-256/長さも保持する。jobは差し替えられたBlob readerを拒否し、captured intrinsicでbytesを読み、await前snapshotのhashとproofを照合する。構造・時刻が同じでもpayloadの変更は拒否する。manifestには保存結果revision、実bytesのSHA/長さ、resolution、全物理ledger、固定方式の検証を残す。任意のBlobや、public診断関数が返すproofのコピーは発行資格にならない。

GUI stop、MCP取消/切断、表示結果の交代、codec失敗では部分成果物を公開しない。camera/controls/scale/clipと元の補間時刻状態をfinallyで復元する。表示結果が交代した場合、新結果の時刻へ旧値を上書きしない。既存 `executionSettled` は実後片付けが終わるまでfalseで、取消状態だけを終了確認にしない。

[自動試験の証拠](evidence/2026-10-24-single-view-acoustic-fixed-webm.json) はsynthetic codec/DOMによる限定検証であり、実browser出力・GUI download・実codec・物理精度の証拠ではない。元結果や親受入の状態は変更しない。
