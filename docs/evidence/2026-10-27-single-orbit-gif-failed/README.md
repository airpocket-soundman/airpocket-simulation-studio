# Single orbit GIF202: 失敗記録 / failed attempt

固定runtime `35922baf5a8737429bc544cbc44842bb1d33cf05`、通常main/IAB・英語・前景・正式stdio inspect/edit/viewで、既存thermal archive1case/94nodes/保存時刻0,5,10sをimport/readback/caseViewした。GUIのFine timeで補間2秒を基準に、2秒長・24枚予定のorbit GIFを**1回だけ**要求。新solveなし、予算1/1を消費し再実行していない。

jobは `failed/executionSettled:true`、`GIF_ORBIT_INVALID` / `Orbit GIF proof is missing, stale or does not match the prepared view`。progress1、画面の `Orbit GIF completed.` はrenderer側の表示であり、job境界での成果物成功を意味しない。statusにartifact descriptorはなく、artifact取得まで進んでいない。完成GIF bytes/hash、24frame ledger・画像・delay・paletteの実証はない。raw driverのcompleted期待assert失敗も保存する。このbundleだけでproof不一致の原因を確定しない。

GUIでは温度field・Fine200・2.0000s・補間説明・stop disabledへ戻ったことを記録した。これは選択GUI項目の復元であり、driverは5state完全照合へ到達していない。全物理状態不変の成功を主張しない。job release/所有analysis-export0、正式sessions空、GUI endpoint/token欄空、stdio childのexit/close0・signal null、PID31844不存在、private token削除を別々に保持する。driver exit1はroot観測。

元driver SHA256 `abb46b3e3a9cc5a4f613c08ce3411fd5041c23b3d21fed7906151d72c378b9c1` は変更せずbyte-copyした。raw/GUI画像とともにinventoryのSHA256/Git blob SHA1をstageで照合する。pairing秘密ファイルは保存しない。追加export・solver・codec・GUI操作は0。後の修正/新予算があっても本失敗を成功へ書き換えず、公開・物理精度・親完了を主張しない。

On frozen runtime above, the ordinary foreground English main/IAB used formal inspect/edit/view scopes to import/read back/view an existing94-node thermal case. The normal GUI selected interpolated2s as baseline. Exactly one two-second orbit GIF request, planned for24 frames, consumed its separate one-export budget; no new solve or retry occurred.

The settled job failed with `GIF_ORBIT_INVALID`: its private proof was missing, stale or inconsistent with the prepared view. Progress1 and the UI's `Orbit GIF completed.` message describe renderer completion, not job-boundary artifact success. No artifact descriptor was published or artifact read attempted; completed bytes/hash,24-frame camera ledger, pixels, delays and palette were not verified. The downstream driver assertion failure is retained too. This bundle alone does not establish the proof-mismatch root cause.

Post-failure GUI observations show temperature/Fine200/interpolated2s/disabled stop. These are selected GUI restoration checks only; the driver never reached full five-state comparison. Released/zero-owned jobs, empty sessions, cleared GUI pairing fields, child exit/close0 with null signal, absent PID31844 and private token removal are recorded independently. Root observed driver exit1.

The unchanged frozen driver, raw files and GUI images are byte-preserved with SHA256/Git blob SHA1 inventory. No pairing secret file is retained. Packaging added no export, solver, codec or GUI runs. Future fixes must retain this failure; no publication, physical-accuracy or parent-completion claim is made.
