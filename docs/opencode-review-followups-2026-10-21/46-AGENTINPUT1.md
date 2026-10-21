# 46 AGENTINPUT1 — 実Chromeで3成分の案内を確認する

今回PRの限定成果は採用対象。以下は未検証QAだけを行う追加指示で、親タスク全体の完了を意味しない。

元指示: `../opencode-work-orders-2026-10-21/22-AGENTINPUT1.md`。取り込み済みexact pointer mappingの実ブラウザ受入だけを行う。

## 読むファイルと試験
- `src/ui/analysis-preflight-ui.js`、`src/ui/material-form-ui.js`、`src/preflight-unit-magnitude.js`。
- `node --test tests/preflight-unit-magnitude.test.mjs tests/ui-analysis-preflight.test.mjs tests/ui-material-form.test.mjs`

## 実施と数値入り受入
1. branded Google Chromeの390 CSS pxで正規APIから合成直交異方性入力を設定する。Young成分=[210,220,230] Pa。ほかの定数/軸はfixtureと単位を明記する。
2. 正式preflightで3警告のpointer末尾0/1/2とPa値を確認する。不正材料等の併存拒否は隠さない。
3. 3ボタンを順にTab→Enterし、各1回だけ`document.activeElement.id === 'material-status'`となることを記録する。閉じた親detailsが開き、focusが見えることも確認する。
4. 「専用編集欄は未実装、API/保存入力で該当indexを確認」という案内を日英それぞれ新規checkで読む。等方E欄/依存JSONへ誘導されない。
5. ボタン前後の3値・入力版・条件数・保存入力digestが不変であることを比較する。編集GUIの完成とは呼ばない。
6. 入力変更で古い案内が無効になり、再check後のみ有効になることを確認する。未知index3、disabled/hiddenの拒否は既存試験と実確認を区別する。
7. [1e9,2e9,3e9] Paへ正規APIで変更し、この単位警告が0件になることを確認する。閾値/単位換算は変更しない。
8. 390pxの幅、focus画像、activeElement/入力版の読み取り結果、実行手順を保存する。

## 共通条件
- [00-COMMON.md](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/main/docs/opencode-review-followups-2026-10-21/00-COMMON.md)と元指示を読む。最新origin/mainから専用branch/worktreeを作り、主作業フォルダと他担当を変更しない。
- 今回の取り込みは限定実装の受入。親タスクは未完了。既存修正の再実装はせず、実不具合があれば再現を保存し最小修正/回帰試験だけを別途提案する。
- 正式API/MCPと正規pairingを使い、権限を増やさない。合成モデルのみ。sourceを凍結しHMR resetを混ぜない。
- 原データまたは秘密なし再実行QAスクリプトを保持する。JSONにsourceSHA・Chrome版・origin・実行コマンド・結果版・pass/fail/未実行を記録する。
- 自分のprobe/接続/serverだけcleanup。token/接続code/全環境変数を保存しない。自己merge・force push・progress変更は禁止。
- 検証できない条件は未確認のまま残し、証拠と残条件をPRへ。実行不能を成功や物理精度の保証に置き換えない。
