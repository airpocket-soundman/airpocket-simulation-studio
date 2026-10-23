# ACPの限定テキストsession（AGENTACP1）

[English](en/agent-acp-session.md) / [initialize probe](agent-acp-probe.md)

2026-10-23。`scripts/acp-session-client.mjs` の `AcpSessionClient` は、明示した実行物/引数/cwdで所有するchild1個に対し、initialize→session/new→テキストprompt→終了を実装する。既存probe/CLIは初期化専用の既定動作を維持する。実CodexのACP入口・ログイン・認証・ブラウザ接続・MCP委任・モデル選択は未実装/未検証。実AIへ接続した成果ではない。

固定schemaは `schema-v1.26.0`、commit `e2d83349bc9e28a4059ea3acefa1c91c966f74e2`。取得した255170bytesのSHA256 `4bcd1d2051ff7ed379bd9b234fb9b09c5ab9245478698e9fab805bd9b52a33a6` を照合済み。一次資料: [session setup](https://agentclientprotocol.com/protocol/v1/session-setup)、[promptと取消](https://agentclientprotocol.com/protocol/v1/prompt-turn)、[固定schema](https://github.com/agentclientprotocol/agent-client-protocol/releases/download/schema-v1.26.0/schema.json)。v2 draftは混在させない。

## 契約と状態

`start()` はinitializedまで、`newSession(absoluteCwd)` は空のmcpServersでsessionを1個だけ作成する。readyでのみ `prompt(text)` を1個実行でき、成功結果は `{stopReason,text,updateCount,cancelled}`。start成功は認証済みを意味しない。診断に会話本文・環境・argv・remoteのエラー本文を返さない。本文は明示prompt結果だけで取得する。

文字数ではなくUTF-8でprompt16KiB、受信1record64KiB、1turnの通知128件/採用テキスト64KiB。request期限は既定30秒（1〜120000ms）、取消確認は既定2秒。stdoutの不正UTF-8/JSON-RPC、未知session/id、過大通知、応答形式違反、送信背圧でchildを停止しpendingを失敗させる。非テキストの既知updateは上限へ計上して本文へ採用しない。thoughtを本文へ転記せず、未広告notice/compactionは拒否する。fs/terminalはmethod-not-found、permissionは常にcancelledで、ツールを許可する経路はない。

取消中の本文は破棄し、cancelled応答を確認してから所有childを閉じる。同じsessionを再利用せず、取消後通知が次turnへ混入するのを防ぐ。次の会話は新しいclientが必要。通常完了後は同一sessionで次promptが可能。v1の通知にはturn IDがないため、仕様に反し正常完了後に送られる通知を次turnから完全に識別する一般保証はしない。

`close()` は冪等。実行中promptを取消扱いで決着させ、start/new中の遅い応答はready成功へ戻さない。stdin EOF→有界grace→所有childへのkill→close確認の既存処理を使う。孫process全体の終了を証明するものではない。失敗・終了後はtimer/listener/pending/採用本文を解放する。

## 検証

`node --test tests/acp-client-process.test.mjs tests/acp-session-client.test.mjs` は52試験成功。実Node合成childでUnicode、複数turn、並行拒否、取消後通知、EOF無視、期限、途中終了、過大/不正応答、client request拒否、start/new/close競合、同一chunkのnew応答+直後通知を検証。実agent・認証・GUI成功や親AGENTACP1完成とは区別する。
