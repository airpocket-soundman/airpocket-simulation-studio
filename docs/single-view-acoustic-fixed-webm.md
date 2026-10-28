# 単一ビュー過渡音響の固定時刻WebM

[English](en/single-view-acoustic-fixed-webm.md)

単一ビューの「過渡音響の時間変化」をWebMで保存する場合と、API/MCPの `startExport` で `format:"webm", animation:"time"` を指定する場合だけ、保存音響結果の固定フレーム方式を使う。`singleTimeWebmExport` 能力を確認する。再生だけのpreview、回転・変形・断面WebM、熱の時間変化は従来の扱いを維持し、熱の時間出力はPNG連番だけである。

入力は `acousticTransient` の有限・非負・厳密増加の保存時刻2〜2048点。元結果の先頭から末尾へ物理phase `i/(N-1)` を対応させ、最も近い保存フレームを選ぶ。同距離は小さいindexを選ぶ。補間せず、解析もしない。要求物理時刻、実保存時刻、符号付きのずれ `actual-requested`、保存indexを各出力frameに記録する。先頭・末尾は元保存軸の両端を必ず選ぶ。保存時刻が多い場合、全保存frameを必ず通る方式ではない。

表示時間は1〜15秒、出力数は `N=min(seconds*24,120)`。整数microsecondの再生timestamp/durationは表示時間に合計し、物理時刻と区別する。カメラは固定。captionを含む全画像を1280×640内へ縮小し、32MiBの既存byte上限を使う。比較時刻WebMのVP8 encoder/mux/decoderをそのまま再利用し、全入力・出力timestamp、strict WebM構造、全復号timestamp・寸法と終端を検証する。未出力queue2、stall5秒・全体120秒、frame/codecs close、終了後callback無効化も共有する。非対応や未完検証は失敗し、実時間録画へfallbackしない。

検証済みBlobだけにprivate WeakMapのproofを結び、発行時はcaptured native Blob readerから得た元bytesのSHA-256/長さも保持する。jobは差し替えられたBlob readerを拒否し、captured intrinsicでbytesを読み、await前snapshotのhashとproofを照合する。構造・時刻が同じでもpayloadの変更は拒否する。manifestには保存結果revision、実bytesのSHA/長さ、resolution、全物理ledger、固定方式の検証を残す。任意のBlobや、public診断関数が返すproofのコピーは発行資格にならない。

GUI stop、MCP取消/切断、表示結果の交代、codec失敗では部分成果物を公開しない。camera/controls/scale/clipと元の補間時刻状態をfinallyで復元する。表示結果が交代した場合、新結果の時刻へ旧値を上書きしない。既存 `executionSettled` は実後片付けが終わるまでfalseで、取消状態だけを終了確認にしない。

[自動試験の証拠](evidence/2026-10-24-single-view-acoustic-fixed-webm.json) はsynthetic codec/DOMによる限定検証であり、実browser出力・GUI download・実codec・物理精度の証拠ではない。元結果や親受入の状態は変更しない。


2026-10-24、通常main/IAB/EN・正式stdio MCPで保存済み音響archiveから2秒のtime WebMを1回作成した。923,844bytes/SHA、独立VP8復号48all-key/584×640/2秒、全物理ledgerと最終1.2ms・ずれ0、5状態不変、settled解放と切断cleanupを確認した。[生証拠・失敗履歴・限定範囲](evidence/2026-10-24-single-acoustic-webm-main/README.md)。これは1archive/runtimeの限定確認で、GUI download・他engine・一般物理精度等の証明ではない。


PR195の固定head `eda94d0` は [CI39991802155](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39991802155/job/120545136149) で2150件中2142成功・0失敗・8skip（288.012秒）、build成功、local report28件成功（39.045秒）。実行されたmerge候補は `5c5cbc4686eddfc7e85f57271a0e14d959419633`。公開/deployはskip。[自動artifactの生ログ・hash](evidence/2026-10-24-pr195-ci/summary.json)。この追記は別基点のdocs-only記録で、CI再実行はしていない。
