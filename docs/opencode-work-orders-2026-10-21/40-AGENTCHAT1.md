# 40 AGENTCHAT1 — PR #145 の aria 言語切替 P2 修正

## 必読・開始条件

1. [00-COMMON.md](00-COMMON.md)、特に「元PRを修正する9件の特別手順」を読む。今回40も元PR修正として同手順を適用する。対象数の表現より個別指示を優先する。
2. レビュー対象は PR #145、branch `codex/opencode-agentchat1`、head `f0741c5d02891e8b996b09f621f3a360c873ce69`。
3. `gh pr view 145 --json headRefName,headRefOid,state` と fetch で最新状態を確認する。既に修正済みなら実scanner回帰を確認して報告し、再実装しない。
4. 未mergeなら取得した最新PR headから、自分の `codex/opencode-repair-40` / `D:/github/airpocket-soundman/studio-opencode-repair-40` を新設する。元headが変わったら差分を再評価する。
5. ownerの `studio-opencode-agentchat1`、primary、thermal-compare、UI2と他PRのworktreeは編集禁止。知らないdirtyを消さない。
6. 元PRが既にmerge済みの場合だけ最新origin/main起点の修正PRへ切り替える。未mergeの元PR修正で重複PRを作らない。

## 読む順・変更範囲

1. `src/ui/agent-connection-status-ui.js` の render、live aria-label（レビュー時96行）。
2. `src/i18n.js` の installLanguage、attributes WeakMap、scan、studio-language dispatch。
3. `src/browser-session-ui.js` の状態通知・言語イベント・disconnect/teardown。
4. `tests/ui-agent-connection-status.test.mjs`、`tests/i18n.test.mjs`。
5. `src/browser-session.js` の connectedイベントとscope enforcementは不変確認のためだけ読む。

変更可: agent-connection-status-ui.js、同UI test、実scanner回帰の新test、今回evidence。
共通i18n.js変更が必要なら先に影響を説明し、他UIを壊さない根拠を示す。安易なscanner全体変更は禁止。
変更禁止: main.js、権限scope定義/拡大、接続・認証方式、ACP実装、物理solver、progress、共通docs/Skill、UI2。

## 確定した反例

EN開始でstatus panelを生成すると `aria-label` は `Connection status notifications`。
実installLanguageの初回scanが、この英語を属性の原文として保持する。
JPへ切り替えるとmodule handler直後は `接続状態の通知` になる。
textContent変更で発生する次scan後に `Connection status notifications` へ戻る。
既存UI testは翻訳辞書callbackだけで、実scannerの属性原文保持を再現していない。

## 番号付き実装・受入

1. 修正前に上記 EN→JP→scan の失敗testを追加する。実 `installLanguage` を呼び、実MutationObserverの次走査に相当する処理まで進める。辞書だけのstubで合格させない。
2. 属性は常にJP原文で生成しscannerへ翻訳を委任するか、moduleの翻訳所有範囲を明示してscanner対象外にする。どちらか一貫した所有にし、二重翻訳を避ける。
3. EN起動→JP→再scan→EN→再scanで、liveのaria-labelがそれぞれ各言語を維持することをassertする。切替handler直後の値だけでは不十分。
4. JP起動→EN→JPも確認。見出し・状態・次操作・許可/未許可一覧・ACP注記・live本文も言語と整合し、不要な再描画ループを作らない。
5. connected sessionId=`synthetic-session-40`、scopes=[inspect] の合成通知で、inspectだけ許可表示、edit/analyze/viewは未許可のまま。locale変更でscope・接続世代・状態を変えない。
6. connecting、failed、disconnectedの表示でもlocale往復を確認する。秘密token/endpointをDOMや証拠に追加せず、ACP unavailableを接続済みへ読み替えない。
7. teardown後の通知/localeイベントでDOMを書き換えない既存testを保持する。接続generation guard、実poll側scope enforce、取消の挙動を変えない。
8. 可能なら凍結localhostの実ChromeでEN開始→JP→ENを確認し、アクセシブル名まで記録する。Node DOM harness成功とChrome成功、公開HTTPS成功は分ける。実Chrome不能なら未確認を残す。

## 対象試験

```powershell
node --test tests/ui-agent-connection-status.test.mjs tests/browser-connection-diagnostics.test.mjs tests/browser-connection-errors.test.mjs tests/module-boundaries.test.mjs tests/i18n.test.mjs
npm run check:contracts
git diff --check
```

レビュー時の最初の4filesは34 pass。実scanner回帰を別fileにした場合はその正確なpathも追加実行する。test件数を固定して水増ししない。

## 停止・証拠・反映

- 数値/属性の不一致、scope拡大、保存互換破壊、知らないdirty、元head進行、秘密が必要なら関係変更を停止し、再現と判断点を報告する。test削除/skipで成功させない。
- `docs/evidence/<実行日>-opencode-next-40.json` にbase/head、反例の各scan前後の実文字列、対象試験、実Chrome有無、未確認、修正範囲をsanitize記録。token/pairing code/全環境変数は記録しない。
- 修正commit後に最新元headが進んでいないことを確認し、`git push origin HEAD:codex/opencode-agentchat1` の通常FFで元PRへ反映。forceは禁止、拒否なら止めて差分報告。自己mergeしない。
- 親AGENTCHAT1全体をcomplete/releasedにしない。会話/認証/モデル選択未実装と実Chrome未確認は残す。
- 最終納品: 動作・変更files・実試験と反例解消・未確認・証拠・commit/push先・元PR URL・再レビュー箇所。所有tab/server/接続だけcleanupする。
