# PR200 aa06 historical CI failure / 旧head失敗

Run40374493868 verifies headaa06c9643e1bee0cf1394128f529172b43dd7f07 only. It failed one obsolete source-pattern assertion in tests/browser-study-state.test.mjs:55:2222 total,2213 passed,1 failed,8 skipped. Build/local published checks were skipped. This is not an unexplained native/V8 failure. The newly supported thermal path no longer matches the old acoustic-only regex. This record remains failed, even if a subsequent head succeeds. No rerun was dispatched by the collector. All three raw files have exact byte/SHA inventory in summary.json.

旧head専用の失敗記録。熱動画未対応という旧ソース確認のassert1件で失敗し、build/local検査には進んでいない。新head成功で上書きしない。追加run/retryなし、元artifactは一回取得し3rawのbyte/SHAを固定した。
