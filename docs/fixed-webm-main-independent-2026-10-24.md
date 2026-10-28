# 実main固定WebMの独立再計算（2026-10-24）

[English](en/fixed-webm-main-independent-2026-10-24.md)

owner証拠commit `e1aeed9456d3b167f84d19b3af96f0ad077bfff2`（実行source8208329）の[固定capture](evidence/2026-10-24-fixed-comparison-webm/README.md)を別scriptで再計算した。[結果JSON](evidence/2026-10-24-fixed-comparison-webm/independent-crosscheck.json)。この監査でbrowser操作・再export・codec・solverは実行していない。

- 24輸送pageをbase64 decodeして結合し、WebM 1,540,510bytesとSHA-256 `20fc86d0b17d1fa32f26f46575693b1a49a03ac350697f703a5fb0dea646d077` に完全一致。
- 正規export済みarchive 500,449bytesのraw SHAとcanonical archiveRevisionを再計算。独自sorted JSON/SHAにより各caseのrevision、output単体のresultRevisionもmanifest/caseListへ一致し、全source ID連鎖を確認した。元のpre-import bytesや未取得prepared snapshotの再導出とは呼ばない。
- 48presentationの整数μs丸めをBigInt有理式で独立計算。各phaseの物理要求時刻から保存24時刻への最近傍選択と符号付きoffsetを全96panelで再計算。終端は双方frame23・1.2ms・offset0。
- 既存ffprobe rawの全48PTS、VP8/key、1280×640、全体2.000000秒と末尾PTS＋durationを照合。既存decodeの48個SHAを再読し全distinct。独立に再decodeはしていない。
- input/ケース/比較panel/result/viewの5物理baselineが一致。保持中の唯一の差はownedExportJobsが0→1になること。解放/切断の証拠はownerbundleの別記録として維持する。

両panelは同一の保存時刻軸で、異軸の実画面確認ではない。48画像hashの相違は48の独立物理解を意味せず、各sourceの保存状態は24枚でcaptionも変化する。pure codec fixture監査・旧MediaRecorder partial・今回の実main captureは別の証拠として保持し、公開や親受入の完了へ拡張しない。進捗変更なし。

再計算: `node docs/evidence/2026-10-24-fixed-comparison-webm/verify-independent.mjs docs/evidence/2026-10-24-fixed-comparison-webm`。標準出力のみで、captureを変更しない。第2引数に明示した新規output pathを指定すれば結果を保存できる。runtime/private/production helper importはない。
