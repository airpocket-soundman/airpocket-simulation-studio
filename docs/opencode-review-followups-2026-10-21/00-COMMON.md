# 追加レビュー後の共通QA手順

今回の11 PRは限定成果として採用する。ここにある6件は未実施QAを完了する指示であり、既存コードの再実装や親タスクの完了宣言ではない。

1. 最新origin/main、HEAD、status、担当IDの既存受入条件を確認する。元PRがmainに入るまで実行を待つ。完了済みの9修正や今回11成果を作り直さない。
2. `D:/github/airpocket-soundman/airpocket-simulation-studio` の利用者変更5ファイルと、thermal-compare/他担当worktreeを編集・reset・stash・cleanしない。
3. 最新mainから `D:/worktrees/studio-review-ID` の専用worktreeとbranchを作る。同名既存を上書きしない。元PRがmergedなら新規QA PRを作る。
4. 個別指示1件のsource/testだけを読む。既存API/MCP・通常のブラウザ操作を使い、DOMから隠れたapp状態を直接改変する検証に置き換えない。
5. Chromeブランド/実版とElectron/Chromiumを区別する。sourceを固定し、検証中のHMR更新を避ける。390px確認後はviewportを戻す。
6. 合成モデルだけを使い、数値・根拠・境界条件をfixtureに明示する。実在モデル、接続code、token、全環境変数を証拠へ入れない。権限を自動拡張しない。
7. GUIのdisabled/hiddenは仕様に従う。非対応操作を有効化して通さず、APIの診断とGUIで可能な操作を別々に記録する。
8. 元データまたは秘密を含まない再実行スクリプトを保持する。PNG/GIFは実decodeとframe内容、メッシュはxyz配列長/3と場の長さを照合する。自己申告の件数だけで合格にしない。
9. focused試験と `npm run check:contracts`、`git diff --check` を使う。実機で再現した不具合だけを回帰試験付きで最小修正する。skip/許容値拡大/CI変更で通さない。
10. 実行日時、source/input/result/artifact SHA、ブラウザ版、コマンド、数値/単位、pass/fail/未実行を短いJSONへ記録する。実測・Node試験・模擬・公開HTTPSを分ける。
11. 自分が作成したprobe timer、接続、process/server、tabだけを終了し、その確認を証拠に残す。他担当のChrome/処理を止めない。
12. commit/pushしてPRを提出する。既存実装、今回QA、残条件を分け、自己merge/force push/親のreleased変更をしない。独立レビュー・必須CI・通常merge・公開照合を担当者へ引き渡す。

2026-10-22: GitHub所有者フォルダは実リポジトリ専用。作業用worktreeは `D:/worktrees` またはCodex管理フォルダへ配置する。
