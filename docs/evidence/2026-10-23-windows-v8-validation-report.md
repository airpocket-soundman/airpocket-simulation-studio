# Windows 全件再検証 / Windows full-suite revalidation

2026-10-23、基点 `5647a6f`。Node 24.11.1 / V8 13.6.233.10-node.28 / Windows x64。

`node --test --test-concurrency=4 tests/*.test.mjs` は exit 0、1,896件中1,889成功、失敗0、既存skip 7、421.663秒。SDKを取得せず、既存MFEM WASMと一致するbuild-stampを再利用し、kernel/CAD assetsを準備した。試験コード、閾値、skip条件は変更していない。

既存skipはシンボリックリンク能力不足1件と、host-native executable/prepared proof環境不足6件。既存MFEM WASMを用いる通常Worker検証は実行された。全件成功をhost-native全受入とは扱わない。

前回の `visual-export-fixed-frame.test.mjs` のfatalは、V8 `ThreadIsolation::UnregisterWasmAllocation` の `jit_page_->allocations_.erase(addr) == 1` assertionだった。今回の全件で再現せず、同ファイルの単独5反復も各17/17成功、失敗/skip 0。この観測だけで非決定的なV8停止の根治とは主張しない。原因を確定できなかったため、動作を変える修正は加えていない。

全件・反復のログは専用worktreeの `.qa-v8-*.log` に保持し、各byte数/SHA-256/件数/時間を隣接JSONへ記録した。公開、Linux CI、5647a6f後の統合変更はこの証拠に含まない。

The recorded base passed the entire Windows suite: 1,889 passed, zero failed, seven existing environment-dependent skips, 1,896 total, exit 0. All five independent focused repetitions passed 17 tests each. No test behavior, threshold or skip condition changed. Existing native WASM cache was reused without SDK downloads.

The previous V8 allocation assertion was not reproduced. These successful runs do not establish a root-cause fix or cover subsequent integration changes, Linux CI, host-native proof acceptance or publication. The adjacent JSON records environment, preparation, results and log hashes.
