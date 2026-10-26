# 熱の保存時刻WebM200: 失敗記録 / Thermal stored-time WebM200: failed attempt

固定runtime `636a2421621f896b63473d91d604c5a02d06249e`、通常main/IAB・英語・前景で、既存の実Worker熱履歴archive1case/94nodes/保存時刻0,5,10sを正式MCPからimport/readback/caseViewした。追加solverは0。GUIで2秒の線形補間表示を設定してから基準状態を取得し、2秒長・48frameを予定するtemperature WebMを**1回だけ**要求した。

jobは `failed/executionSettled:true`、`WEBM_ENDPOINT_UNVERIFIED` / `Fixed WebM decoded frame identity or dimensions differ` となった。progress1は成功を意味しない。完成artifactはなく、artifact bytes/全frame ledger/終端10秒の検証も行えていない。driverの後続assertがfailedとcompletedの違いで停止した事実も保存する。このbundle単独では、どのframe/dimensionが不一致だったかや根本原因を確定しない。後の修正や再試験でこの失敗を消さない。

失敗後GUIの温度field・2.0000s・補間表示、モデル操作enabled/停止disabled、visibleを確認した。これは**選択GUI項目の復元**で、driverは失敗箇所から5state完全比較へ到達していない。5state不変成功を捏造しない。job解放・所有job数0・GUI切断/endpoint/code空・正式sessions空・stdio exit/close各0/signal null・PID29680不存在・private token削除を別々に確認した。driver終了コード1はrootの観測である。

元archiveのGit blob `ccfcca833a094bb322afdb08777a02fcf2fa883c`、117499bytes、SHA256 `d194a1ab08d5ddec80ac9fffe5ae367e2d1a64e608f0b58c1552e2b0a435df0b`。raw/driver/GUI画像はbyteコピーし、inventoryにSHA256とGit blob SHA1を保存する。pairing秘密ファイルは含めない。source成果物・進捗statusは変更せず、追加export/solver/codec/GUI操作を行っていない。予算1/1を消費し、同driverの再実行はしない。

The frozen runtime above imported/read back/viewed one existing Worker-generated thermal case (94 nodes; stored times0,5,10s) through formal MCP. In the ordinary foreground English IAB main page, the GUI first selected the interpolated2s display. Exactly one two-second temperature WebM export was requested, with zero new solver runs.

The job failed and settled with `WEBM_ENDPOINT_UNVERIFIED`: decoded frame identity or dimensions differed. Progress1 is not completion. No completed artifact, acquired media bytes, validated48-frame ledger or terminal10s proof exists. The later driver assertion failure is preserved separately. This bundle alone does not establish the precise mismatching frame/dimensions or root cause; future fixes must retain this historical failure.

Post-failure GUI observations show temperature,2.0000s interpolation, enabled model controls, disabled stop and visible foreground. This proves selected GUI restoration only: the driver never reached its full five-state comparison. Cleanup independently established released/zero-owned jobs, cleared GUI pairing fields, empty formal sessions, child exit/close0 with null signal, PID29680 absent and private token removal. Root reported driver exit1.

Raw files, the frozen driver and GUI images are byte-preserved with SHA256 and Git blob SHA1 inventory. No pairing secret file is included. Packaging executed no additional export, solver, codec or GUI operation. The one-export budget is exhausted; no retry occurred. No publication, physical accuracy, endpoint success or parent-task completion is claimed.
