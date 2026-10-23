# 比較GIFのフレーム時刻実検証 / Comparison GIF frame timing verification

通常main画面と正式ローカルstdio MCPで、保存済み熱2ケース・音響2ケースを読み取り、各24フレームGIFの全bytes/hash、各frame/panelの要求時刻・最近傍保存時刻・符号付きずれ・識別版を照合した。solverは0回。これは具体的payload/手順をrootから受けた既存機能の検証であり、fresh-skillの独立再現ではない。VIEWCOMPARE親はbuildingのまま。

The ordinary main page and formal local stdio MCP exported two existing thermal cases and two existing acoustic cases. All artifact bytes/hashes and 24 frame requests / 48 panel selections per GIF were checked independently against stored axes. No solver ran. Root supplied concrete payloads/procedure; this is existing-feature verification, not fresh-skill reproduction. The parent VIEWCOMPARE task remains building.

## Evidence scope

- Runtime source: `14120751d6f4ab2bba4b2632c83af8107e9f5576`. Main page candidate `5e0bcb9` has no diff in main.js/src/scripts against this source. Chrome reports reduced UA version 155.0.0.0; full version is not independently verified here. Origin: http://127.0.0.1:5188.
- A dedicated session was paired with inspect/edit/view only; analyze was not granted. Re-pairing used the same ordinary main tab after explicit GUI disconnect. The thermal archive was imported once, then read back through the official archive export API. The acoustic archive was subsequently imported through the same chunked protocol. Every owned import/export transfer and export job was released.
- `thermal-raw-completed.json` and `acoustic-raw-completed.json` are retained completed RPC metadata. `*-state.json` is the raw before/after snapshot. `*-independent-verification.json` and `*-decode.json` are offline checks. `*-normalized-cases.json` is the byte-preserved official caseArchiveExport response body, verified against transfer bytes/SHA and the git-source archive content.
- `*-frame-00/12/23.png` are Pillow-decoded images of the exported GIFs. Main screenshots were captured by root after explicitly pressing Show comparison. The thermal main screenshot is from the first phase and proves only normal UI display, not success of that first GIF validation. Acoustic main capture occurred after the final state comparison; that subsequent UI action is outside the unchanged-state baseline.

## Driver corrections and exact attempt count

Three GIF exports ran: thermal attempt 1, thermal attempt 2, acoustic attempt 1. Two driver checks failed; neither failure is hidden or counted as a passing complete driver.

1. `thermal-first-failure.json`: artifact retrieval/hash succeeded, then the driver incorrectly compared the displayed-source resultRevision to the raw saved output hash. `case-operations.readSource` calls `prepareCaseView`, which rederives `mesh.summary` with `inspectMesh`. No physical array is changed. The corrected oracle derives that summary explicitly from the read-back archive, rather than importing the comparison adapter or prepareCaseView. First-attempt bytes/metadata were not retained; that attempt is not artifact evidence.
2. `thermal-state-comparison-failure.json`: the second thermal artifact and all ledger checks passed, with raw bytes/status saved before assertions, but the driver incorrectly required the entire inspect response to be unchanged while it still owned the completed export. The only difference was lifecycle.ownedExportJobs 0 -> 1. Offline verification checks input revision / all remaining inspect content and cases/compare/result/view unchanged, and reports the ownership count separately. There was no third thermal export.
3. Acoustic completed the corrected live and offline checks. Release afterwards returned ownedExportJobs and ownedAnalysisJobs to 0. Final formal sessions[] and explicit GUI disconnect were recorded. Child PID 11032 was observed running and absent after closure; pairing-token file deletion was checked. This is a concrete process observation, not a general guarantee about the old close helper.

## Independent expectations and visual review

Both GIFs are 640x320, 24 frames, RGB332, infinite loop and 2000 ms total with 8/9 centisecond delays. Frame i requests phase i/23; time is end*i/23. Each panel chooses argmin(abs(savedTime-requestedTime)), with earliest index on exact ties, and offset = selected-requested. All 96 panel records across the two exports match. GIF hashes are in report.json and the byte inventory.

Thermal uses 0..10 s integer stored axes and the synthetic reference T=20+t / 20+2t degC. Decoded frame 12 shows requested 5.217391 s, both panels at 5 s, -217.39 ms offset and different temperature colors within the shared 20..40 degC scale. Frames 0 and 23 show the endpoints. Acoustic frame 12 shows requested 626.086956 microseconds, selected 625.974026 microseconds and -0.1129305 microsecond offset; endpoint frames and the 1 Pa / 2 Pa color differences were visually reviewed. RGB332 pixels are not an exact inverse thermometer/pressure probe. All timestamps are checked numerically, while visual text inspection is limited to frames 0/12/23.

Both cases within each dataset share the same time axis, so this does not establish different per-panel selected times in a real browser. The existing uneven-axis automated test retains that separate coverage. No new physical accuracy, general geometry, public HTTPS, MP4 or per-frame WebM timing claim is made. GIF bytes came only from exportArtifact; no Blob URL or enlarged-image-link access was used.

日本語補足: 2つのdriver誤仮定を失敗記録として保持し、熱の再出力は承認された1回だけ。入力・ケース・比較・結果・カメラの不変性と、取得中/解放後の所有ジョブ数は別判定。両panelの保存時刻軸は同じため「異なるpanel時刻の実機検証」へ拡張しない。物理精度・一般形状・公開HTTPS・MP4・WebM個別時刻は今回の証拠では閉じない。

## Replay notes

The `.txt` driver snapshots are exact copies of the three local QA driver versions; they are evidence, not installed runtime source. They use createStdioClient and studio_browser_call, with no solver methods. Private pairing data is intentionally excluded. Reproduction needs an explicitly paired ordinary browser page, existing Vite/runtime assets, Node and available Pillow. The successful run used existing Pillow 12.2.0 without installing dependencies. Per export limits were 120 s watchdog, 32 MiB artifact and 512 pages of <=65536 decoded bytes. The first two stopped checks are not blindly retried; only the separately authorized thermal recheck and the planned acoustic run occurred.
