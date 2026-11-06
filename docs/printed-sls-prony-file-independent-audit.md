[English](en/printed-sls-prony-file-independent-audit.md)

# SLS→Prony保存入口の独立監査（2026-11-07）

固定source `56a266e` と隔離修正 `11bba8c` を監査し、追加の必須不具合は見つかりませんでした。製品sourceは編集していません。[証拠](evidence/2026-11-07-printed-sls-prony-file-independent/report.json) に固定sourceと実行ログを保存します。

新規4群は次を確認します。実Worker fixtureがstdout/stderrへ別々に書いても親の報告は単一JSONのままで、typed拒否・実exit・両stream閉鎖後に結果nullとなります。これはテストchildだけのWorker置換であり製品にworker注入入口はありません。atomic link後の取消では完成成果物を保持してlate flagを返します。意味が変わらないconfig末尾改行も原文SHA不一致となりworkerを開始しません。異なる2configの同時CLIでは一方だけが出版し、勝者のconfig・validation SHAと最終bytes SHAが一致し、一時ファイルは残りません。正常summaryの最大残差は有限値です。

最初の取消harnessはWindowsの正規化前pathと出版先を比較していたため、意図した取消を発火させず1件失敗しました。実parent realpathに基づく出版先へharnessだけ訂正し、歴史ログを保持しています。製品閾値や取消処理は変更していません。

synthetic/provisional/uncalibratedの材料点整合試験のみです。実測精度・物理独立性・構造解析・GUI・solver接続は主張しません。新featureや進捗変更はありません。
