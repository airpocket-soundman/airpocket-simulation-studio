# Re40円柱の固定参照検証（2026-10-22）

[English](en/cfd-reference-2026-10-22.md)

CFD1の後続02を実SU2で4条件実行した。**総合不合格**であり、CFD1と牛ケースを公開済み・精度検証済みにしない。

[Economonの一次論文](https://economon.github.io/docs/AIAA-2018-3111.pdf)（DOI 10.2514/6.2018-3111、IV.G、印刷頁19–20）の非圧縮・層流・等温円柱を選んだ。D=1m、密度1kg/m³、速度4m/s、粘度0.1Pa·s、Re=40、断熱no-slip、O-grid、成長率1.1。参照Cd=1.507は論文のSU2数値解であり、実験値や解析解ではない。Machは非圧縮モデルの入力ではない。

実行前の[固定plan](evidence/2026-10-22-cfd-reference-plan.json)で、Cd誤差5%以下、全報告残差log10≤−6、最終100反復のCd幅0.5%以下、遠方節点速度からの質量積分差0.1%以下を定めた。メッシュ・領域依存3%以下、反復予算依存1%以下も条件とした。これらは今回のQA許容値で、論文の不確かさではない。

| 条件 | 周方向数 / 外半径m / 反復上限 | 実時間秒 | 最終履歴Cd | 参照誤差 | 判定 |
|---|---|---:|---:|---:|---|
| baseline | 64 / 50.5 / 1200 | 35.828 | 1.586440610 | 5.2714% | 許容外 |
| mesh | 128 / 50.5 / 1200 | 90.219 | 1.521037509 | 0.9315% | 90秒期限で強制終了、未合格 |
| domain | 64 / 100.5 / 1200 | 45.562 | 1.580804881 | 4.8975% | この条件のみ合格 |
| iterations | 64 / 50.5 / 2400 | 23.812 | 1.586440610 | 5.2714% | 許容外 |

baseline/domain/iterationsは圧力停止条件−10で正常終了した。baselineとiterationsはどちらも履歴index820で停止し、反復上限増加は実反復増加を意味しない。時間差を性能改善とは扱わない。メッシュ変更の途中Cd差4.1226%は依存許容3%を超え、期限終了した細メッシュの収束比較も未完了。領域差0.3552%、反復予算差0%。

質量診断は遠方境界の節点速度の台形積分で、SU2内部の離散面流束検証ではない。正常終了の相対差はbaseline/iterations 0.04415%、domain 0.02137%。meshのVTUは途中checkpointの可能性があるため、最終質量収支はnullとし、観測値を別項目に残した。

[実記録](evidence/2026-10-22-cfd-reference-run.json)に実行物・plan・入力・mesh・config・履歴・出力のSHA、コマンド、RSS、停止理由、全残差、許容判定を保持した。[raw資料](evidence/cfd-reference-20261022)は履歴・設定・入力・ログ。巨大VTUと実行物はcommitしない。SU2 8.5.0実行物SHAを既存キャッシュと照合し、単一thread・各90秒・RSS1GiBで監視した。新規download、通常host/MCPの入力allowlist変更はない。

初期評価器が空白付きquoted CSVヘッダを誤読したため、solverの再実行なしでrawから再評価した。元の実行harnessはcommit `bbd0241fd62a6ec05a9eb480dff0264e552cbec7`、元SHAと修正評価器SHAを区別する。rawは`.gitattributes -text`でバイトを保持する。

再現は新しい専用worktreeを使い、PowerShellで `$env:QA_CFD_LABEL='replay-20261022-01'` と未使用labelを設定し、`python scripts/qa-cfd-reference.py prepare`、plan確認後 `run`、終了後 `assess` を実行する。3コマンドで同じQA_CFD_LABEL環境変数を保持する。全出力は `.qa/cfd-reference-<label>/` に置き、公開済みplan/recordを上書きしない。新labelによるprepareのみを試し、追加solver実行はしていない。歴史記録へのlabelなしassessには元のignored QA成果物（VTU含む）が必要で、commit済みのraw資料だけでは全出力SHAを再照合できない。SU2_EXEは固定SHAに一致するローカル実行物のみ指定できる。Python psutil、Nodeとlocked npm依存が必要。既存QA出力は上書きしない。既存5群のfocused試験10件とCSV回帰試験1件が成功した。モック試験を実SU2精度証拠にはしない。

残作業は細メッシュの別途事前固定した予算での完走、より細かいメッシュでの収束、離散質量流束、参照のhost/MCP比較。牛の壁面116点未収束、速度・乱流残差未達、境界層・領域・精度検証はそのまま残る。
