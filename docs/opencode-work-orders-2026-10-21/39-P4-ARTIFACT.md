# 39 P4 — 11 PR 統合後の限定回帰

## 開始・読む順

1. [00-COMMON.md](00-COMMON.md) と [18 PRレビュー記録](../evidence/2026-10-21-opencode-pr-review.json) を読む。
2. 実行時 fetch 後、レビュー記録の approved-for-integrated-ci 11件が公開 `origin/main` に入ったことを統合PR/commit ancestryで確認し、対象 SHA を記録する。local統合branchやCI成功だけで公開済みとしない。不足なら merge/cherry-pick せず待機報告。
3. `origin/main` 起点の専用 `codex/opencode-next-39` / `D:/github/airpocket-soundman/studio-opencode-next-39` を使う。primary/thermal-compare/既存 owner worktree/UI2 の編集は禁止。
4. #144/#145 は制作中としてこの作業の対象外。未mergeの7修正PRにも依存しない。着手前に変更ファイル・追加動作・合否 test を各1行記録する。

## 今回の受入単位・読む順

保存ケースから出した成果物が、後から変わった現在入力へ取り違えられないことを1つの統合workflowで固定する。33の独立ファイルheader verifierの再実装・拡張はしない。

1. `src/case-archive-transfer.js`、`src/case-operations.js`、`tests/case-archive-transfer.test.mjs`。
2. `src/visual-export-jobs.js`、`src/comparison-export-adapter.js`、`tests/visual-export-jobs.test.mjs`。
3. `src/browser-session.js`、`tests/browser-case-archive-session.test.mjs`、`tests/browser-export-session.test.mjs`。
4. 既存 `tests/verify-export-artifact.test.mjs` は境界確認だけに読む。

## 変更範囲

主成果は新 `tests/artifact-case-workflow.test.mjs`（新規予定）とevidence。実在するsession/transfer/export job/adapterを接続し、各層を全部stubした呼出し順testにしない。
明確な統合不具合のみ上記 core を最小修正可。main/UI2、renderer全面変更、新画像decoder、33のverifier、公開形式/version/保存物理データの変更は禁止。

## 番号付き実装と受入

1. 既存fixtureから検証済み合成保存ケースAを再利用する。10×10×40 mm、E=1e9 Pa 等はfixtureの実値に合わせ、入力版A/ケースID/物理結果版を取得する。新solver実行を必須にしない。
2. session→実case archive transferでexportをページ読取→bytesを結合。offsetはbytes、各page<=65536 bytes、totalBytesとSHA256を一致させる。空case archiveだけで代用しない。
3. 現在入力だけ mesh size=4→5 mm 等に変えて版Bにする。Aのexact referenceを選ぶexportはAを示し、Bの版をAのexpectedRevisionとして渡すと拒否され、入力B/保存Aは不変。
4. 保存Aを明示選択したPNG成果物を実export job/adapter経路で取得。Nodeではrenderer最下層だけ合成bytes可と明記し、manifestのケース/結果参照・totalBytes・SHAと実bytesの完全一致をassert。本物のPNG画素を生成したとは主張しない。
5. 成果物取得の途中pageを欠落/重複/1byte改変した結合は元SHAと一致しない。case再importは既存guard/版契約を通り、誤版/改変時に既存storeへ部分適用しない。
6. release後の再取得拒否、失敗後の既存ケース/現在入力保全も同workflowで確認する。汎用コンテナheader解析は33へ残す。
7. 可能なら実ChromeでA保存→B編集→A成果物取得を1回確認。未実行はsession統合testまでと記録し、公開実測とは分ける。

## 対象試験

```powershell
node --test tests/artifact-case-workflow.test.mjs tests/case-archive-transfer.test.mjs tests/browser-export-session.test.mjs
npm run check:contracts
git diff --check
```

実APIが別revision概念を使う場合はsource定義に従い、input/physical/result/archive revisionを同一と仮定しない。意味が追えなければ値捏造せず止める。

## 検証境界・停止・納品

- 合成 fixture と実 Chrome、公開 HTTPS を分ける。Chrome 未操作なら実ブラウザ確認済みとしない。秘密/pairing code/全環境変数を出力しない。所有 tab/server/接続だけ cleanup。
- 数値不一致、非有限値、元 head 進行、知らない dirty、保存互換性破壊、権限拡張必要なら関係変更を停止して再現と判断点を報告する。試験の削除/skip/物理閾値緩和は禁止。
- `docs/evidence/<実行日>-opencode-next-39.json` に base/head・前提 SHA・コマンド・数値/units・pass/fail・未確認を sanitize 記録。失敗前後を混ぜない。自己参照 SHA は作らない。
- progress/共通 docs/Skill は編集しない。親 P4 の全完了/released を宣言せず、限定受入・残条件の更新文案を添える。
- 最終納品: 変更動作/ファイル、実行試験と実測値、未確認、証拠、commit/push先/PRまたは元PR、次レビュー箇所。自己 merge・force push は禁止。

