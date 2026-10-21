# 追加11 PRのレビュー後：残るQA 6件

2026-10-21。[レビュー判定](../evidence/2026-10-21-next-pr-review.json)。11 PRは限定的な実装・観測記録として採用し、親タスク171件中134公開/37未完は維持する。

統合側で壁層品質の非有限値拒否と、節点数/言語切替の証拠を訂正。UIIMPROVE1のrequiredPointers案内は実Chrome390pxでTab/Enter、入力不変、stale破棄、日英再チェックを追加確認した。

| 指示 | 対象PR | まだ必要なこと |
|---|---|---|
| [46 AGENTINPUT1](46-AGENTINPUT1.md) | #152 | 実Chrome/APIの直交異方性3成分・日英focus |
| [47 P0](47-P0.md) | #153 | APIの非対応adaptive診断とGUIの安全な拒否を分離確認 |
| [48 PERF1](48-PERF1.md) | #157 | 実Chromeで系列分離計測・原資料・cleanup |
| [49 VIEWTIME](49-VIEWTIME.md) | #159 | thermal/acousticの正式MCP・実Chrome保存/reload再現資料 |
| [50 BROWSEREXPORT1](50-BROWSEREXPORT1.md) | #160 | 実Chromeの3 PNG原成果物・decode・状態復元 |
| [51 VIEWCOMPARE](51-VIEWCOMPARE.md) | #161 | 実Chromeの音響GIF原成果物・frame/delay・状態保持 |

## 渡す文

> `00-COMMON.md` と `46-AGENTINPUT1.md` を読み、46だけ実行してください。元PRが取り込まれた最新mainから専用worktreeを作り、既存コードの再実装はせず、未確認の実Chrome/API確認と再実行できる証拠を作ってPRを提出してください。自分でmergeや親タスク完了への変更はしないでください。

ブラウザ/probe/重い解析を使うQAは同時実行しない。コード・fixture整理は別worktreeで並行可能。今回の6件は既存41〜45の別タスク指示とは重複しない。
