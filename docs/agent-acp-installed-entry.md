# インストール済みACP入口の読取診断

[English](en/agent-acp-installed-entry.md)

2026-10-23、base `001cb3b9775f25910426609b0b3fb83f33af0d18`。既存の `@agentclientprotocol/codex-acp` 2.2.2を確認し、既存 `AcpSessionClient.start()` で実childのACP v1 initializeが成功した。[実行証拠](evidence/2026-10-23-acp-installed-initialize.json)。過去の「実入口未確認」は当時の記録であり、この限定診断で更新された。

PATHのCodex CLIは0.146.1で、helpにACP入口はない。別に既に入っていたACP adapterは、local READMEでACP stdio要求をCodex App Serverへ変換すると説明する。adapter同梱CLIは直接version診断で0.160.1だった。[公式App Server文書](https://learn.chatgpt.com/docs/app-server)のthread/turn APIと、既存clientが話すACP session APIは別の契約である。App ServerそのものをACP agentとは扱わない。

adapterの既存package/README/bundleを読んで入口を固定した。`--version`は起動前に終了するが、`--help`の分岐はなくserverが起動するため実行しなかった。`codex-acp cli --version`も上位のversion分岐が捕捉するのでadapter自身の版が出る。依存CLI版の根拠には使わない。認証のread-only statusはChatGPTログイン済みとだけ分類し、raw値・識別子・認証ファイル・環境の一覧は保持していない。このstatusは会話権限やモデル利用を証明しない。

専用の空synthetic cwdで、Node実行物に既存adapterの絶対bundleパスを渡した。新install、SDK取得、権限拡張、認証変更はない。診断のNode内だけでoptional raw logと自動認証要求・実行物/config overrideを無効にした。initializeのみで、session/new、prompt、モデル指定、ファイル操作、ツール権限付与は実行していない。既存clientの `authentication:not-performed` / `realAgentVerified:false` はそのまま保持し、初期化成功を会話成功に読み替えていない。

3965 msで初期化と終了診断が完了。stdin EOFだけでは終了せず、既存の有界shutdownが所有childの強制停止へ進み、終了を確認した。初期化後にPID/親PID/実行名だけで観測したadapter/CLI wrapper/nativeの3processは終了後すべて不在。最終activeChild=false、timer=0、pending=0、保持本文=0、signal listenerなし。観測したprocessに限定した証拠であり、一般的なWindows process-tree終了保証は主張しない。

残件は実adapterとのsession/new/update互換性、明示的に許可された会話・取消の実試験、本番browser transportとmainへの接続である。今回会話・外部AIへの利用者データ送信はしていない。次の自律作業は既存合成childの回帰、入口診断の再現性、読取状態の明確化まで進められる。本番transportやモデルpromptの追加は別の範囲判断が必要。共有進捗を完成へ変更していない。

## session/newの事前監査

同じbundleの `newSession` はskills root設定、session config作成、`thread/start`、`model/list`、認証状態読取を行う。直接 `turn/start` やauthenticateは呼ばず、タイトル生成もprompt完了後の経路にある。ただしmetadata作成は無副作用ではなく、Codex側thread管理やMCP起動の可能性がある。

既定AgentModeは `agent`（auto_review、workspaceWrite、networkAccess=false）。`INITIAL_AGENT_MODE=read-only` はsession状態と後続promptに使われ、`thread/start` のsandboxを単独では制限しない。`createSessionConfig` はcwdをtrustedへ設定し、`mcpServers:[]` の場合に既存MCPを消さずconfigを返す。空のMCP tableだけでは継承先の停止を保証できない。user configではMCP定義2件・plugin定義12件、inline hooksなしだった。名前・URL・識別子・値は証拠へ保存していない。

[公式設定参照](https://learn.chatgpt.com/docs/config-file/config-reference)で、`sandbox_mode="read-only"`、`features.hooks=false`、各 `mcp_servers.<id>.enabled=false` と `plugins.<plugin>.enabled=false` の設定面は確認した。しかし既存clientはsession作成前のeffective config/readbackを公開せず、全設定層やworkspace管理pluginまで無効と実証できない。adapterの `CODEX_CONFIG` もhooksだけを起動引数へ分離し、残りはthread configへ渡す。このため「read-only・hooks無効・MCP全無効を実証後のみ」という今回の条件でsession/newは**未実施**。認証やグローバル設定を変更して回避していない。

再現用の [initialize専用driver](evidence/acp-installed-initialize-driver.mjs) は明示した絶対bundleパスと固定hashのみ受け入れ、Windowsの専用空一時cwdで実行する。診断プロセス内だけで `APP_SERVER_LOGS` / `DEFAULT_AUTH_REQUEST` / `CODEX_CONFIG` / `CODEX_PATH` / `MODEL_PROVIDER` を除去する。CODEX_HOMEや認証ファイルは変更・複製しない。秘密値・session ID・モデル一覧・プロセスIDを出力しない。[再実行結果](evidence/2026-10-23-acp-installed-initialize-reproduced.json)もinitialize成功と観測process終了を確認した。これをmetadata session成功とは扱わない。

本番transportの具体条件は、明示実行物の版/hash固定、全設定層の有効sandbox/hooks/MCP状態を作成前に読取確認できる制約、秘密を返さない認証状態、localhost限定接続と接続元検査、接続世代と所有child終了の有界処理である。既存54/55の1prompt・取消後session退役・plain text上限を維持する。実promptを別途許可された後の最小案は、利用者ファイルを含めない固定合成の短文1回、通常終了の観測、別childで取消と遅延通知破棄、期限/認証不足/途中終了の固定失敗コード確認。今回promptは送信していない。
