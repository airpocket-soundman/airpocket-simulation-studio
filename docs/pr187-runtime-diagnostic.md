# PR187の単独WASM診断

[English](en/pr187-runtime-diagnostic.md)

CI run39966324760は既存advanced-structural-sourceの先頭2試験の後、18.547秒でfile-level失敗。specログにはsignal/exit理由がなく、既知V8 fatal文字列もない。OOM・signal・V8障害・assertionの区別は未確定。既定解析期限120秒より短いが、それだけで原因を決めない。

既存 `WASM runtime diagnostic comparison` workflowに `target=advanced-structural-source`、`mode=single` を指定できる。singleはiterations入力と無関係に1回、GC変更なし・concurrency overrideなしで直接reproduceを実行する。既存compareの2モード経路は維持。通常npm test・Node・solver・物理閾値は変更しない。

診断childは明示TAP reporterを使い、stdout/stderr、exit code、signal、timeoutをJSONへ保持する。Linux cgroup v2のmemory.events/current/peak/maxを前後採取し、欠測はavailable=false、数値は精度を失わない文字列、maxは無制限を示す文字列で保存。集計単位はrunnerのcgroupであり、oom_kill増分だけで対象childがOOM死したとは断定しない。Windowsはnot-linuxと記録する。出力上限・exclusive evidence・既定の失敗停止を維持する。

[Windows単独生TAP](evidence/2026-10-23-pr187-structural-windows.tap)と[実行情報](evidence/2026-10-23-pr187-structural-windows.json)は診断変更前に許可された1回の実行で、対象ソースSHA256 `2a19c5aabaca822171e1bbf29dde7e292f15f644d754a4c8142df51993a2830c` がbase bb6f24cと同一。3/3成功、Node v24.11.1、7733 ms、exit0/signalなし、stderr0。CI不具合の修正成功や偶発性の証明ではない。新workflowのLinux実行はrootがdispatchするため未確認。

## 2026-10-23追記: Linux単独診断と独立監査

上記のLinux待機は初稿時点の履歴。後続の [focused run39968250962](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39968250962) はclean head `f2db420e49af992f1bbaa87204082856aaf6643b`、Linux Node24.21.0/V8 13.6.233.17-node.53で既定GCの1回実行。concurrency overrideなし、NODE_OPTIONSなし、明示TAPで3/3成功・失敗0・skip0、4782ms、exit0/signal null/timeoutなし/stderr0だった。これは**単独では非再現**という結果で、元の全体CI run39966324760の原因解明・根治・偶発性の証明ではない。

取得済み [raw JSON](evidence/pr187-linux-focused-20261023/wasm-single.json) は41893bytes、SHA256 `babb7a0ea7b55ac53977128900dcd132e9b85f3dd2f0d1e496aefad85f411c47`。所有領域の取得元とbyte一致を確認し、`* -text`で保存した。[TAP](evidence/pr187-linux-focused-20261023/wasm-single.tap) はそのstdoutからの抽出で、追加実行ではない。[独立照合記録](evidence/2026-10-23-pr187-linux-focused-audit.json)にhead、引数、hash、cgroup前後を固定した。

Linux対象source hashはgit blob（LF）の `d44a59cce4d7c2369bb968bc9eb3c986526e896d39b873b715cf823fe59fc1e2` と一致。歴史的Windows値 `2a19c5aabaca822171e1bbf29dde7e292f15f644d754a4c8142df51993a2830c` は同じblobのCRLF化hashと一致した。bb6f24cとf2db420の対象blob内容も一致し、hash差をロジック変更と誤認しない。元Windows証拠は変更していない。

runner cgroupのoom/oom_killは0→0。memory.peakは3146035200→3357949952bytes、memory.currentは2857308160→2858680320bytes、memory.maxはmax。これらは共有cgroupの累積/生存期間値であり、対象childのpeak RAM・RSS・OOM原因を表さない。古い失敗のOOM否定にも使わない。

診断修正e836b4eの7filesを独立read-only監査し、TAP/signal保持、cgroup欠測と文字列値、singleの1回既定GC実行、通常pages workflow/npm test/solver閾値の非変更を確認した。関連15試験成功、失敗0・skip0。監査中solver再実行0、実害ある追加欠陥なし。通常CI run39968241372は引継ぎ時進行中で、本記録では未確定として保持する。
