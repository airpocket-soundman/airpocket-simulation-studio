# ACP initializeプローブと所有childのライフサイクル（AGENTACP1）

[English](en/agent-acp-probe.md)

範囲: 利用者が指定した**1個だけ**のACP agent childをNodeホストが所有し、ACP stdioトランスポートで`initialize`ハンドシェイクを1回実行し、そのchildを安全に停止する。ACPのそれ以外はこの単位の対象外である。`session/new`、`session/prompt`、認証の実行、MCP委任、モデル選択は後続とする。ブラウザからは何もspawnしない。

実在するCodexのACP起動方法は**未確認**である。`codex --acp`のような推測、PATH探索、install、login、暗黙の再起動はこのコードのどこにも無い。

## 固定した一次資料（2026-10-19取得）

ACP **v1**（整数`protocolVersion` `1`）だけを交渉する。v2 draftは混在させない。

| 項目 | 値 |
| --- | --- |
| stdio transport | https://agentclientprotocol.com/protocol/v1/transports |
| initialization | https://agentclientprotocol.com/protocol/v1/initialization |
| schema page | https://agentclientprotocol.com/protocol/v1/schema |
| schema release | `schema-v1.26.0`（https://github.com/agentclientprotocol/agent-client-protocol/releases/tag/schema-v1.26.0） |
| tag object SHA | `3fdcc2cb717e1dfa50f2efcaeae88cb69a6504cd` |
| tagged commit SHA | `e2d83349bc9e28a4059ea3acefa1c91c966f74e2` |
| schema.json URL | https://github.com/agentclientprotocol/agent-client-protocol/releases/download/schema-v1.26.0/schema.json |
| schema.json SHA-256 | `4bcd1d2051ff7ed379bd9b234fb9b09c5ab9245478698e9fab805bd9b52a33a6` |
| schema.json size | 255170 bytes |

これらの定数は`scripts/acp-client-process.mjs`の`ACP_SCHEMA_REFERENCE`に置き、固定releaseの変更が明示的になるようにする。

## initializeが送る内容と要求

`buildInitializeRequest(id)`が作る要求:

- `jsonrpc: "2.0"`、整数`id`。
- `params.protocolVersion = 1`。
- `params.clientCapabilities`は全fieldが`false`（`fs.readTextFile`、`fs.writeTextFile`、`terminal`、`auth.terminal`）。提供できない能力を宣言しない。ACPは省略を未対応として扱うため、明示的な`false`はschema既定と一致し、filesystem・terminal・terminal-authの対応を主張しない。
- `params.clientInfo`はprobeのname/title/version。秘密を入れない。

`validateInitializeResult`が応答を検査する:

- `result`はJSON objectであること。
- `result.protocolVersion`は整数で`1`と等しいこと。それ以外（例: v2 draftの`2`）は`ready`にせず停止して失敗する。
- `agentCapabilities`があればobject、`agentInfo`があればobjectまたは`null`、`authMethods`があればarrayであること。
- `authMethods`は**記録するだけで使わない**。`authenticate`を呼ばないため、広告された方法・されない方法のどちらも選択しない。

実装するのはinitializationの形だけである。session・content・tool-callのschemaは作らず、読めないfieldを推測しない。

## stdio framing

ACP stdioは改行区切りのUTF-8 JSON-RPCである。改行はUTF-8の途中に現れないため、parserは生バイトをbufferし`0x0a`で分割する。これにより、1文字が2 chunkにまたがっても多バイト文字が壊れず、複数recordが1 chunkで来ても処理できる。末尾の`\r`は除く。

有効なJSON-RPC objectでないstdout recordはプロトコル違反とする。空record、JSONでないtext（stray logging）、request（`method`+`id`）・notification（`method`）・response（`id`+`result`/`error`）のいずれでもない形が該当する。未完了requestの`id`と一致しないresponseも違反である。

agentからclientへのrequestはJSON-RPC method-not-found（`-32601`）で拒否する。このprobeはclient側ACP methodを実装していないためである。agentからのnotificationは無視する（応答しない）。

## ライフサイクルと上限

状態機械: `idle → starting → initializing → ready → stopping → stopped`。プロトコル違反、予期しない終了、終了の未確認は`failed`になる。`ready`はinitializeハンドシェイクが成功したことだけを意味し、認証済み・会話可能を意味しない。sessionは存在しない。

| 項目 | 値 |
| --- | --- |
| 同時に所有するchild | 1（2回目の`start()`は拒否しspawnしない） |
| initialize timeout | 10000 ms |
| stop grace（stdin EOF） | 2000 ms |
| force-kill wait | 2000 ms |
| stdout 1 record上限 | 1 MiB（超過で切断し失敗） |
| stderr保持上限 | 64 KiB（古いバイトから破棄。raw stderrは外へ出さない） |

`stop()`はchildのstdinを閉じ、graceを待ち、force-killして再度待つ。所有childがなお終了しなければ`exited: false`を返し状態を`failed`にする。`stop()`は冪等で、2回目は最初のshutdown結果を返す。親の`SIGINT`/`SIGTERM`も同じshutdownを起こす（handlerは`installSignalHandlers`が`false`でない場合だけ設置し、child close後に外す）。

所有の範囲はこのprocessがspawnしたchildだけである。`kill()`で終了させても、Windowsの孫process-tree全体が消えたことは**証明しない**。この単位はそのような主張をしない。close確認後、timerもsignal listenerも残らない（`diagnostics()`が`activeTimers`と`signalHandlersInstalled`を返す）。

## 秘密

childは実行のため親の環境を継承するが、その環境をclientへ保存・log・emit・返却しない。`describe()`と`diagnostics()`が返すのは状態、pid、交渉したプロトコル情報、上限付きstderrバイト数、失敗文だけである。raw stderrは証拠へ入れない。

## CLI

```
node scripts/probe-acp-agent.mjs --config=<absolute path to config.json>
```

config JSONが受け付けるfieldは次のとおりだけ:

```json
{
  "executable": "<absolute path>",
  "argv": ["<arg>", "..."],
  "cwd": "<absolute path>",
  "initializeTimeoutMs": 10000,
  "stopGraceMs": 2000,
  "forceKillWaitMs": 2000
}
```

CLIは1回initializeして停止し、sanitizeしたJSON report（reference、ready flag、交渉version、上限付き`agentInfo`、auth methodの**idのみ**、state、stop結果）を表示する。argv、環境、raw stderrは表示しない。exit codeはinitialize成功かつchild終了のときだけ`0`である。

## 状態: 実agentは未接続

使うのは合成fixture `tests/fixtures/acp-agent-stub.mjs`だけである。実在するACP agent（Codexを含む）は起動していない。実起動方法が未確認だからである。実agentの接続には、そのagentのACP入口について一次資料の参照が必要で、commandの推測は禁止する。

## テスト

```
node --test tests/acp-client-process.test.mjs
git diff --check
```

fixtureは実Node subprocessである。「所有childが終了しない」分岐を試す1件は、意図的にno-op killを注入しており、その結果が示すのは明示的な失敗報告だけである。実processが終了に耐えられることの証明ではない。
