# 音響time WebMの限定実検証 / Bounded acoustic-time WebM observation

**結果は部分検証。製品jobはcompletedだが、指定した物理終端の画像を保持していない。** 正式stdio MCP/通常main IABの前面表示で既存音響2ケースを1回だけWebM出力し、全bytes/SHA・独立復号・画像変化・状態保持を確認した。solver0、GIF0。追加録画はしない。VIEWCOMPARE親は未完のまま。

**Partial verification: the product job completed, but the encoded clip does not retain the requested physical endpoint.** One foreground ordinary-main IAB comparison WebM was exported through formal stdio MCP from existing synthetic acoustic cases. Full bytes/SHA, independent decoding, image change and state restoration pass. No solver or GIF ran. No additional recording was attempted, and the parent remains incomplete.

## Observations / 実測

- Requested: time comparison, 2 display seconds, physical0..0.0012s, instantPressure, two saved source amplitudes1Pa/2Pa, fixed shared camera/color range. Runtime3aa69ad and driver/helper b5ec169 have no src/scripts diff. Root explicitly paired inspect/edit/view only, analyze disabled. Root checked document.hidden=false / visibilityState=visible before and after; no other browser operation occurred during recording. No visibility override, DOM injection or QA HTML was used.
- Official import/readback reused the archived review51 git-source cases without solving. Archive transfer bytes/hash and content equality were checked. Display result identity rederives mesh.summary with inspectMesh; raw saved case identity is checked separately. Plan initial/final selection and max offsets agree with stored axes, but those summaries are not encoded-frame evidence.
- Artifact:27,172 bytes, SHA256 `3c5e21448fac7ab9654564b7e1e40459f028ec6d347b9d01c2b8e2939f4b676c`, VP9,1280x640. FFprobe/FFmpeg9.0.1 independently decode4frames with4distinct hashes and PTS[0,0.385,0.744,1.112]s. No format/stream/frame duration is present. Last PTS is not an exact playback-duration measurement. No2second or24fps claim is made.
- Selected images are decoded indices0/1/3 (`decoded-0/1/2.png`). The first shows physical0. Image1 shows request175.85us, stored155.84us, offset−20.007us. The final image shows request614.36us, stored625.97us, offset+11.616us; the requested physical endpoint1.2ms is absent. Shared Pa range/camera and1Pa/2Pa labels were visually inspected. Geometry-only crops exclude labels/legends and confirm actual image changes in both panels. Lossy VP9 pixels are not exact pressure measurements. Visual timestamp review covers these three images, not all encoded frame physical times.

## Raw evidence and controls

`acoustic-raw-completed.json` / `acoustic-last-status.json` retain product metadata. `acoustic-page-000.json` is the unmodified full artifact RPC response. Raw chunks/status/bytes are saved before assertions. `ffprobe.json`, `frames.sha256`, `independent-decode.json`, `geometry-change.json` and `independent-policy-state.json` retain independent checks. `acoustic-state.json` retains raw before/after snapshots: input/remaining inspect content, cases, compare, result and view are unchanged. Ownership during artifact retrieval is0→1; after release both analysis/export counts are0. The subsequent root Showcomparison/main screenshot is outside the unchanged-state baseline.

There was one pre-mutation driver restart: root pairing raced a correction notice. The old session read metadata only; mutate-ready/export-ready files were absent, child95136 and waiting driver8112 were stopped, and root explicitly disconnected/cleared fields before new pairing. `pre-mutation-pair-*` retain that history. It consumed no exports. Final session used child68644, formal sessions[] after GUI disconnect, and the fixed helper returned exited:true,terminated:false,escalated:false. Token-file absence and all three old/current PID absences were independently checked. Credentials are excluded.

元ケース・動画・復号画像・raw状態はfs.copyFileSyncで複写し、専用-text属性とbyte-inventory.jsonで元bytesを保持する。Git staged blobのSHA/長さも照合。既存15件のmock回帰は成功したが、終端保持の実証にはならない。

All files are byte-preserved with a dedicated -text attribute and inventory; staged blobs are compared against raw SHA/length. Fifteen existing mocked recorder/lifecycle tests pass, but do not establish encoded terminal retention. This record preserves the failure for a separate source-fix task. Do not replace150ms with an unsubstantiated longer wait, relax acceptance, or fabricate a GIF-like WebM frame ledger.

## Scope / 限界

This is a root-prepared existing-feature check, not fresh-skill reproduction. It does not prove full physical range retention, per-frame encoded physical timestamps, general geometry/physical accuracy, public HTTPS, other engines or MP4. Both source cases share a stored time axis. The elapsed-time render plan and nearest-frame policy remain distinct from encoder output. Source fix and further explicitly budgeted real verification are separate work.
