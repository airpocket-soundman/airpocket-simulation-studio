# 次の実行指示 — 2026-10-22

既存PR #172〜#175のレビューと並行する後続3件。親タスクの受入条件を縮小しない。作業フォルダは `D:/worktrees` またはCodex管理worktreeへ置き、`D:/github/airpocket-soundman` はリポジトリ用に保つ。主リポジトリの既存変更を編集・stash・resetしない。

| 指示 | 親 | 現在の状態 | 残条件 |
|---|---|---|---|
| [01](01-P6-MOMENT.md) | P6 | 公開済み・実host/WASM 14件成功 | CAD転送・製品backend。親はbuilding |
| [02](02-CFD1-REFERENCE.md) | CFD1 | 細meshも完走、単独QA達成・依存性未達 | メッシュ収束/離散質量流束・host/MCP統合 |
| [03](03-PERF1-SCALE.md) | PERF1 | 実Chrome2規模を計測しprobe欠陥も修正 | 最大規模・他ブラウザ。実結果は [計測資料](../perf-scale-2026-10-22.md) |

指示書だけで完了としない。実行結果、失敗、未実施を分け、レビュー→CI→merge→配信SHA照合まで統合担当が行う。実Chromeを使う計測は同時実行せず、合成モデルだけを使う。実測が必要なPRINT2/PRINTMEASURE、この3件とは別のEXPORTBACKGROUND1のsession失効・日英実機マトリクスは完了扱いにしない。#175の実hidden観測と未達条件を区別する。
