# 35 VIEWTIME — snapshotStorageを正式MCPと実Chromeで照合する

## 前提・読む順
1. [00-COMMON.md](00-COMMON.md)。専用treeは最新origin/mainから作る。
2. #135 head `aa242bd30dbb670ef5ee32a5020d8a2c2886fe42`がorigin/mainの祖先か確認。
3. 未統合なら待つ。#144/#145には触れない。
4. `src/result-view-api.js`、`src/time-history-plan.js`、`tests/result-view-api.test.mjs`。
5. `src/browser-operation-view-contracts.js`、`scripts/studio-mcp.mjs`の正式browser接続経路。
6. `skills/airpocket-studio/SKILL.md`、同`references/result-views.md`の実ツール手順。

## 今回の単位
既存snapshotStorageの表示結果を、localhostの正式pairing/MCP/Chromeで同一結果に照合する。
Node内部APIの単体成功を、正式MCP成功や実Chrome成功へ置き換えない。
メタデータを新しく作る機能ではない。既存getResultViewと保存履歴を使う。
公開HTTPSへ接続/解析権限を追加しない。再現は合成モデルだけ。

## 変更してよい場所
- `tests/result-view-api.test.mjs`：正式経路で見つけた差の最小回帰のみ。
- 既存browser-result-view系test/helperの実在を検索し、同等fixtureがあれば再利用。
- `docs/evidence/<実日付>-opencode-viewtime-mcp-chrome.json`と必要PNG。
- 真の不整合があれば`src/result-view-api.js`/該当contractの最小修正。
- 新tool/新metadata/solver変更、共通progress/Skill編集は対象外。

## 実行順
1. ブラウザ操作機能と正式MCP起動経路が利用可能か確認し、runtime/source SHAを固定する。
2. HMRなしlocalhostを準備し、必要最小scopeで正規pairingを行う。秘密を証拠に保存しない。
3. 合成熱ケースと過渡音響ケースを既存APIで作り、保存/表示した同一resultを選ぶ。
4. 内部API・正式MCP getResultView・Chrome表示中resultの入力版/結果版/種別をそろえる。
5. getResultViewはframeLimit:0も呼び、summaryが配列/steps/warning本文を漏らさないか確認。
6. 成功resultを保存→reloadし、同じsnapshotStorageになるか照合する。
7. snapshotInfoなし旧fixtureはsummary省略、改ざんfixtureは既存validatorの拒否を確認。
8. 変更前後のproject/result/cases/view設定を比較し、read操作で変更しない。
9. 自分のtab、接続、server、秘密入りtempだけ片付ける。

## 数値入り受入
- 熱fixture：94nodes、requested11、budget2400bytes、count3、bytes2256。
- 音響fixture：741nodes、requested7、budget65536bytes、count7、bytes41496。
- 上記値は既存合成fixtureの参照値。実meshを再生成してnodesが変わったら実値を記録する。
- 実値の場合もbytes = nodeCount × count ×8、bytes≤budget、count≥2を照合する。
- unit:byte、bytesPerScalar:8、meaning:stored-scalar-values-onlyと5つのexcludesが一致。
- frameLimit0でframes空、summaryにsteps/physical arrays/warning本文なし。
- 内部APIと正式MCPのsnapshotStorageがdeepEqual、入力版/結果版が前後一致。
- legacyはsnapshotStorage省略。bytesを8増やした改ざんは明示拒否。
- saved scalar予算をプロセス全体/peak memory上限と説明しない。

## 対象試験・停止
- `node --test tests/result-view-api.test.mjs`、追加した正式経路testのみ。
- `npm run check:contracts`、`git diff --check`。
- Chrome/MCPが利用不能なら利用可能範囲だけ記録し、この実証単位は未完として止める。
- pairingや権限を迂回しない。版不一致ならデータを混ぜず取得し直す。

## 証拠・完了
正式tool名/引数の非秘密部、Node/Chrome/runtime/source版、各経路のsummaryと実測値を保存。
自作adapterやNode-hosted semantic sessionは実Chromeとして扱わない。
2種の正式経路照合、保存互換、read不変、cleanupを確認してこの単位を完了とする。
VIEWTIME親は未完維持。通常PRで証拠と必要最小回帰をレビューへ渡す。
