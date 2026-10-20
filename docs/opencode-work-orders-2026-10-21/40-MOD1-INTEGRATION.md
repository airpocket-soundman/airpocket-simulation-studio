# 40 MOD1 — 11 PR 統合後の限定回帰

## 開始・読む順

1. [00-COMMON.md](00-COMMON.md) と [18 PRレビュー記録](../evidence/2026-10-21-opencode-pr-review.json) を読む。
2. 実行時 fetch 後、レビュー記録の approved-for-integrated-ci 11件が公開 `origin/main` に入ったことを統合PR/commit ancestryで確認し、対象 SHA を記録する。local統合branchやCI成功だけで公開済みとしない。不足なら merge/cherry-pick せず待機報告。
3. `origin/main` 起点の専用 `codex/opencode-next-40` / `D:/github/airpocket-soundman/studio-opencode-next-40` を使う。primary/thermal-compare/既存 owner worktree/UI2 の編集は禁止。
4. #144/#145 は制作中としてこの作業の対象外。未mergeの7修正PRにも依存しない。着手前に変更ファイル・追加動作・合否 test を各1行記録する。

## 今回の受入単位・読む順

利用者が保存ケースを表示→画像出力開始→接続取消→再接続で再出力する1workflowを統合test化する。module境界チェックの羅列だけでは完了しない。

1. `src/browser-session.js`、`src/browser-operation-names.js`、`src/browser-operation-contracts.js`。
2. `src/visual-export-jobs.js`、`src/browser-operation-view-contracts.js`、`src/browser-operation-archive-contracts.js`。
3. `tests/browser-export-session.test.mjs`、`tests/browser-case-archive-session.test.mjs`、`tests/visual-export-jobs.test.mjs`。
4. `src/module-layers.json`、`scripts/check-module-boundaries.mjs`、`tests/module-boundaries.test.mjs`。

## 変更範囲

主成果は新 `tests/browser-export-workflow.test.mjs`（新規予定）、evidence。必要時のみsession/job間の小さなguard修正。
scope契約は既存宣言をassertする。認証enforcerは実在経路を確認して使い、session単体に認証責務があると仮定しない。
main/UI2/physics/新tool/public scope拡大、module層allowlist緩和、新大規模framework、未mergePR取り込みは禁止。

## 番号付き実装と受入

1. 既存合成ケース/結果fixtureからcaseViewを呼び、同じsessionでstartExportする。caseViewはedit、startExportはview、exportArtifactはinspectという実宣言を照合する。異なる現行定義ならその根拠で仕様を確認する。
2. 実sessionと実export job managerを接続し、rendererだけ制御可能な非同期待機にする。開始直後はまだ描画commitしていない状態でdisconnectする。
3. 切断後に待機を解放しても旧guardがfalseで、成果物をcompleted/取得可能にしない。取消または拒否の終端をassertし、case/現在入力/既存表示状態を保持する。
4. 3秒の実sleepではなく制御promise等で確定順序を作る。取消対象は所有sessionのjobだけ。別sessionで先に完了した成果物まで消えないことを確認する。
5. 新sessionで同じケースを選んで再出力を開始し、今回はrendererを正常完了させる。1回だけ完了・取得でき、旧jobと異なるjobIDで旧guardを再利用しないことをassertする。
6. 最小scope不足の拒否は実enforcerで確認できる場合だけ実行。少なくとも宣言/公開catalog/session routingの一致をtestし、正規pairingのscope拒否は実Chrome未実証なら明記する。
7. 新testが取り込んだsrcの依存が既存module層を越えないことをcheckerで確認。修正に新moduleが必要なら正しい層へ登録し、allowlistで通すだけの変更は禁止。
8. Chromeで実行した場合だけ版・取消の終端・再接続成功を証拠化。Node制御rendererは実ブラウザ画像/取消保証ではない。

## 対象試験

```powershell
node --test tests/browser-export-workflow.test.mjs tests/browser-export-session.test.mjs tests/visual-export-jobs.test.mjs
node scripts/check-module-boundaries.mjs
npm run check:contracts
git diff --check
```

caseViewを含む実workflowの成功/取消/再試行が主受入。既存testを実行した一覧だけ、新しい各関数の単体testだけでは完了にしない。

## 検証境界・停止・納品

- 合成 fixture と実 Chrome、公開 HTTPS を分ける。Chrome 未操作なら実ブラウザ確認済みとしない。秘密/pairing code/全環境変数を出力しない。所有 tab/server/接続だけ cleanup。
- 数値不一致、非有限値、元 head 進行、知らない dirty、保存互換性破壊、権限拡張必要なら関係変更を停止して再現と判断点を報告する。試験の削除/skip/物理閾値緩和は禁止。
- `docs/evidence/<実行日>-opencode-next-40.json` に base/head・前提 SHA・コマンド・数値/units・pass/fail・未確認を sanitize 記録。失敗前後を混ぜない。自己参照 SHA は作らない。
- progress/共通 docs/Skill は編集しない。親 MOD1 の全完了/released を宣言せず、限定受入・残条件の更新文案を添える。
- 最終納品: 変更動作/ファイル、実行試験と実測値、未確認、証拠、commit/push先/PRまたは元PR、次レビュー箇所。自己 merge・force push は禁止。

