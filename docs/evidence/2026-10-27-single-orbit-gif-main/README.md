# Single orbit GIF202b: 可視モデル未達 / visible-model acceptance failed

**artifact取得・形式/ledger・復元/cleanupは成功したが、GIFのモデル領域は全24枚が背景だけだった。可視回転モデルの受入は未達であり、総合成功とはしない。** [report](report.json)と[独立可視監査](independent/visual-review.json)は技術成功と表示失敗を分ける。

固定runtime `b1c550b1ee9b7bbcd27a2571ef54fb9b441a9054`、通常main/IABの英語・前景・正式stdio inspect/edit/view（analyzeなし）で、既存thermal archive1case/94nodesをimport/readback/caseViewし、GUIで補間2秒を基準にした。202bの新予算でorbit GIF2秒を1回だけ要求し、追加solve/再試行は0。旧[失敗202](../2026-10-27-single-orbit-gif-failed/README.md)の予算1/1・原driverはそのまま保持する。

job completed/settled、完成GIF89aは5574849bytes、SHA256 `ed9331e181fe6adc0951eed4e72c2f3e95435ac2cc084923d28d51162ff06ca7`、86ページ。640×320・24枚・RGB332/256色・無限loop、GCE delay総200cs。全bytes/hashと24件のcanonicalカメラからのi/24位相・位置を再計算した。field温度、viewerTimeSeconds/selectedPhysicalTimeSeconds2、interpolated true、viewer-interpolatedで、selectedStoredFrameIndexは出さない。3保存場0/5/10秒の履歴を持つが、動画では補間2秒の選択を固定しカメラだけを変える契約である。

独立担当はgeneric GIF/LZWとffmpeg各1回、ffprobe1回で24枚・全RGB一致・delay/palette/loop/寸法を照合した。しかし[先頭](independent/first.png)・[中央](independent/middle.png)・[最後](independent/last.png)の目視と、既にdecode済みの全24枚ROI集計で、scene領域[0,0,640,204]の130560pixelは全て一様RGB[0,36,85]、scene hashは1種類だった。captionの20→30°C凡例・interpolated2s・1/24,13/24,24/24は読めるが、モデル/meshは見えない。captionの変化や全frame hashの違いは、可視モデル回転の証拠ではない。原因は本bundleでは確定しない。

API5状態は所有export数0→1だけを分離して完全一致し、GUI/APIとも補間2秒へ復元した。job release/所有analysis-export0、正式sessions空、GUI endpoint/token空、child exit/close0・signal null、PID39684不存在、private token削除、driver exit0を確認した。これらの成功を可視モデル成功へ読み替えない。

raw driverの `externalDecode: not yet run`、構造検査のpixelsDecoded falseは独立検算前の歴史として不変。独立result.success trueもcontainer/decodeの範囲で、後のvisualModelEvidencePass falseと併記する。独立PowerShell外側のexit1は、Node監査成功後に存在しないfailure.jsonを読んだinspection由来で、再decodeやdecoder失敗ではない。原GIF・raw metadata・commands/scripts・PNG3枚・全frame hash/ROIを保存し、同一の14.7MB raw RGB2本は独立担当QAのみ保持（保存対象外は独立inventoryに明記）。新decoderは実行していない。

当該sourceのroot検査は107件＋独立3件、型27宣言、build/local28成功37857.93780000001ms。旧sourceの188件＋独立4件やfailed202とは別時点である。全保存fileをbyte-copyし、inventoryのSHA256/Git blob SHA1をstageで照合する。新driver SHA `cec1b69e755b6911cb720da128e7a30cb98ddae858875c542c0b141515ab2da9`、旧失敗driver SHA `abb46b3e3a9cc5a4f613c08ce3411fd5041c23b3d21fed7906151d72c378b9c1` を区別する。保存作業の追加product export/solver/codec/GUIは0。

実GUI GIF保存ボタンのdownload完了、他言語/hidden/他engine、一般物理精度/校正、公開HTTPS、親タスク完了は未確認。今回予算1/1消費、可視モデル未達を保持して再出力しない。

**The artifact/container/ledger and restoration/cleanup checks passed, but all24 GIF scene regions contain only background. Visible rotating-model acceptance failed; this is a partial result, not overall success.** See [report](report.json) and [independent visual review](independent/visual-review.json).

Frozen runtime above used the normal foreground English main/IAB with formal inspect/edit/view scopes. One existing94-node thermal case was imported/read back/viewed; GUI interpolation at2s became baseline. A separately authorized202b two-second orbit GIF was requested exactly once, with zero new solves/retries. Historical failed202 and its exhausted budget remain unchanged.

The completed/settled artifact is5574849bytes, SHA256 `ed9331e181fe6adc0951eed4e72c2f3e95435ac2cc084923d28d51162ff06ca7`,86 pages:GIF89a/640×320/24 frames/RGB332/256 colors/infinite loop/200cs total delay. Full bytes/hash and24 canonical-camera phase/position records were recomputed. Temperature/viewer2s/interpolated selection stayed fixed in the manifest, with no selectedStoredFrameIndex. These technical checks do not prove visible geometry.

The auditor's generic LZW and FFmpeg decodes agree on all24 RGB frames; ffprobe/delays/palette/loop/dimensions pass. Yet first/middle/last PNGs and all-frame scene-ROI checks show a uniform RGB[0,36,85] across130560 pixels per scene, with one unique scene hash. Captions and counters are readable; model/mesh geometry is absent. Changing captions/full-frame hashes cannot establish model rotation. Root cause is not established here.

Five API state snapshots match apart from owned-export count0→1; GUI/API restored interpolated2s. Released/zero-owned jobs, empty sessions, cleared pairing fields, child exit/close0, absent PID39684 and removed token passed. Raw pre-decode text remains unedited. Independent technical success and later visual failure are both retained. Its outer PowerShell inspection error after successful Node auditing was not a decoder failure and triggered no rerun.

Original GIF, raw metadata/commands/scripts, three PNGs and full frame/ROI hashes are byte-preserved. Two identical14.7MB raw RGB outputs remain only in auditor QA, explicitly excluded by its inventory. All durable files have SHA256/Git blob SHA1 checks. Packaging ran no new product export, solver, codec or GUI operation. GUI-button download completion, broader browser/language/background behavior, physical accuracy/calibration, publication and parent completion remain unproven. The one-export202b budget is exhausted.
