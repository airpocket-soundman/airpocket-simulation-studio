# Single orbit GIF202c: 限定可視PASS / bounded visible-model pass

固定runtime `4e0f785de1971a2a40b89db6c04a8fe5035818de`、通常main/IAB・英語・前景、正式stdio inspect/edit/view（analyzeなし）。既存94-node thermal boxをimport/readback/caseViewし、GUIの補間2秒を固定したorbit GIF2秒を、新202c予算で**1回だけ**出力した。追加solve/再試行は0。技術driver成功だけで完了とせず、独立した全24枚scene ROIとPNG3枚目視を経て、この例題の可視回転モデルを限定PASSとした。

artifact5574849bytes、SHA256 `56b231f00c29b5b37f39cd165035bef192b2ecb593266ca47e782f0700fe7fbc`、86ページ。GIF89a/640×320/24枚/RGB332・256色/無限loop/総delay200cs。全bytes/hash、元archive→表示resultRevision、canonicalカメラのi/24位相と24位置を照合した。温度field・viewerTimeSeconds/selectedPhysicalTimeSeconds2・interpolated true・viewer-interpolatedを保持し、selectedStoredFrameIndexを出さない。保存履歴0/5/10秒の別frameへ進めず、表示中の補間2秒を固定する。

[独立最終可視監査](independent/visual-review.json)では、generic GIF/LZWとffmpeg各1回・ffprobe1回の全RGBが一致し、24枚すべてのscene ROI[0,0,640,204]に非背景pixel2785〜5163、ROI hash24種類を確認。[先頭](independent/first.png)・[中央](independent/middle.png)・[最後](independent/last.png)で箱全体が見え、面の陰影/向きが変化し、20→30°C凡例・interpolated2s・frame counterが読めることを独立担当が目視した。これは当該boxの表示成功であり、材料校正/一般物理精度ではない。

5状態は所有export数0→1だけを分離して完全一致、GUI/APIの補間2秒へ復元した。settled release/所有analysis-export0、正式sessions空、GUI endpoint/token空、child exit/close0・signal null、PID34656不存在、private token削除、root観測driver exit0を保持する。

raw driverのtechnical-only/pending文と、独立resultのmachine段階manual-pending/overall falseは、検算前/目視前の歴史としてそのまま残す。最終overall acceptanceは別のvisual-review.jsonで閉じる。独立postprocessingのmetadata名typo訂正もnotesに残り、再decodeはしていない。同一14.7MBのRGB2本は独立担当QAのみ保持し、原GIF・decoder source/commands/JSON/stdoutstderr・PNG3枚・全frame/ROI hashをdurable保存する。絶対pathを持つscript/configは実行当時の記録で、portable再実行手順とは呼ばない。

[最初の202 job拒否](../2026-10-27-single-orbit-gif-failed/README.md)と[202b blank-model部分結果](../2026-10-27-single-orbit-gif-main/README.md)は不変。202cの具体的修正はnumeric camera.lookAt座標で、過去の失敗を成功へ書換えない。202failed1/1、202bpartial1/1、202c1/1は別々に消費済み。新driver SHA `024a06aca50ab42cd0c903f6122c2f42cff53f07d4765f1fd0749e1611372c5c`、source/root111＋追加独立1試験、型27宣言、build/local28成功38259.865900000004msを当該sourceの記録として保持する。

全durable fileのSHA256/Git blob SHA1をinventoryでstage照合。保存作業のproduct export/solver/codec/GUI起動は0。実GUI GIF保存ボタンのdownload完了、他言語/hidden/他engine/取消matrix、一般形状や物理精度/校正、公開HTTPS、親タスク完了は未証明。

On frozen runtime above, one separately authorized202c two-second orbit GIF was exported through formal inspect/edit/view scopes on the ordinary foreground English main/IAB. The existing94-node thermal box stayed at the GUI's interpolated2s view. No new solve/retry occurred. Technical driver success was followed by independent all24-frame scene gates and manual first/middle/last image review; only this bounded visible-model example is accepted.

The artifact is5574849bytes, SHA256 `56b231f00c29b5b37f39cd165035bef192b2ecb593266ca47e782f0700fe7fbc`,86 pages:GIF89a/640×320/24 frames/RGB332/256 colors/infinite loop/200cs. Full bytes/hash, source-result identity and24 canonical camera positions/phases were checked. Temperature/interpolated viewer2s remained fixed, without a misleading selectedStoredFrameIndex or progression through stored frames.

Independent generic LZW and FFmpeg decodes match every RGB pixel; ffprobe was run once. All24 scene regions contain2785–5163 nonbackground pixels with24 distinct ROI hashes. The auditor's three PNG reviews confirm a complete visible box, changing faces/shading/orientation and readable legend/interpolated2s/counters. Five-state restoration, settled release, zero jobs, empty sessions, cleared pairing fields, child exit/close0, absent PID34656 and removed token were verified.

Pre-review pending/technical-only raw metadata remains unchanged; final acceptance is a separate visual-review record. Full raw RGB buffers remain in auditor QA; original GIF, decoder/command metadata, representative PNGs and all frame/ROI hashes are preserved. Historical202 rejection and202b blank-scene partial results remain separate exhausted budgets. No new execution occurred during packaging. GUI-button download completion, broader languages/background/engines/cancellation, general geometry/physics/calibration, publication and parent completion remain unproven.
