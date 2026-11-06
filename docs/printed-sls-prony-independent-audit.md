[English](en/printed-sls-prony-independent-audit.md)

# SLS→Prony独立監査（2026-11-07）

固定stage `9569625` の純粋往復APIを独立監査し、必須欠陥は見つかりませんでした。source変更はありません。新しい4回帰を含む関連27件が成功、型43宣言も成功しました。証拠は [report.json](evidence/2026-11-07-printed-sls-prony-independent/report.json) です。

参照解は本体の材料点moduleを呼びません。体積弾性率KとYoung緩和則から、μ=3KE/(9K−E)、τμ=τE(3K+μ∞)/(3K+μ0)を独立導出します。横応力ゼロを消去して q=E11−E22=A E11+B w、w′=(q−w)/τμ とし、各区間のlinear-Green-strain制約を解析積分したscalar recurrenceから全41行のS/P/Cauchy応力・横ひずみ・蓄積エネルギーを検算します。

連続時間の有限ランプSLS閉式との最大誤差は、保持刻み0.5/0.25/0.125秒で17.54361597/4.38126303/1.09502535Paでした。これは離散保持更新の二次収束を確認するもので、有限ひずみでの理想ステップ完全再現ではありません。検証側応力+123.5Paでtraining同定・Prony曲線は不変、signed biasだけ−123.5Paとなります。

二回目のhash準備中に取消しても、保有する実awaitが解決するまで外側Promiseがsettleせず、完了結果を返さないことを確認しました。同期材料点loopを割り込んで停止できるとの主張はありません。synthetic/provisional/uncalibrated、物理的独立性未証明・accuracy未検証の限定を維持します。実測・構造解析・GUI・外部solverは実行しません。
