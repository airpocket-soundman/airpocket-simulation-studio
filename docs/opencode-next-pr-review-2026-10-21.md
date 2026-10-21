# 追加11 PRのレビュー（2026-10-21）

[English](en/opencode-next-pr-review-2026-10-21.md)

PR150〜157・159〜161の11件を固定headで独立レビューし、限定成果として統合対象にした。[固定head・判定・検証](evidence/2026-10-21-next-pr-review.json)。親タスク全体の完了は別判定で、171件/公開134件/未完37件を維持する。

- #150/#151/#152/#153/#155: helper・単位metadata・既存入力案内・artifact構造検査の限定変更を採用。
- #154: Infinity同士の比較で誤成功する不具合を統合側で修正。34項目×7種の不正値を拒否し、別担当が修正を再レビュー。
- #156: locale切替の診断破棄は既存の明示仕様。identity異常という推測を未証明と注記。実Chrome390pxでrequiredPointers→Tab/Enter→材料欄、入力原本不変、stale破棄と日英再チェックを追加確認。
- #157/#159/#160/#161: Electron/ChromiumとMCPの限定観測として採用。正式Chrome・再decodeできる原成果物・cleanup記録は未完を維持。
- #159/#161: 513座標値=171節点、2223座標値=741節点へ訂正。raw値は残し、架空の場との不一致説明を除去。

統合変更の対象試験100件成功。元PRの個別試験と実Chrome観測はJSONで分離した。全体CI・通常merge・公開照合は最終公開記録で判定する。

残QA6件は[46〜51の追加指示](opencode-review-followups-2026-10-21/README.md)。既存26指示の「非対応GUIでcheckboxへ移動」はdisabled仕様と矛盾するため、安全な拒否と対応設定のfocusを分けるよう訂正した。QAのため非対応操作を有効化しない。
