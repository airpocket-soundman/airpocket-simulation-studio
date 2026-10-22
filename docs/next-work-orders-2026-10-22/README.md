# 次の実行指示 — 2026-10-22

既存PR #172〜#175のレビューと並行する後続3件。親タスクの受入条件を縮小しない。作業フォルダは `D:/worktrees` またはCodex管理worktreeへ置き、`D:/github/airpocket-soundman` はリポジトリ用に保つ。主リポジトリの既存変更を編集・stash・resetしない。

| 指示 | 親 | 現在の状態 | 残条件 |
|---|---|---|---|
| [01](01-P6-MOMENT.md) | P6 | 実装・focused試験済み、最終レビュー待ち | 新契約で必須CIの実host/WASMを通す。親はbuilding |
| [02](02-CFD1-REFERENCE.md) | CFD1 | 実SU2の4条件を実行、総合不合格として証拠化 | 細mesh完走・収束/離散質量流束・host/MCP統合 |
| [03](03-PERF1-SCALE.md) | PERF1 | 未実行 | #174の1ケースに続く独立した規模比較 |

指示書だけで完了としない。実行結果、失敗、未実施を分け、レビュー→CI→merge→配信SHA照合まで統合担当が行う。実Chromeを使う計測は同時実行せず、合成モデルだけを使う。実測が必要なPRINT2/PRINTMEASURE、この3件とは別のEXPORTBACKGROUND1のsession失効・日英実機マトリクスは完了扱いにしない。#175の実hidden観測と未達条件を区別する。
