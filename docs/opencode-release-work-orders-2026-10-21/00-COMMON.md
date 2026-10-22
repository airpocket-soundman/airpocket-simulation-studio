# 公開完了までの共通指示

このセットは既存21〜40に含まれない着手済みタスクの残作業を扱う。今回の番号1件だけ担当し、親の完了条件を縮めない。

1. 最新origin/main、branch、HEAD、未コミット変更、AGENTS.mdを確認する。
2. `D:/github/airpocket-soundman/airpocket-simulation-studio` は利用者の未コミット5ファイルを含む保全場所。checkout/pull/reset/stash/clean/上書きをしない。
3. `C:/Users/yamashita_y00031/.codex/worktrees/thermal-compare/airpocket-simulation-studio` と他の `studio-opencode-*` は別担当の作業場所。編集・ブランチ変更しない。
4. `D:/worktrees/studio-release-ID` の新しい専用worktreeをorigin/mainから作る。同名既存を上書きしない。共有node_modulesやcacheを削除しない。
5. `src/progress.json` の担当IDのacceptanceと個別指示を読む。着手前に「変更ファイル・最初の成果・親完了までの残条件・合否試験」を記録する。
6. 指示の最初の小さいPRは中間成果。受入条件を項目ごとに実装/試験/証拠/未達へ対応付け、その後も実装可能な残条件へ進む。外部条件だけは具体的に停止理由を残す。
7. 他の20件と同じ機能を重複実装しない。共有schema・main.js・UIを同時に変更する場合は調整し、専用worktreeで差分を分離する。
8. 実測・実ソルバー・実native・実Chrome・モックを区別する。仮定の数値を実測と呼ばない。物理的妥当性、収束、実装一致を別々に判定する。
9. focused試験、`npm run check:contracts`、`git diff --check` を実行。意味のある反例を残し、skip/許容値拡大/CI無効化で通さない。新srcモジュールはmodule-layers登録も行う。
10. 大きな環境や全体suiteを無用に再取得・反復しない。既存の固定版cacheとrequired CIを使う。試験が失敗したら原因へ直結する修正を行う。
11. JSON証拠にsource/input/result識別、環境、実行コマンド、合否/許容値、未実行を保存する。token/接続コード/全環境変数/実在モデルを公開しない。
12. docs直下の新しい仕様には英語対と相互リンクを付ける。履歴を消さず、現在の結果を日付付きで追記する。
13. commit/pushしてPRを作る。PRには完了した受入項目・残条件・実行した試験・証拠リンクを記載する。既存PRを更新する場合は通常pushで、force push/重複PR/自己mergeをしない。
14. progress.jsonのreleased、最終公開成功の記録は独立レビュー担当が確認して更新する。実装者は中間成功だけで親を完了にしない。

最終レビューへ渡すものは「全受入項目の判定表、再実行可能なfixture、PR、短い証拠JSON、外部待ち一覧」。レビュー担当が必須CI・通常merge・公開manifest/進捗の同一SHAを確認して公開完了とする。

2026-10-22: GitHub所有者フォルダは実リポジトリ専用。作業用worktreeは `D:/worktrees` またはCodex管理フォルダへ配置する。
