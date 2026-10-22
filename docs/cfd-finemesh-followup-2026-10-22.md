# CFD細メッシュの期限延長検証（2026-10-22）

[English](en/cfd-finemesh-followup-2026-10-22.md)

[前回検証](cfd-reference-2026-10-22.md)の細メッシュだけを1回、最大240秒・RSS1GiB・1threadで実行した。mesh/input/configのSHAは前回と同じで、変更は壁時計期限90→240秒のみ。過去のplan・結果は上書きしていない。

**細メッシュ単独の事前QA条件を満たしたが、参照検証全体とCFD1は未完了。** baselineとのCd差4.1227%が既存許容3%を超えるため、精度のメッシュ依存は解消していない。許容値は変更していない。

| 項目 | 今回の実結果 |
|---|---|
| 実行 | SU2 8.5.0、1回、exit0、89.078秒、peak RSS 36,368,384 bytes |
| mesh | 7,296節点・7,168四角形、周方向128、外半径50.5m |
| 停止理由 | 1200反復上限（履歴index1199）。圧力停止基準−10には未到達 |
| Cd / 参照誤差 | 1.521036488 / 0.931419%（既存許容5%） |
| P / U / Vのlog10残差 | −7.983410684 / −7.120148337 / −7.230978230 |
| 最終100反復Cd幅 | 0.000388485%（既存許容0.5%） |
| 節点遠方質量積分の相対差 | 0.0449777%（既存許容0.1%）。内部離散面流束の検証ではない |
| baselineとの差 | 4.1226959%（許容3%を超過） |

以前の90秒期限が今回は89.078秒で完走したことを、性能改善とは扱わない。実反復上限、入力、数値設定は同じで、負荷や実時間には変動がある。

## 停止基準とQA判定

固定configは `CONV_FIELD=RMS_PRESSURE`、`CONV_RESIDUAL_MINVAL=-10`。公式v8.5.0の[設定](https://github.com/su2code/SU2/blob/v8.5.0/config_template.cfg)と[COutput::ConvergenceMonitoring](https://github.com/su2code/SU2/blob/v8.5.0/SU2_CFD/src/output/COutput.cpp#L846-L927)を確認した。SU2は指定された収束fieldだけを組み合わせる。圧力しか指定しないconfigでの全基準達成は、全速度・乱流残差の達成を意味しない。今回はその圧力−10にも達しておらず、正常終了は反復上限によるもの。

前回から固定した別のQA許容は全P/U/V残差≤−6。今回これは満たしたが、−10で評価するアダプターの `numericallyConverged=false` も記録に保持した。QA単独合格とソルバー停止基準達成を区別している。

評価実装も修正した。従来は圧力列だけの履歴でも「報告された列が全て達成」として数値収束を返し得た。次元2ではP/U/V、次元3ではWも、SAではnuも必須にした。`allReportedResidualsMet` の意味を保ち、必須列欠落時は `requiredResidualsPresent=false`・`numericallyConverged=false` を返す。通常hostの固定入力制限、ソルバーconfig、既存牛の警告は変えていない。

## 証拠と再現

[事前plan](evidence/cfd-finemesh-followup-20261022/plan.json)、[実結果](evidence/cfd-finemesh-followup-20261022/run.json)、同フォルダのraw履歴・設定・入力・ログを保存した。実行時helper bytesとcanonical LF source hashを区別し、改行変換前のhelperも保持した。実行物・巨大VTUはcommitしない。focused11件、Python回帰2件が成功した。

新しい専用worktreeで `python scripts/replay-cfd-finemesh.py unique-label prepare`、plan確認後、同じlabelで `run`。新規出力は `.qa/cfd-finemesh-unique-label/` のみで、公開済み記録へ上書きしない。実行物は固定SHA、追加downloadなし。今回の再現経路確認は新labelのprepareまでで、2回目のsolverは起動していない。

残るのはメッシュ依存許容の達成、離散質量流束、host/MCP比較、牛の壁面116点未収束・速度/乱流残差・境界層・領域/精度検証。公開済み件数やCFD1のreleased状態を変更する根拠にはしない。

Python回帰2件は `python tests/replay-cfd-finemesh.test.py` と `python tests/qa-cfd-reference.test.py` の各1件を別々に実行した合計。
