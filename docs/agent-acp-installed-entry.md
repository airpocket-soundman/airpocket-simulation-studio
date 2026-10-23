# インストール済みACP入口の読取診断

[English](en/agent-acp-installed-entry.md)

2026-10-23、base `001cb3b9775f25910426609b0b3fb83f33af0d18`。既存の `@agentclientprotocol/codex-acp` 2.2.2を確認し、既存 `AcpSessionClient.start()` で実childのACP v1 initializeが成功した。[実行証拠](evidence/2026-10-23-acp-installed-initialize.json)。過去の「実入口未確認」は当時の記録であり、この限定診断で更新された。

PATHのCodex CLIは0.146.1で、helpにACP入口はない。別に既に入っていたACP adapterは、local READMEでACP stdio要求をCodex App Serverへ変換すると説明する。adapter同梱CLIは直接version診断で0.160.1だった。[公式App Server文書](https://learn.chatgpt.com/docs/app-server)のthread/turn APIと、既存clientが話すACP session APIは別の契約である。App ServerそのものをACP agentとは扱わない。

adapterの既存package/README/bundleを読んで入口を固定した。`--version`は起動前に終了するが、`--help`の分岐はなくserverが起動するため実行しなかった。`codex-acp cli --version`も上位のversion分岐が捕捉するのでadapter自身の版が出る。依存CLI版の根拠には使わない。認証のread-only statusはChatGPTログイン済みとだけ分類し、raw値・識別子・認証ファイル・環境の一覧は保持していない。このstatusは会話権限やモデル利用を証明しない。

専用の空synthetic cwdで、Node実行物に既存adapterの絶対bundleパスを渡した。新install、SDK取得、権限拡張、認証変更はない。診断のNode内だけでoptional raw logと自動認証要求・実行物/config overrideを無効にした。initializeのみで、session/new、prompt、モデル指定、ファイル操作、ツール権限付与は実行していない。既存clientの `authentication:not-performed` / `realAgentVerified:false` はそのまま保持し、初期化成功を会話成功に読み替えていない。

3965 msで初期化と終了診断が完了。stdin EOFだけでは終了せず、既存の有界shutdownが所有childの強制停止へ進み、終了を確認した。初期化後にPID/親PID/実行名だけで観測したadapter/CLI wrapper/nativeの3processは終了後すべて不在。最終activeChild=false、timer=0、pending=0、保持本文=0、signal listenerなし。観測したprocessに限定した証拠であり、一般的なWindows process-tree終了保証は主張しない。

残件は実adapterとのsession/new/update互換性、明示的に許可された会話・取消の実試験、本番browser transportとmainへの接続である。今回会話・外部AIへの利用者データ送信はしていない。次の自律作業は既存合成childの回帰、入口診断の再現性、読取状態の明確化まで進められる。本番transportやモデルpromptの追加は別の範囲判断が必要。共有進捗を完成へ変更していない。
