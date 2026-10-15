# Claudeへの引き継ぎ（2026-10-15 C）

[English](en/claude-handoff-2026-10-15-c.md)

利用者の依頼でCodexの実行を区切り、Claudeへ引き継ぐ。新しいClaude CLIは起動していない。本書の状態は作成時点の記録であり、再開時はGitHubと実ファイルを再確認する。

## 守る方針

- 利用者自身のLLMを専門Skillでエージェント化する。独自AIのサブスクを設計しない。全機能のAPI/MCP化、専門Skill、中間結果パイプラインが最優先。
- `docs/roadmap.md`のMOD1とP0/P1/P3を優先し、新しい物理モデル・ソルバー追加を先行させない。P0〜P6全体は未完了。
- D:のルートcheckoutは触らない。利用者の未コミット変更5件：`docs/printed-parts.md`、`docs/roadmap.md`、`docs/en/roadmap.md`、`src/board-strategy.js`、`src/progress.json`。pull、switch、stage、上書きをしない。
- PRは最新mainを含む正確なheadの必須verify成功後に通常マージする。保護の回避は禁止。承認・通常マージは利用者から実行許可済み。
- 成功した狭いテストを全体完了と扱わない。公開完了はverify/deploy/verify-published、実際の公開revisionと整合性を確認する。過去の失敗・履歴を消さない。
- 公開ページの接続コードは利用者が入力する。公開接続の許可はinspectのみ。接続コード・tokenを文書、ログ、チャットへ出さない。

## 現在地と最初に行うこと

1. mainはPR #38までマージ済み：`9716687b1492e25cd06eeeb809f3d4e8a7421cc1`。公開run **38707143618** は記録時点で`Run prepared tests`実行中。終了と決めつけず同じrunを確認する。
2. [Draft PR #40](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/40)の最新headとCIを確認する。この文書・件数修正・失敗証跡を同PRへpushする。初回head `c1c431e`のCI失敗は既知で、修正後の全体成功はまだ確認していない。
3. PR #40の全体CI、局所細分化と境界preflightの実Chrome確認を行う。正確なheadで成功後にDraftを解除して通常マージし、公開検証まで確認する。
4. GPU診断は別のpush済みブランチに保持。以下の統合注意を守って取り込む。
5. 公開接続、Node native障害、P0〜P6の残条件を継続する。109/111というタスク件数は完成率ではない。

## PRと公開状態

- #35：Worker観測のACK/送信上限と状態監査。公開`a3b344c`、verify/deploy/verify-published成功。公開済み109件。
- #36：公開済み状態の更新漏れ19件を修正した過去の公開。83→102。その後#35で109。
- #37：実Chromeの保存ビュー再読込・再取込の全項目一致、解析中input inspection、stale/page/scope拒否の証跡。main `9f57d0f`で公開検証28項目成功。
- #39：上記2件をready→releasedへ変更。main `6f195bf`でマージ済みだが公開run **38706323710** がnative heap破損で失敗し、**このrunからは配信されていない**。
- #38：APIジョブの進捗がGUI statusを「計算中」のまま残す問題を修正。API進捗はjob eventsへ保持し、GUI/direct経路は従来通り。実Chromeで結果・入力・status不変確認。最新head `e687e3a`の必須CI **38706364224** 成功後、main `9716687`へ通常マージ。
- 記録時点の最後の検証済み公開は`9f57d0f`、v0.44.0、109 released・2 ready。111への更新はmain `9716687`の配信結果次第。公開JSONを確認するまで111と断言しない。

## 作業場所

| worktree | branch / 内容 |
| --- | --- |
| `C:\Users\yamashita_y00031\.codex\worktrees\case-comparison\airpocket-simulation-studio` | `codex/llm-input-operations`、Draft #40。主作業場所。main `9716687`取り込み済み。文書追加前の統合headは`5b2844fdb1749edc04fdd3123235b913551876cd` |
| `C:\Users\yamashita_y00031\.codex\worktrees\mod1-wt\airpocket-simulation-studio` | `codex/mcp-tool-count-contracts`、`a220f71`。件数修正は主作業へcherry-pick済み。clean |
| `C:\Users\yamashita_y00031\.codex\worktrees\handoff-wt` | `codex/postmesh-boundary-preflight`、`dbdbe7c`。実装は主作業へcherry-pick済み。clean |
| `C:\Users\yamashita_y00031\.codex\worktrees\gpu-inspection-api\airpocket-simulation-studio` | `codex/gpu-inspection-api`、push済み`cad59a8ce272afeb408cb6d216b08d04b4e65bd2`。未統合・PR未作成、clean |

`external-flow-su2` / `codex/cow-urans`とDraft #7/#13は別の既存作業。今回変更していない。

## Draft #40の実装

### 実メッシュ後の境界転送preflight

共有`src/mesh-boundary-preflight.js`、保存MCP `studio_preflight_mesh_boundaries`、live `meshBoundaryPreflight`、操作契約・Skillを追加。成功・executionSettled済みmesh-only jobとexact入力版を照合し、ソルバーを呼ばず`transferConditions`を検査する。保存出力bytes/SHA-256を照合し、ID/revisionを残したmesh改変も拒否。非同期中の入力/mesh変更を拒否し、既存の構造化境界診断を保持する。

静的線形構造に限定。`completePreflight:false`を維持し、拘束rank・剛体モード・収束・物理精度は未検査。実CPU mesh-onlyとstdio/live sessionのテストはあるが、実Chromeでこの新操作を実行した証跡はまだない。

### 選択領域からの局所細分化

`addSelectedMeshRefinements({size,radius,baseSize})`を意味的edit/previewへ追加。GUIも同じAPI→既存`selectedRefinements`を使用。最大80追加/保存160件、局所sizeは明示baseSizeの15〜100%。選択と既存設定を保持し、不正値・空選択・stale・失効時は不変。既存MCPツール内の操作なので、この機能自体はツール数を増やさない。

### 件数契約

境界preflight追加後は**既定31 tools／接続33 tools／87 browser methods**。厳密assertと現行日英文書を修正済み。browser-onlyの3/4、過去の引継ぎ・証跡の数値は変更していない。GPU統合後はbrowser methodsがさらに1増えるので、全該当assertと現行文書を再照合する。

## テストと失敗（省略しない）

- 統合前・後の対象テスト：30成功（module boundaries、docs/progress、実CPU mesh、stdio/paired MCPなど）。
- `c1c431e`のlocal全体：1160件、1142成功、14失敗、1cancel、3skip、220716.9701ms。14失敗はツール/操作件数。cancelは`analysis-process-worker`のreal child invalid-inputテストが10秒timeout。原因は未確定、timeoutは増やしていない。
- 同headのPR40 CI **38706588775**：1160件、1143成功、14失敗、0cancel、3skip。14件は件数assert。localのchild timeoutはこのCIでは通過。
- 件数修正＋main取込後`5b2844f`の対象再検証：**34/34成功**。旧timeoutのchildテストも成功。ただし根因修正や修正後全体成功を意味しない。
- `docs/evidence/2026-10-15-input-operations-full-regression.json`に失敗と追検証を保存。生ログは主worktreeの`.qa/llm-input-operations-full.log`、`.qa/llm-input-count-followup.log`、`.qa/pr40-initial-verify-failure.log`。
- #38初回CI **38705501050** は1155件中1151成功/1失敗/3skip。旧observer例外テストに明示GUI originを指定し、例外・cleanup・遅延診断拒否assertを維持。関連32成功、後続必須CI成功。証跡`2026-10-15-api-progress-ci-regression.json`。

## Native heap破損の調査

main39 run **38706323710**：1154件中1150成功/1失敗/3skip。`mcp-advanced-structural-provenance.test.mjs`で`corrupted size vs. prev_size`。生ログ`.qa/main39-verify-failure.log`。新APIはこのテストから呼ばれない。原因を新APIや既知Node/V8問題と同一視しない。

このテストの8 MCP jobは既にprocess isolation。比較baseline4回だけdefault Worker。各経路のterminate/close待ちは実装されており、ログにはPID/phaseがなく、どちらで壊れたか特定不能。限定策候補はbaseline4回だけprocess指定にすることだが**未実施**。Worker対process比較とdefault Worker回帰を残し、スキップ・暗黙再試行・本番既定変更で隠さない。必要ならPID/phase診断を追加して原因を絞る。

## GPUブランチ

`checkGpuEnvironment`をinspect scopeで公開。空args、端末の実観測と能力宣言の区別、期限切れ/切断後の遅延応答拒否、device解放、入力/result不変、API/adapterなし・fallback・GPU診断を検証。対象14/14成功、実Chrome確認・全体テストは未実施。installed Skillは未同期。

古いmain起点のため、取り込み時は`browser-session`、operation names/contracts、厳密件数テスト、現行文書、Skillを手動で整合する。境界preflightを落とさない。PR40へ混ぜるか独立PRにするかは次担当が判断する。

## 接続と後片付け

- 今回のlocal QAは切断・session数0確認後、helper/Viteを停止し、private接続ファイル削除、タブ終了済み。5174/58354/58355のlistenなし。全体localテストsession 62163と追検証60785は終了済み。担当agentも終了状態。
- **既存の公開HTTPS用connectorだけ残存**：127.0.0.1:62814、記録時listen PID28588。接続情報は主worktree`.qa/connector-info.txt`。秘密値を出さない。再利用/停止前にPID・親・起動元を再確認する。
- PUBLICHTTPS1は利用者の「接続できた」という報告のみ。inspect実行・disconnect・browserVersion等の独立証跡は未完了。コード入力は利用者が行う。
- installed Skillには今回の境界/細分化referenceを同期したが、GPUは含まない。統合後repo全ファイルと配布版のhashを確認する。
- 管理worktreeの`.qa`は未追跡の検証物を含む。無差別削除・`git add -A`をしない。必要な証跡と接続秘密値を区別する。

## 次の完了判定

新API2件とGPUだけでP0/P1/MOD1を完了にしない。P2性能測定、P3公開接続・Worker transportの実Chrome確認、P4再現可能な出力、P5/P6等の元の残条件を`docs/roadmap.md`・progressから監査する。利用者への確認待ちを理由に、独立して進められるAPI/MCP/Skill整備まで止めない。
