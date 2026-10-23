# 未完検証の実行結果（2026-10-23）

[English](en/verification-completion-2026-10-23.md) / [全数棚卸し](verification-inventory-2026-10-23.md)

既存機能の検証を並列で実行し、取得不能の説明不足と未対応入力の黙殺を修正した。未実装機能・実測校正・認証・未配信候補は成功扱いにしない。進捗原本の37未完IDは維持する。

## 再起動と曲線出力

正式stdio MCPの成功→停止→再起動→復元発見→再要求を再実行。復元はmetadata-onlyであり、結果・中間成果物は保持されない。従来の空artifact一覧には、その理由と次の手順を示すrecoveryを追加した。個別取得は安定コード `ANALYSIS_JOB_ARTIFACT_NOT_RESTORED` と、新requestId・明示入力/出力パスによる再実行手順を返す。既存結果を上書きせず、同一/異条件requestId拒否とrelease後再利用を確認した。

関連24試験中23成功、失敗0。Windowsでsymlink作成権限がなく既存1試験がskip。これは取得不能機能をskipしたものではない。保存済み結果の完全自動復元は新設していない。

曲線UIは、古いファイルの成功/失敗が新しい選択・検証結果・リンクを上書きしない回帰と、読込中破棄で成果物を再生成しない回帰を追加。DOM fixtureが生成した実BlobのCSV/JSON/SVG全bytesとSHA-256を、別の正式stdio MCPプロセスが出力した同じA/B入力の成果物と比較した。関連23試験が全成功。実Chromeダウンロードの証拠とは区別する。

## 実画面・公開の制約

Chromeでlocalhostの対象画面と段階グラフ欄を開いたが、file chooserの通知待ちと、その後のDOM操作のRuntime.evaluate応答待ちが期限切れになった。この回では新しい成功図・取得ファイルを得ていない。前回のJA/EN/キーボード/inline表示の証拠は維持するが、390px・Blob保存全bytes・拡大タブ・実録画失効・第2browser・実画面の入力版不変は未確認。禁止されたBlob URLへの別経路アクセスは試していない。所有開発サーバーは停止した。

公開検査は実行したが、公開manifestはmain `fe98ca3e60b4f5dfd65c02f00b33b0f76059e9cb` を返し、作業候補とは異なるため「未配信」で停止した。ローカルビルド/CIと公開合格は別であり、候補の未マージ・未配信を検証成功へ読み替えない。

## 他担当の検証

容量/型/独立数値の追加結果は[棚卸し](verification-inventory-2026-10-23.md)を参照。

- [Windows全件](evidence/2026-10-23-windows-v8-validation-report.md): 基点5647a6fで1,896件中1,889成功、失敗0、既存skip7。以前fatalが出たfixed-frameは追加5回、各17件成功。今回未再現であり原因解消は未確定。
- [数値監査](numeric-audit-60-66-2026-10-23.md): CFDの反復不足を切り分け、格子差4.1226447%は3%許容を超える未達として確定。現行WASMの準備済みTet4±75/0 Nを検証。熱の別分割節点積分と未対応二次項拒否を補完。
- [録画失効の統合証拠](evidence/2026-10-23-export-expiry-integration.json): 日英×visible/模擬hiddenの4条件。通常pollの401から所有録画取消・部分成果物拒否・新接続での成功まで本番分岐を接続し、track/lock/timer解放を確認。実Chrome/実hidden/実認証失効とは区別。
- [独立Skill一巡](evidence/2026-10-23-skill70-independent-loop-report.md): 最終recipeだけを読む別担当が新stdio processでdiscovery/paging/3形式全bytes/hash/CSV・SVG/改ざん・上書き拒否/原文不変/EOF終了を再現。途中の手順修正なし。統合後も専用scriptを新processで再実行し成功。

最終統合後、これらの関連35試験は全成功。独立レビューでも追加18試験が全成功し重大欠陥の指摘なし。最終CI、配信一致、一般物理精度は個々の限定試験から推定しない。[集約証拠](evidence/2026-10-23-verification-completion.json)はソースとログのhashを保持する。

アプリ変更統合head686e019でビルドとローカル公開相当27項目が成功（51.46秒）。その後の追加は独立再現scriptと証拠・文書であり、最終headの全体CI結果はPRに記録する。公開manifest不一致を回避するための検査省略・閾値変更・マージはしていない。
