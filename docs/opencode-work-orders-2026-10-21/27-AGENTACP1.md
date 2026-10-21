# AGENTACP1: PR #133 のACP envelope検査修正

## 開始条件

- 最初に [00-COMMON.md](00-COMMON.md) を読む。これは OpenCode / DeepSeek v4.1 Flash 向けの限定作業指示。
- sourceの場所、branch、HEAD、`git status --short`を記録する。dirtyなら停止し、既存変更を消さない。
- primary checkoutや別ownerのworktreeで実装しない。実装先を確定するまでsourceは読むだけ。
- 現在のHEADが下記review固定HEADと異なる場合、PR差分・source・testsを再照合し修正済みか判断する。
- 既存module、入力単位、拒否条件を優先し、testだけ通すための閾値緩和やmock置換をしない。
- shared progress / Skill / 他指示書 / package-lock / 本文で許可していないUI/APIは変更しない。

## 元PRの修正先

- これは元PRのblocker修正。新しい重複PRを作らず、元PRの最新headから作成した自分専用の修正branch/worktreeを使う。
- origin/mainに未mergeで対象moduleがない場合、別名moduleを作らず、共通指示の修正用worktreeを作成するか、変更ownerと調整する。
- 元PRbranchを共有中なら先にownerと担当範囲を確認する。dirty/HEAD不一致をreset・cherry-pickで強制解消しない。
- 修正commit/pushとPR更新は共通の承認・所有ルールに従う。mergeや親タスク完了の判断は別担当。

## 固定した出発点

- 元PR #133、branch `codex/opencode-agentacp1`。
- review HEAD `80d70688cb67f07c4e60e5e38b58d26ef7058970`。
- 既存worktree例: `D:/github/airpocket-soundman/studio-opencode-agentacp1`。これは読取参照専用。既存ownerの作業場所として再利用しない。
- 対象: scripts/acp-client-process.mjs / scripts/probe-acp-agent.mjs。
- 参照test: tests/acp-client-process.test.mjs / tests/fixtures/acp-agent-stub.mjs。
- 参照docs: docs/agent-acp-probe.md / docs/en/agent-acp-probe.md。

## 実測した不具合

子が `{"jsonrpc":"WRONG","id":1,"result":{"protocolVersion":1}}` を送っても `start()` がreadyを返す。
同時に `agentCapabilities:{loadSession:"yes"}, authMethods:[{}]` という不正型も通過した。
該当は #dispatchLine のline328–340とvalidateInitializeResultの浅い検査。通常の所有child停止は成功した。

## 番号付き実装

1. pinned ACP v1 schema/referenceと実装契約を読む。未確認v2・独自schemaを混ぜない。
2. dispatch前にjsonrpcが厳密に"2.0"であることを要求する。欠落/別型/別版を拒否。
3. request/notification/responseを排他的に判定。responseはidとresult/errorの片方だけを要求する。
4. result+error同居、method+result、id不正型、既知でないresponse IDをprotocol failureへ統一する。
5. 初期化resultの既知capability boolean、agentInfo、authMethods項目をpinned schemaに従い検査する。
6. schemaが許可するextension fieldは無根拠に禁止せず、必須/optional/nullを明文化する。
7. 不正UTF-8のreplacement decodeでJSONを成功させない。fatal decoderを使う場合はsplit UTF-8正常例を維持。
8. malformed時にreadyをemitせず、pending/timer/signal handlerを解放し所有child停止をawaitする。
9. CLIへraw stderr/argv/環境を出さない。通常initialize→stopと-32601の既存動作を維持する。

## 具体的な受入・拒否

- 上記WRONG envelope、jsonrpc欠落、result/error同居、capability文字列、authMethods不正項目を拒否。
- malformed UTF-8 byteをJSON文字列内に挿入した実Node fixtureで拒否を確認する。
- 正常v1、4-byte emojiの分割、複数record/chunkは成功。protocolVersion2は拒否。
- 失敗後のactiveChild=false、activeTimers=0、pendingRequests=0、signal handler解除を確認。
- 実agent未接続を維持。stub subprocessは実ACP agentとの互換性証明ではない。

## targeted commandと限界

`node --test tests/acp-client-process.test.mjs`

- review時は20件中19成功、invalid-json1件が3000ms timeout、同1件の単独再実行は成功した。
- 起動遅延とprotocol不具合を分ける。timeoutを延ばすだけでenvelope拒否を代替しない。
- 認証/session/prompt/FS/terminal/model選択を追加しない。親AGENTACP1は未完のまま。

## 停止・納品

- 範囲外の本番接続・一般形状・新solverが必要、既存修正と競合、前提PR不成立なら停止して不足を報告する。
- 修正済みなら重複変更せず、固定HEADと反例の拒否結果を報告する。
- 入力、期待値、実測値、拒否理由、実行command、HEADを小さい日付入りJSONでdocs/evidenceへ記録する。
- 未実行や環境不足をそのまま記す。秘密・巨大trace・ユーザーモデルを証拠へ入れない。
- 納品は変更一覧、targeted結果、未検証境界、残る親受入を短く記載する。親statusの完了昇格は禁止。
