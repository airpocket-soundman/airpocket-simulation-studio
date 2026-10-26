# PR201固定headのCI記録

[English](en/pr201-validation-2026-10-27.md)

既存[run40375784106](https://github.com/airpocket-soundman/airpocket-simulation-studio/actions/runs/40375784106)はhead `c786f2661832c105a3b9bccd4cf15aeea1adc99d`、merge candidate `85ad434939893359ef90388c3959226a4d01c08c` で成功。2246total/2238pass/0fail/8skip、試験292674.241218ms。build step成功7秒、local配布物report28/28（ログPASS27＋deployed-asset-integrity1）、38219.183745msを記録した。

[集約JSON](evidence/2026-10-27-pr201-final-validation.json)にexact head・merge両親・自動artifact ID12674444657/digest・raw9件のSHA256/Git blob SHA1を保持する。完了artifactを1回取得し、ログ/report/checkpointsをbyteコピー、text変換無効の専用属性で保存した。CLI取得run/merge/artifact metadataは別JSONで識別する。新CI・retry・local solver・GUI・codec実行は0。

deploy/verify-publishedはskip。merge/公開HTTPS成功、親COUPLE3完了、一般曲面精度/実測校正や過去ランタイム失敗の根治は主張しない。
