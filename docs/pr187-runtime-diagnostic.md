# PR187の単独WASM診断

[English](en/pr187-runtime-diagnostic.md)

CI run39966324760は既存advanced-structural-sourceの先頭2試験の後、18.547秒でfile-level失敗。specログにはsignal/exit理由がなく、既知V8 fatal文字列もない。OOM・signal・V8障害・assertionの区別は未確定。既定解析期限120秒より短いが、それだけで原因を決めない。

既存 `WASM runtime diagnostic comparison` workflowに `target=advanced-structural-source`、`mode=single` を指定できる。singleはiterations入力と無関係に1回、GC変更なし・concurrency overrideなしで直接reproduceを実行する。既存compareの2モード経路は維持。通常npm test・Node・solver・物理閾値は変更しない。

診断childは明示TAP reporterを使い、stdout/stderr、exit code、signal、timeoutをJSONへ保持する。Linux cgroup v2のmemory.events/current/peak/maxを前後採取し、欠測はavailable=false、数値は精度を失わない文字列、maxは無制限を示す文字列で保存。集計単位はrunnerのcgroupであり、oom_kill増分だけで対象childがOOM死したとは断定しない。Windowsはnot-linuxと記録する。出力上限・exclusive evidence・既定の失敗停止を維持する。

[Windows単独生TAP](evidence/2026-10-23-pr187-structural-windows.tap)と[実行情報](evidence/2026-10-23-pr187-structural-windows.json)は診断変更前に許可された1回の実行で、対象ソースSHA256 `2a19c5aabaca822171e1bbf29dde7e292f15f644d754a4c8142df51993a2830c` がbase bb6f24cと同一。3/3成功、Node v24.11.1、7733 ms、exit0/signalなし、stderr0。CI不具合の修正成功や偶発性の証明ではない。新workflowのLinux実行はrootがdispatchするため未確認。
