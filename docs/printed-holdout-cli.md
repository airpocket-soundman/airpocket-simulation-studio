# 保存ファイルから別試験片の予測を比較する

[English](en/printed-holdout-cli.md)

`node scripts/compare-printed-holdout.mjs --request <絶対パス.json> --output <新規の絶対パス.json>`

これは読取専用の保存ファイル入口です。学習側だけで係数を同定し、既存の [holdout契約](printed-parameter-holdout.md) に従って明示した別試験片へ予測します。結果を材料・解析入力へ適用しません。比較成功は精度の合格ではなく、誤差を計算できたことです。`calibrated`、`accuracyVerified`、`physicalIndependenceVerified` は常にfalseです。

要求JSONは `schemaVersion:1`、`training:{path,expectedSHA256}`、`validation:{path,expectedSHA256}`、`options`、`specimenPairs:[{trainingSpecimenId,validationSpecimenId}]` の5項目だけを持ちます。pathは絶対パス、expectedSHA256は元JSONのバイト列を表す小文字64桁SHA-256です。optionsは既存同定の全必須条件を明示します。試験片の完全な1対1対応、分離したdataset/specimen ID、記録条件の一致、非外挿の制約を継承します。校正・物理的独立性をファイル名から推定しません。

最大要求64KiB、各dataset2,000,000bytes、100対応・合計10,000samples、出力4MiBです。要求の重複キー（Unicodeエスケープを復号した後も）、UTF-8不正、BOM、過深・過大な構造を拒否します。原文2ファイルを有界FDスナップショットで読み、両方のSHAを照合してから比較します。リンク/ジャンクション経由の入力、同一inodeの再利用、入力・要求・出力の別名を拒否します。

出力は原文SHAとサイズ、既存pure結果、または数値を捏造しない拒否記録を含みます。Pa単位の残差は予測−観測です。既存出力は上書きせず、同時実行も1プロセスだけが完全な成果物を出版できます。終了コードは比較0、拒否成果物2、引数・経路・入出力エラー1。stdoutは小さいJSON要約で、元曲線や内部例外stackを含みません。

実測の校正、実試験片の独立性、材料精度の保証、GUI/MCP入口、一般の繰返し履歴はこの入口の完成範囲外です。

## MCP入口

ローカルstdioの `studio_compare_printed_holdout({request,output})` も同じサービスを使い、原文を含まない要約と保存成果物のSHAを返します。`studio_capabilities` の `printedHoldout` でNode対象の入口と上限を確認できます。新規ファイルを書き出すためreadOnly/idempotentではありません。ブラウザの材料・入力・接続権限は変更しません。これはリポジトリのstdio経路であり、インストール済みクライアントへの自動登録を意味しません。
