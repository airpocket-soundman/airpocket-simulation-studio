# 単一ビュー音響時刻WebM・通常mainの実確認

[English](README.en.md)

固定runtime `1aa0e9eeaedf05ff2ece202f717df00c571a4b66`、localhost通常main・Codex IAB・ENで正式stdio MCPをGUI明示pairし、review51の既存2ケースを正式transferで取り込み、全readback bytes/SHAを照合した。最初の音響ケースを表示し、`startExport` のtime WebMを**2秒・1回だけ**作成した。解析の起動・自動再試行はない。[摘要](evidence-summary.json)、[全rawコピーinventory](raw-copy-inventory.json)。

923,844 bytes、SHA-256 `1b9ace1750d168d63b2a86ef5d70ee66e6cec42a806a0be5531c849a60563649`。15ページのbytesを結合して `acoustic.webm` と一致。VP8・584×640・all-key48フレーム・表示時間2秒を独立ffprobe/全framehashで確認した。全48の再生timestamp/durationと近傍保存時刻ledgerを再計算し、先頭0秒・最後0.0012秒（1.2 ms）・最後のずれ0を確認した。独立decode画像のcaptionも両端と一致する。[最初](independent/endpoint-1.png)、[最後](independent/endpoint-2.png)。

`state-before-after.json` の5状態（入力inspect、cases、比較設定、結果表示、setup表示）は保持中のownedExportJobs増加を除いて一致。terminalと `executionSettled:true` を待ってjobを解放し、transferも解放、owned解析/出力は0。GUI切断・接続先とコード欄の空、sessions空、stdio子のexit/close0（TERM/escalationなし）、PID消失・private token file不在を保存した。GUI操作の根拠はgui画像/DOM記録であり、APIから秘密入力欄を推測したものではない。rootはタブ/Viteも後に閉じたと報告した。

原文archive SHA `bd30abd84f1b8c7fce85018feb476d44d7d88cef934b8edb45867ec45362a0b7` と、正式normalized JSON SHA `5c7ec975ac3ccec58de4f391c00b8522afc9a6598a2422322cef253593b8cf31` は別のbyte identityである。内容の完全一致を確認したが、原文byte同一とは言い換えない。driver SHAは `dd6b40d6b43d22210914cfd91a168a320651f4cf3c2e59117aac66424ece45d6`。driver/独立scriptは当時の相対/絶対QAパスを残す履歴資料で、このfolder内の直接実行用ではない。private pairing fileは含めない。

基礎検証はowner99/99、root統合117/117・型宣言22・buildとlocal report28件成功（42.1955936秒、runtime1aa）。同じlocalチェックをbuild完了前に開始した最初の試みは `dist/runtime-manifest.json` がなく、solver起動前に準備失敗した。`validation/early-published*` に残す。その後buildして正常な公開前チェックを別に実施したのであり、browser exportの再試行ではない。source作業時の既存real-solve試験のmissing-WASM準備失敗も、隣の `../2026-10-24-single-view-acoustic-fixed-webm.json` に保持している。

独立検算scriptの最初の版は最終ページのnextOffsetを数値と誤って期待し、nullでassert失敗した。契約を修正し同じ保存済みrawを読み直しただけで、RPC/出力/解析を再試行していない。`independent/audit-notes.json` を残す。driverの歴史的summaryに「external decode未実行」とあるのはdriver終了時点で、後続の独立結果がその確認を補っている。

これは小規模の保存済み音響archive・1runtime・IAB・localhostの限定確認である。branded Chrome、GUI download完了、実背景/停止条件、他engine、熱time WebM、一般形状、材料校正や物理精度、公開HTTPSの証明へ拡張しない。元入力/結果・親受入の状態は変更しない。`executionSettled` はexport promiseの後片付けを示し、OS/codec資源を独立列挙した保証ではない。installed Skillの同期はrootが別に行う。
