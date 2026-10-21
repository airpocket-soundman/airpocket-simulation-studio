# 49 VIEWTIME — 保存履歴を実Chromeと正式MCPで照合する

今回PRの限定成果は採用対象。以下は未検証QAだけを行う追加指示で、親タスク全体の完了を意味しない。

元指示: `../opencode-work-orders-2026-10-21/35-VIEWTIME.md`。summary契約の実装は取り込み済み。実保存/reload経路の証拠を埋める。

## 読むファイルと試験
- `src/result-view-api.js`、`src/time-history-plan.js`、`tests/result-view-api.test.mjs`、`tests/thermal-snapshots.test.mjs`、`docs/automation.md`。
- `node --test tests/result-view-api.test.mjs tests/time-history-plan.test.mjs tests/thermal-snapshots.test.mjs`

## 実施と数値入り受入
1. source凍結のbranded Chromeと正規MCPで合成熱ケース/過渡音響ケースを実計算し、入力/結果版を保存する。
2. 内部API、正式MCP getResultView、実Chrome表示で同じ保存resultを選び、snapshotStorageをdeepEqual比較する。
3. nodeCountは座標配列長をそのまま使わず`nodes.length/3`で確認する。参照fixtureは熱94nodes/request11/budget2400/count3/bytes2256、音響741nodes/request7/budget65536/count7/bytes41496。
4. 実メッシュのnodeCountが違えば実値で`bytes=nodeCount*count*8`、bytes≤budget、count≥2を検査する。参照値へ合わせるためメッシュや結果を改ざんしない。
5. 保存→reload後に同じ履歴summaryと入力/結果識別へ戻ることを確認する。browser再起動と同じものとして扱わない。
6. frameLimit:0でもsummaryは得られ、frames空、steps/物理配列/warning本文をsummaryへ漏らさないことを確認する。
7. snapshotInfoなし旧fixtureのsummary省略と改ざん拒否は既存validatorを使う。読取前後のinput/result/cases/viewが不変であることを比較する。
8. bytesPerScalar8、stored-scalar-values-only、excludes5項目を実データで照合。総RAMの保証にしない。
9. MCP応答/実表示のsanitize原本、保存入力digest、reload手順、秘密なし再実行QAを保持する。

## 共通条件
- [00-COMMON.md](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/main/docs/opencode-review-followups-2026-10-21/00-COMMON.md)と元指示を読む。最新origin/mainから専用branch/worktreeを作り、主作業フォルダと他担当を変更しない。
- 今回の取り込みは限定実装の受入。親タスクは未完了。既存修正の再実装はせず、実不具合があれば再現を保存し最小修正/回帰試験だけを別途提案する。
- 正式API/MCPと正規pairingを使い、権限を増やさない。合成モデルのみ。sourceを凍結しHMR resetを混ぜない。
- 原データまたは秘密なし再実行QAスクリプトを保持する。JSONにsourceSHA・Chrome版・origin・実行コマンド・結果版・pass/fail/未実行を記録する。
- 自分のprobe/接続/serverだけcleanup。token/接続code/全環境変数を保存しない。自己merge・force push・progress変更は禁止。
- 検証できない条件は未確認のまま残し、証拠と残条件をPRへ。実行不能を成功や物理精度の保証に置き換えない。
