# PR197 exact-head CI確認

[English](en/pr197-ci-observation-2026-10-24.md)

[PR197](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/197) のhead `e630920dcf482c521f128c19654ed0756a51eaa3` に対する既存[run39992234541](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39992234541)、attempt1の成功を観測した。checkoutされたmerge candidateは `645d9e63452ab04ed382abcee6b44ddbd0cac221`、baseは `3d3c450aab2d5fe9f1ff143e4b50ff1aa37fe15b`。新run・retry・solverを起動していない。

全件2165、成功2157、失敗0、既存skip8、192.989430126秒。buildは2.69秒、公開相当local検査28件すべて成功、26.50659978秒。Node24.21.0/Linux x64、local検査のautomaticRetry/fallbackはfalse。verify jobはUTC2026-10-23 17:05:42から17:10:14の272秒。

自動保存artifact `verification-39992234541-1`（id12517888289、89882bytes）を取得し、zip SHA-256 `adb3a30d676302b5d83fb78e47ed0e3722c4ee44d1e710ead2e583a660433760` をGitHubのdigestと照合した。local report SHA-256は `9b04a8563cffb0e71ecff04e64bc823e4e7a1374ad4181ea14c3f7e4f7305709`。原bytesとファイル別SHAは[証拠summary](evidence/pr197-ci-20261024/summary.json)に保存した。

PR条件によりdeploy/verify-publishedはskipされ、公開・mergeの成功を意味しない。環境依存8skipや、統合時の初回docs相互リンク欠落の履歴を消していない。全件成功はこの固定候補に限る。171/37と進捗・runtimeは無変更。この追補自身はdocs回帰2件で確認する。
