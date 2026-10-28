# PR198固定headのCI記録

[English](en/pr198-validation-2026-10-26.md)

既存[run40281674755](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/40281674755)はhead `16613b8d407e798e86b21eae4398adab227f81d5`、merge candidate `9264a5334e49505c8db3dade96f0098311b9a081`で成功。2175total/2167pass/0fail/8skip、試験275846.713994ms。build step成功7秒、local配布物report28/28（ログPASS27＋deployed-asset-integrity1）、37852.123636msを記録した。

[集約JSON](evidence/2026-10-26-pr198-final-validation.json)にexacthead・merge両親・自動artifact ID12633050364/digest・raw9件のSHAを保持する。完了artifactを1回取得し、ログ/report/checkpointsをbyteコピー、text変換無効の専用属性で保存した。CLI取得run/merge/artifact metadataは別JSONとして識別する。新CI・retry・local solver・GUI・codec・SU2実行は0。

deploy/verify-publishedはskip。merge/公開HTTPS成功、親CFDPORT1完了、一般CAD開口/製品UI接続や過去ランタイム失敗の根治は主張しない。
