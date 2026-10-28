# Single thermal WebM200b: 実main成功 / actual-main success

固定runtime `7fee9593ba37c5a933489daadbc1fe628b1b6ea9`、通常main/IABの英語・前景、正式stdio inspect/edit/view（analyzeなし）で確認した。既存実Worker生成archive1case/94nodes/保存時刻0,5,10sをimport→全bytes/SHA readback→caseViewし、GUIのFine timeで**2秒の線形補間表示**を基準にした。追加solveなし、別途承認された200b予算で2秒WebMを1回だけ出力した。失敗200を再実行/成功へ書換えたものではない。

完成artifactは796383bytes、SHA256 `d61b3821761937abe63658f070ec57dd5da46a26ebe73d16ff2ca7de2e4b4591`、13ページ。VP8全keyframe48枚、display440×637、表示長さ2秒。48presentation timestamp/durationと48件のrequested/nearest-stored/符号付きoffsetを、全bytes/hash・元archive→表示resultRevisionの連鎖とともに再計算した。最後は物理10s/offset0、最終presentationは1958333µs＋41667µsで2秒。3保存場を48表示frameへ割当てたもので、48計算stepや動画内の物理補間ではない。field温度、単位degC、private発行proofに基づく製品manifestを確認した。

独立担当は既存bytesにffprobe1回/ffmpeg decode1回だけを行い、48frame・全PTS・2秒・440×637と終端画像を確認した。先頭blue20°C→最後red30°C、caption0→10sとoffset0を目視、先頭/終端decoded SHAも異なる。[独立結果](independent/independent-result.json)と[追加照合](independent/additional-assertions.json)、raw ffprobe/framehash/endpoint画像を保持する。これらは物理精度/実験校正ではない。独立script/configの絶対pathは実行当時環境の歴史記録で、portable再実行手順とは呼ばない。

APIの5状態（inspectの所有export数だけ0→1を分離、cases/compare/result/view）を完全比較し、出力後も**2秒・interpolated true**へ復元した。GUIでもFine200、2.0000s/補間文/temperatureを保持。jobのsettled→release、所有analysis/export0、正式sessions空、GUI endpoint/token空、child exit/close0、PID25080不存在、private token削除、driver exit0を確認した。

raw driver summaryの `externalDecode: not yet run` は外部decode前に保存された値なので、そのまま保持する。後から得た外部成功は新しいindependent証拠/reportで説明し、rawを改変しない。[失敗200](../2026-10-26-thermal-time-webm-failed/README.md)と[孤立native診断](../../native-vp8-padding-diagnostic-2026-10-26.md)も歴史として維持する。前段local検査のstale manifest（a7a52b5と7fee959の不一致）は別scopeの失敗logを保持し、その後のfull build/local28成功41906.5168msと分けた。

全raw/driver/画像/mediaはbyte-copyし、inventoryのSHA256/Git blob SHA1をstageで照合する。保存作業でproduct export・codec・solver・GUIを追加していない。今回の成功は英語foreground IABの温度1case/2秒だけであり、heatFlux動画、日英hidden全matrix、他engine、GUIダウンロード完了、公開HTTPS、親タスク完了は主張しない。予算1/1消費、再試行なし。

The fixed runtime above completed one separately authorized200b export on the ordinary foreground English IAB main page, with formal inspect/edit/view scopes and no analyze permission. One existing Worker-generated thermal case (94 nodes, stored times0/5/10s) was imported/read back/viewed; normal GUI interpolation at2s became the baseline. No new solve occurred. Historical failed200 remains unchanged.

The artifact is796383bytes, SHA256 `d61b3821761937abe63658f070ec57dd5da46a26ebe73d16ff2ca7de2e4b4591`,13 pages, VP8/48 all-key frames/display440×637/two seconds. All presentation timestamps/durations and48 physical selection/offset records were independently recomputed, including source result identity. The final physical frame is10s with zero offset; the last presentation interval ends at2s. Three stored fields supply48 presentation frames, not48 solve steps or interpolated video fields.

The independent auditor ran ffprobe once and ffmpeg decode once on existing bytes, confirming48 frames, exact PTS, duration, display dimensions and terminal image. Its visual observation reports blue20°C to red30°C, captions0→10s and zero endpoint offsets; endpoint decoded hashes differ. Raw metadata, frame hashes and endpoint images remain in `independent/`. This does not establish material calibration or general physical accuracy. Archived absolute-path scripts/config describe the historical environment, not a portable replay recipe.

Five API state snapshots matched, with the expected owned-export count0→1 separated. Both API and GUI restored the interpolated2s temperature display. Settled release, zero owned jobs, empty sessions, cleared GUI pairing fields, child exit/close0, absent PID25080 and removed private token were verified. Raw driver text saying external decode was not yet run is preserved as pre-decode history; later success is documented separately. The preceding stale-manifest local-check failure and subsequent clean build/local28 success are also separate records.

All raw bytes have SHA256/Git blob SHA1 inventory. Packaging added no exports, codec, solver or GUI runs. This single English foreground thermal case does not cover heat-flux video, full language/background matrices, other engines, completed GUI downloads, public HTTPS or parent-task completion. The one-export200b budget is exhausted with no retry.
