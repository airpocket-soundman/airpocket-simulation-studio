# 19 AGENTACP1 — ACP stdio初期化probeと子プロセス所有

## 最初に読む
1. [00-COMMON.md](00-COMMON.md)、17-P3（job復元とACPは別機能）。
2. `scripts/compare-wasm-runtime.mjs`、`scripts/reproduce-wasm-runtime.mjs`の所有child cleanupを読む。
3. 公式[stdio transport](https://agentclientprotocol.com/protocol/v1/transports)。
4. 公式[initialization](https://agentclientprotocol.com/protocol/v1/initialization)。
5. 公式[schema](https://agentclientprotocol.com/protocol/v1/schema)と、そこから参照する公開release。
一次本文確認日2026-10-19。実装時にも再確認し、v1とv2 draftを混ぜない。

## 今回の受入単位
Node hostがユーザー指定のACP agentを1個だけ所有し、initializeと停止を安全に行う。
会話session/prompt、認証実行、MCP操作委任、モデル選択は後続。ブラウザからspawnしない。
本物のCodex ACP起動方法は未確認。`codex --acp`等を推測で作らない。
ChatGPTサブスクリプションはAPI利用権限の証明ではない。自動API課金/鍵取得は禁止。

## 触れる場所
- `scripts/acp-client-process.mjs`（新規）：spawn/stream/parser/lifecycle。
- `scripts/probe-acp-agent.mjs`（新規）：明示configを読む限定CLI。
- `tests/acp-client-process.test.mjs`、`tests/fixtures/acp-agent-stub.mjs`（新規）。
- `docs/agent-acp-probe.md`（新規）：仕様版/実装範囲/実agent未確認。
- sanitized証拠JSON。browser connector/MCP schemaの既存権限を変更しない。

## 番号順に実装
1. 公式schema release/tag/取得URL/SHAを固定し、initialize request/responseの必要形を確認する。
2. 読めないfieldは推測せず一次資料へ戻る。初期化以外のschemaを作らない。
3. absolute executableと配列argvを明示configで受ける。shell:false/windowsHide:true。
4. 実行file探索/インストール/ログイン/暗黙restartをしない。設定したcwdだけ使う。
5. UTF-8の改行区切りJSON-RPCを実装。chunk境界の途中文字と複数行を正しく扱う。
6. initialize前にsessionを作らず、clientCapabilitiesは未実装機能を広告しない。
7. response id/版/必要fieldを検査。未知のagent→client requestは適切に拒否する。
8. 状態をstarting→initializing→ready→stopping→stopped、異常はfailedへ。
9. `ready`は初期化成功だけの意味。認証済み・会話可能と同一視しない。
10. timeout/cancel/EOF/親SIGINT/SIGTERMでも所有childを閉じ、closeを待つ。

## 値入り受入
- 同時child上限1。ready中の2回目startは拒否し、PIDを増やさない。
- initialize timeout10秒、停止grace2秒→強制終了待ち2秒、未終了は明確に失敗。
- stdout1record上限1MiB、stderr保持上限64KiB。上限超過は切断/終了。
- split UTF-8、2応答同chunk、無効JSON、stdout雑ログ、wrong idをfixtureで検証。
- 未対応protocolVersionはreadyにせず停止。advertisedでない認証を勝手に選ばない。
- stop2回は安全、timeout後active child0、timer/listenerが残らない。
- Windowsの孫process全終了をkill()だけで保証したと書かない。対象は所有child。
- secret/token/env全体をログへ出さない。stderrもそのまま証拠へ貼らない。

## 対象テスト
- `node --test tests/acp-client-process.test.mjs`
- fixtureは実Node subprocess、fake timerだけでcleanup成功を宣言しない。
- `git diff --check`。実商用agent検証は起動法を一次資料で確認できた場合だけ。

## 停止・後続・証拠
- ACPの現契約が変更されていれば対応版を明示して同じprobe単位を実装する。
- adapter不在ならstubでcoreを検証し、本物未接続を明記。任意CLIをACP扱いしない。
- 20-AGENTCHAT1へ渡すのは状態event/停止APIだけ。会話APIを捏造しない。
- 証拠：固定schema URL/tag/SHA、runtime/source SHA、終了PID確認、試験実数、未確認一覧。
- AGENTACP1親は未完。実Windows/公開HTTPS/本物認証/会話は残受入として保持。
