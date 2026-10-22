# 02 CFD1 — 固定参照ケースの実SU2検証

状態: 実SU2の4条件を実行済み、総合不合格。実結果は [検証記録](../cfd-reference-2026-10-22.md) と [raw評価](../evidence/2026-10-22-cfd-reference-run.json)。基準誤差5.2714%、細mesh90秒期限のため未完を維持。次は細mesh完走・収束性と離散流束の確認。既存41-CFD1の後続。#172〜#175と重複しない。

1. `docs/opencode-release-work-orders-2026-10-21/41-CFD1.md`、`docs/su2-native.md`、`scripts/su2-native.mjs`、`scripts/native-flow-host.mjs`を読む。41の作業場所の古い指定は使わず `D:/worktrees/studio-cfd-reference-20261022` に専用treeを作る。
2. 既存牛ケースの設定・残差・未達警告を保存する。対応できる公開参照問題を公式一次資料から1件選び、問題のURL、適用Re/Mach、形状、境界条件、許容差、反復/時間/メモリ上限を実行前のJSONへ固定する。
3. 固定入力のallowlistを維持し任意コマンド実行へ拡張しない。参照値や計測が存在しない場合は実行前に未実施を記録する。
4. 実SU2の版・実行物SHA・入力/mesh/sourceSHA・コマンド・時間・停止理由・残差・抗力・質量収支を記録する。領域距離/mesh/反復予算を各1段変え、数値の依存性を比較する。
5. `node --test tests/su2-native.test.mjs tests/su2-vtu.test.mjs tests/native-flow-host.test.mjs tests/native-flow-mcp.test.mjs tests/native-flow-comparison.test.mjs`。mock結果と実SU2結果を分離する。
6. 未収束を成功に変換しない。牛の壁面116点などの未達は残す。固定参照成功だけでCFD1全体をreleasedにしない。

出口: 再実行可能な小fixture、実結果JSON、日英の許容値比較、focused試験をコミットし最終レビューへ渡す。外部実行不能の場合、理由と未実行条件を具体化して停止する。
