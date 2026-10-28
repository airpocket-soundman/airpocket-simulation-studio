# PR196固定headのCI記録

[English](en/pr196-validation-2026-10-24.md)

既存[run39991917717](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/39991917717)はhead `3d3c450aab2d5fe9f1ff143e4b50ff1aa37fe15b`、merge candidate `ec58004c657d1caa237ab29bea3f1a938cc89795`で成功。2156total/2148pass/0fail/8skip、試験288589.14393ms。build成功、local配布物report28/28（ログPASS27＋deployed-asset-integrity1）、38828.373396msを確認した。

[集約JSON](evidence/2026-10-24-pr196-final-validation.json)にexacthead・merge両親・自動artifact ID/digest・raw file SHAを保持する。artifactは完了後1回だけ取得し、rawログ/report/checkpointsはbyteコピー、専用属性でtext変換を無効化した。CLI取得run/merge/artifact metadataは別JSONとして保持する。新CI・retry・local solver・GUIは実行していない。

deploy/verify-publishedはskipで、merge/公開HTTPS成功ではない。過去の原因不明失敗の解決や親タスク完了も主張しない。
