# PR197 exact-head CI observation

[日本語](../pr197-ci-observation-2026-10-24.md)

The existing [run39992234541](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39992234541), attempt1, succeeded for [PR197](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/197) head `e630920dcf482c521f128c19654ed0756a51eaa3`. Checkout used merge candidate `645d9e63452ab04ed382abcee6b44ddbd0cac221` against base `3d3c450aab2d5fe9f1ff143e4b50ff1aa37fe15b`. No new workflow run, retry or solver was started.

The full suite reported 2165 tests: 2157 passed, zero failed, eight existing skips, in 192.989430126 seconds. Build took 2.69 seconds. All 28 local publication-equivalent checks passed in 26.50659978 seconds on Node24.21.0/Linux x64, with automaticRetry/fallback false. The verify job ran from 2026-10-23 17:05:42 to 17:10:14 UTC, 272 seconds.

Automatic artifact `verification-39992234541-1` (id12517888289, 89882bytes) was downloaded; ZIP SHA-256 `adb3a30d676302b5d83fb78e47ed0e3722c4ee44d1e710ead2e583a660433760` matched GitHub's digest. The local report SHA-256 is `9b04a8563cffb0e71ecff04e64bc823e4e7a1374ad4181ea14c3f7e4f7305709`. Original bytes and per-file hashes are retained in the [evidence summary](../evidence/pr197-ci-20261024/summary.json).

Deploy and verify-published were skipped by the PR workflow condition; this does not establish publication or merge. The eight environment-dependent skips and historical initial reciprocal-document-link failure remain recorded. Success applies to this fixed candidate. Runtime, progress and 171/37 statuses are unchanged. This follow-up itself is checked with the two documentation regressions.
