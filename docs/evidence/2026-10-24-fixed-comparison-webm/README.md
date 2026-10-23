# 固定フレーム比較WebMの実検証 / Actual fixed-frame comparison WebM

新しい比較time経路で、保存済み合成音響2ケースからWebMを1回だけ出力した。正式stdio MCP・通常main IABの前面表示で、全bytes/SHA、48presentation時刻・96panel保存時刻/最近傍/符号付きずれ、状態保持、独立復号と終端画像を確認した。solver0、追加GIF0。VIEWCOMPARE親全体は未完のまま。

One new fixed comparison-time WebM was exported from two existing synthetic acoustic cases through formal stdio MCP and the ordinary foreground main IAB page. Full bytes/SHA,48 presentation timestamps,96 nearest-stored panel selections/offsets, state preservation, independent decoding and the terminal image pass. No solver or GIF ran. The parent VIEWCOMPARE task remains incomplete.

## Frozen execution

- Runtime:8208329fef3a6c02c4043bd0ff9cbbac85dfce3b; origin http://127.0.0.1:5188; ordinary main IAB2 tab10. Browser reports reduced Chrome155.0.0.0 UA; no independent full-version/other-engine claim. Root verified hidden=false / visibilityState=visible before and after, held the same tab during encoding, and froze runtime source/commits until primary checks completed.
- Explicit inspect/edit/view pairing; analyze disabled. The driver waited at three fixed boundaries: pair/metadata, root-authorized case mutation, then root-authorized visible export. Driver SHA791f37a02215bd404c0a7576d2af346343eee0050364cb1a9c3915bf48fc1334 was frozen before pairing and never changed during execution. There was no restart/re-pair in this budget.
- Exactly1 fixed WebM request:2display seconds,48frames,0..0.0012physical seconds,instantPressure,source amplitudes1Pa/2Pa,335nodes/1006tetrahedra. Budgets:120s watchdog,32MiB,512pages<=65536decoded bytes. This is a root-prepared existing-feature test, not fresh-skill reproduction.
- Historical source archive came from git1412075:docs/evidence/review51-real-archives/cases.json, raw1183210bytes/SHA bd30abd84f1b8c7fce85018feb476d44d7d88cef934b8edb45867ec45362a0b7. Official readback is compact JSON500449bytes/SHA5c7ec975ac3ccec58de4f391c00b8522afc9a6598a2422322cef253593b8cf31. Complete transfer hash and parsed content equality were checked without solving or editing saved fields.

## Independent results

Artifact1540510bytes, SHA25620fc86d0b17d1fa32f26f46575693b1a49a03ac350697f703a5fb0dea646d077. All24 artifact pages were assembled with continuous offsets/job identity and final hash. Raw RPC/status/chunks/bytes were saved before assertions.

FFprobe/FFmpeg9.0.1 independently decode VP8,1280x640,48keyframes with48distinct decoded hashes, Duration2.000000seconds. Every decoded presentation timestamp matches the manifest, from0 to1.958333seconds. The last interval duration41667microseconds closes at2seconds. Physical phase i/47 is distinct from presentation time round(i*2000000/48).

Decoded image0 shows physical0/offset0. Image23 shows requested587.23microseconds, selected574.03microseconds, offset−13.208microseconds in both panels. Image47 shows requested/selected1.2milliseconds and offset0 in both panels. Synthetic case labels, Pa/shared color range and fixed camera were visually checked. Geometry-only RGB crops exclude headers/time labels/color bars and show actual color/geometry-image changes, independently of text. Lossy pixels are not exact pressure measurements. Visual label checks cover these three images; all48x2 numerical selections were checked separately.

The product proof reports48submitted/encoded/decoded frames including terminal timestamp1958333microseconds. Strict container checks and the app's VideoDecoder verification completed before publication. The independent FFmpeg decode and visible last-frame label provide separate evidence that this run retains the requested physical endpoint. Nominal DefaultDuration and rounded neighboring PTS intervals remain distinct; general capped schedules are not always24fps.

## State and cleanup

Input/remaining inspect data, case archive/IDs/revisions, comparison state, result state and camera/view were unchanged across output. The only inspect ownership difference while retaining the artifact was ownedExportJobs0→1; after release ownedExportJobs=0 and ownedAnalysisJobs=0. All case transfers and the export job were released. The raw final terminal status/release response are retained.

Root's later Show comparison / time-mode selection and English fixed-endpoint accessibility-text confirmation occurred after the unchanged-state baseline. main.jpg shows the normal main controls/scopes, not video playback. No additional GUI export occurred. Root then disconnected and cleared endpoint/code. Formal sessions[] was recorded, the fixed helper returned exited=true/terminated=false/escalated=false, driver exited0, private pairing file was absent and owned child PID39696 was independently absent in the OS. Credentials are excluded.

## Files and remaining scope

acoustic-raw-completed.json and acoustic-summary.json retain metadata; acoustic-page-*.json are the full raw artifact responses; acoustic-state.json / ownership-after-release.json retain state; ffprobe.json / frames.sha256 / independent-decode.json / decoded-*.png retain independent decode; geometry-change.json and visual-review.json retain selected-image checks. driver.mjs.txt / decode.mjs.txt are the frozen QA source copies. Source identities, report and byte inventory fix hashes/lengths; fs.copyFileSync and dedicated -text attributes preserve original raw bytes. All staged blobs are compared against the inventory before commit.

両caseの時刻軸は同じで、実ブラウザでpanelごとに異なる保存時刻を選ぶ条件は今回検証していない。旧MediaRecorderの終端欠落証拠851d2c5517adac98d65dc3eeb18a71eaa49abbf9は維持する。single-view time欠落は今回未再現で、回転・表示倍率は実時間録画のまま。一般形状の物理精度、公開HTTPS、他engine、MP4、親全体の完了へ拡張しない。

Both cases have the same stored axis; different per-panel browser selections are not established here. The historical partial MediaRecorder asset remains unchanged. Single-view time loss was not reproduced; orbit/deformation remain realtime. No general geometry/physical accuracy/publicHTTPS/other-engine/MP4/full-parent completion claim follows from this bounded success.
