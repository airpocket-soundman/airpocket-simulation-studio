# 83 UIIMPROVE1 — 直近の表示を保持する診断履歴（改善案3の第1段）

## 開始条件

共通指示 `docs/opencode-work-orders-2026-10-23/00-COMMON.md`（primary checkout、読み取り専用）を先に読む。基準main `81b7de4`。この1作業だけを実行し、親UIIMPROVE1「CAEのUI研究に基づいて操作画面を改良」の完成とは区別する。並行するAGENTCHAT1のmain.js接続・VIEWCOMPARE・VIEWTIMEが右列パネルを触るため、本作業はビューポート上の状態表示（`.overlay`）だけを対象とし、それらのパネル・API・MCPを変更しない。

## 前提と読む順

1. `src/progress.json` の `UIIMPROVE1`（受入: 前後比較、日英、狭い画面、キーボード、保存復元の回帰）
2. `docs/ui-research.md` 改善案3「診断の定位置表示と読み上げ対応」（工数S）。案2（`src/ui/analysis-preflight-ui.js`）は実装済み、案1/4〜9は未着手
3. `src/ui/status-ui.js`, `tests/ui-status.test.mjs`（単一行`#status`は上書きで直前の失敗が消える）

## 実装・検証手順

1. `createStatusUi` に直近の表示履歴を持たせる。新しい順、上限6件、同文の連続は `(×n)` に畳む。`#status`（`role="status"`）は互換のため従来どおり最新1件を表示する。
2. `STATUS_LABELS` のうち材料範囲・拘束不足等の9件を `STATUS_WARNINGS` とし、履歴で「要確認」と色で区別する。未知の文言は重要度を推定しない。
3. `src/main.js` の `#status` 直後に `<details id="diagnostics">`（`#diagnostics-count`、`#diagnostics-list`）を追加。初期は折りたたみ、`summary` はキーボードで開閉できる。overlayは`pointer-events:none`のため本要素だけ`auto`にする。
4. 英語表示は既存の`i18n.js`辞書に「直近の表示」「要確認: 」を追加する。履歴は表示のみで保存形式・API・MCPへ出さない（`jobStatus`/`jobEvents`が機械向けの正本）。

## 受け入れ条件

- 上書きされた警告が履歴に残る（焦点試験）。上限・畳み込み・`history()` の複製返却を試験。`#diagnostics-list` が無い環境でも `#status` は従来どおり。
- 内蔵ブラウザで日英両方、390px幅で表示・開閉を確認し、証拠JSONへ記録。

## 対象試験

```text
node --test tests/ui-status.test.mjs tests/ui-agent-connection-status.test.mjs tests/ui-agent-connection-status-scanner.test.mjs tests/i18n.test.mjs
npm run check:contracts
git diff --check
```

## 境界と納品

証拠 `docs/evidence/2026-10-28-opencode-83-uiimprove1.json`。`src/progress.json` は編集しない（親へ更新案を渡す）。残る親受入: 案3の対象領域リンクと`jobStatus`診断コードの併記、案1/4〜9、同一例題での操作数・復帰の前後比較、公開画面回帰。
