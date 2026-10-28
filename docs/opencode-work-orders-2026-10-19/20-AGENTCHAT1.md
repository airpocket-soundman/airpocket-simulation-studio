# 20 AGENTCHAT1 — 接続状態と利用可能範囲を画面で正確に示す

## 最初に読む
1. [00-COMMON.md](00-COMMON.md)、[19-AGENTACP1.md](19-AGENTACP1.md)。
2. `src/browser-session-ui.js`、`src/browser-session.js`の既存手動接続とscope。
3. `src/browser-connection-diagnostics.js`、`src/browser-connection-errors.js`。
4. `src/main.js`のinstallBrowserSession、`src/i18n.js`の翻訳方法。
5. `tests/browser-connection-diagnostics.test.mjs`、`tests/browser-connection-errors.test.mjs`。

## 今回の受入単位
既存接続欄へ、接続方式・実状態・次に必要な操作を示す読み取り中心のstatusを追加する。
チャット送信・会話履歴・agentモデル自動選択はまだ実装しない。
現在のbrowser sessionとACP初期化probeを混同せず、別ラベルで表示する。
19の状態契約確定後にACP表示を接続。未導入時は「ACP未対応」を正直に表示する。
AGENTCHAT1の第一段階であり「アプリ内AIチャット完成」と広告しない。

## 触れる場所
- `src/ui/agent-connection-status-ui.js`（新規）：状態→表示の小module。
- `src/browser-session-ui.js`：既存callbackからstatusへ通知する最小接続。
- `src/main.js`：必要な設置hookのみ。接続方式を重複実装しない。
- `src/i18n.js`、module層登録の実ファイルの必要箇所。
- `tests/ui-agent-connection-status.test.mjs`（新規）、既存接続diagnostics tests。
- sanitized JSON/JA・EN narrow screenshot。共有docs/progress変更は提案だけ。

## 番号順に実装
1. 既存接続stateとeventを列挙し、実event→UI stateの対応表を作る。
2. disconnected/connecting/connected/expired/failedを区別する。
3. ACPはunavailable/initializing/initialized/stopping/stopped/failedを別表示する。
4. initializedには「初期化済み・会話/認証未確認」を併記しconnectedへ偽変換しない。
5. 通知で更新し、時間経過やボタンclickだけでconnectedにしない。
6. 既存接続/切断/診断buttonへ案内し、二重token欄や二重scopeを作らない。
7. 日本語原文DOMと辞書方式を使い、動的statusもlocale変更で更新する。
8. statusはaria-live polite、失敗は理由と次操作。秘密情報を表示しない。
9. scopeは現sessionから表示し、inspect以外を自動で許可しない。
10. teardown時listenerを解除し、切断後の古いcallbackを無視する。

## 値入り受入
- 接続成功event前の10秒間はconnectingのまま。timer成功は禁止。
- expired→再接続→connected、failed→切断→disconnectedを各1回検証。
- scope inspectだけならedit/analyze/viewは未許可と表示、checkbox値変更0回。
- ACP adapterなしはunavailable。本物接続なしのfixtureをlive成功と表示しない。
- EN起動→JA→ENでheading/button/status/aria-labelすべて対応言語。
- 390px幅で横overflowなし。Tabで接続・切断・診断へ到達できる。
- tokenとtoken入りURLをDOM/status/証拠に出さず、localStorageへ追加保存しない。
- teardown後のeventはDOM更新0回、project/revision/解析jobの変更0回。

## 対象テスト
- `node --test tests/ui-agent-connection-status.test.mjs tests/browser-connection-diagnostics.test.mjs tests/browser-connection-errors.test.mjs tests/module-boundaries.test.mjs`
- `npm run check:contracts`、`git diff --check`。
- Chromeはlocalhost合成sessionでJA/EN/390pxを確認。公開HTTPS権限を拡張しない。
- fake adapterのunit結果と実Chromeの観察を証拠内で分離する。

## 停止・依存・証拠
- 19未完ならbrowser状態表示まで実装できる。ACP欄はunavailableを維持する。
- state所有者が曖昧なら既存callbackを確認し、二重の接続状態machineを作らない。
- 認証/API利用権限をChatGPT契約から推定しない。課金・鍵入力を追加しない。
- 基準SHA、event対応表、実test数、Chrome範囲、未実会話を証拠へ。
- AGENTCHAT1親は未完。会話/安全な操作委任/取消/実agent連携は後続条件。
