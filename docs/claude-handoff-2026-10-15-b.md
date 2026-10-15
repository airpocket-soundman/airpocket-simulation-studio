# Claude 引き継ぎ資料 その2(2026-10-15 夜)

[English](en/claude-handoff-2026-10-15-b.md)

前回の[引き継ぎ資料](claude-handoff-2026-10-15.md)の続き。利用上限が近いため、次のセッションが止まらず再開できるよう、**確定した事実**と**未確定・保留**を分けて記す。結果を確認せずに合格として扱わないこと。

## 1. 制約・運用ルール(厳守)

- ルートチェックアウト `D:\github\airpocket-soundman\airpocket-simulation-studio` は `main`(古い 3fc7c97)で、利用者の未コミット変更がある。**触らない**。作業は下記の worktree で行う。
- main は保護されている。PR 必須、必須 CI は `verify`、最新 main への追従が必要。管理者バイパスはしない。`gh pr merge --merge` は、利用者が許可ルールを追加済みで、**最新コミットの verify 成功後**に通常マージする。マージ前に必ず最新コミットで成功したか確認する(`gh pr checks <n>`)。
- PR7 と PR13 は別担当者の CFD 作業。変更・マージしない。
- **公開(HTTPS)ページに接続コード等のトークンを入力する操作は、利用者に頼まれても私は行わない**。localhost の自分のアプリへのテスト値の入力だけ許される。公開ページでの確認は利用者が行う。
- 実Chromeの証跡取りは localhost(`http://127.0.0.1:5174`)のみ。公開サイトに接続しない。
- 接続コード等の秘密値をチャット・リポジトリ・証跡に書かない(`.qa/` は gitignore)。
- `src/progress.json` の編集は1か所(私)に集約する。複数ブランチで同時に触ると衝突する。状態変更は `npm run task:status -- ID 状態 "メモ" "証跡"` か、検証付きの Node スクリプト(`validateProgress`)で行う。
- 文書を足すときは `docs/<名>.md` と `docs/en/<名>.md` を作り、相互リンク(`en/<名>.md` / `../<名>.md`)を入れる(`tests/docs.test.mjs` が検査する)。
- テストの件数・時間は、実行した結果だけを書く。`ready` は「検証済み・未公開」で、`released` ではない。文書更新だけで `released` にしない。

## 2. 作業場所とブランチ

| 場所 | ブランチ | 状態 |
|---|---|---|
| `C:\Users\yamashita_y00031\.codex\worktrees\case-comparison\airpocket-simulation-studio` | `codex/release-v0.44` | v0.44.0 のリリース準備を担当エージェント(release-prep)が編集中。**未コミットの変更あり** |
| `C:\Users\yamashita_y00031\.codex\worktrees\mod1-wt\airpocket-simulation-studio` | `codex/evidence-chrome-4` | 実Chrome証跡担当(chrome-evidence-4)が稼働中。未追跡の証跡 JSON が増える。vite(5174)が動いているはず |
| `C:\Users\yamashita_y00031\.codex\worktrees\handoff-wt` | `codex/handoff-b` | この資料用 |
| `...\external-flow-su2\...` | `codex/cow-urans` | 別担当者の作業。触らない |

オープン PR: **#26**(ボード再判定、`ready` 23→27、`verify` 実行中だった)、#7・#13(別担当者、触らない)。

## 3. 今日の到達点(確定)

- 公開版(GitHub Pages)は v0.43.0 のまま、リビジョンは **7e496f6**(PR #24 マージ時点。以降のマージで更新されていく)。毎回、注釈付きタグ `release-<リビジョン>` が付き、verify・deploy・verify-published が成功してきた。
- 今日マージした PR: #14〜#25。主な内容: ケース比較の実Chrome検証、MOD1 の第1〜10スライス(境界チェック `scripts/check-module-boundaries.mjs`、TS 宣言 `src/contracts/`、ソルバーアダプター登録 `src/solver-adapters/`(validate/buildOptions/adaptive/skipsBoundaryTransfer/postprocess)、UI 分離 `src/ui/*`)、コネクタ 403 の CORS と `delivered` フラグ、名前付きビューの 1 ULP 修正(`canonicalViewState`)、短い WebM の空ファイル修正、3MF 3.25 MB 超の取り込み失敗の修正(`isCanonicalBase64`)、評価 API の文言修正、PERF1 の Node 側計測、UI 研究文書、容量測定と CI 証跡。
- 公開ボード(`development.html?lang=ja`)の「次の版を待っている(ready)」は、公開版で **20 件**を表示(配信候補をバイト数・SHA-256 で照合)。PR #26 マージ後は 27 件になる見込み。
- 全体テスト: 最新で 1112 件中 1109 成功・3 スキップ。ローカルの Node 24.11.1 では、`jit_page_->allocations_.erase` の V8 致命的エラー(nodejs/node#66366、24.x 未修正)が時々出る。CI の `verify` は毎回成功している。

## 4. 進捗ボードの状態

- 公開版: released 83 / ready 20 / checking 24 / fixing 1 / building 9 / queued 25。PR #26 で ready 27 / checking 17 になる予定。
- 新設: **PUBLICHTTPS1**(公開 HTTPS ページからのローカル接続を実ブラウザで確認)。公開 HTTPS の条件は個別項目から外し、ここに集約した(利用者の決定)。
- `fixing`: WAVECHANNELOBS1(Node 24 の全体ゲートが未達)。
- Node 24 ゲートの方針待ち(要判断): HEADLESSLIFECYCLE1、BROWSERCONTRACTS1(RUNTIMEWASM1 も関連)。
- 古いテスト件数: 72 項目の更新メモに「記録時点の値」の注記を追加済み(数字は未変更)。

## 5. 実行中・途中の作業(再開時に最初に確認)

1. **PR #26** の `verify` を確認し、成功ならマージ → 公開確認(manifest のリビジョン、タグ、公開 `progress.json` の ready 件数)。
2. **release-prep の成果**(case-comparison の作業ツリー、未コミット): v0.44.0 へのリリースラベル変更。`git status`・差分を確認し、`release` 欄の説明が事実のみ(未マージの機能を書いていない)か、制限(公開 HTTPS 未確認、V8 エラー、MOD1 未完了)が書かれているかを確認する。**版 v0.44.0 と説明文は利用者の了承を得てからマージ**する。
3. **chrome-evidence-4** の成果(mod1-wt): BROWSERBRIDGE1 / RESULTCONTROL1 / CADUPDATEAPI1 / CASEARCHIVE1 の実Chrome証跡(`docs/evidence/2026-10-15-*-real-chrome-4.json`)。完了後に vite(5174)と自分が起動したドライバーが止まっているか確認し、証跡を PR に載せる。
4. **公開ページの接続テスト**: 利用者がテスト中。結果は未確認。コネクタ(`node scripts/studio-mcp.mjs --browser-origin=https://airpocket-soundman.github.io`)が起動したまま。接続情報は `case-comparison\.qa\connector-info.txt`。診断は `studio_browser_sessions({diagnostics:true})` のカウンターで、これまでは「ブラウザの通信が1件も届いていない」(Chrome のローカルネットワーク許可、または Service Worker の疑い)。終わったら必ずコネクタを止め、接続情報ファイルを消す。
5. 後片付け: 不要になった `studio-mcp` / vite のプロセス、`handoff-wt` 等の worktree(マージ済みなら `git worktree remove`)。

## 6. 次にやること(推奨順)

1. 上の 5-1〜5-3 を処理。
2. 版を上げる PR(v0.44.0)→ 公開 → 公開記録の PR(`docs/evidence/…-publication-<リビジョン>.json` と、`ready` → `released`)。PUBLICHTTPS1 と公開ゲートは `released` にしない。
3. Node 24 ゲートの方針を利用者に確認(Node の版の変更、テストの並列度、その他)。決まれば HEADLESSLIFECYCLE1・BROWSERCONTRACTS1 を判断。
4. 実Chromeの証跡が不足している項目: MEASUREMENTHISTORY1(履歴 GUI・自動保存が未完成)、AGENTINPUT1(全物理の事前検査が未実装)、PRINTAPI1、CASEVIEWBUNDLE1/CASEMEASUREMENTBUNDLE1(実画面の全結果種)。
5. MOD1 の続き(`main.js` の UI 分離、worker の残り)。MOD1 全体は未完了(React/WASM 移行なし)。
6. BROWSEREXPORT1: 固定フレーム・MP4/GIF・永続化は未完成。裏のタブで書き出しが止まる(描画タイマーの間引き)現象は未対処。

## 7. 既知の問題

- Node 24.11.1(Windows)の V8 致命的エラー。全体実行で時々 1 ファイルが落ちる。単独実行では通る。
- `tests/browser-bridge.test.mjs` の「real HTTP polling client…」は、全体実行の負荷で子プロセスの 5 秒の起動待ちに間に合わず、まれに落ちる(単独では通る)。
- 公開 HTTPS から localhost のコネクタへの接続は未確認。
- 内蔵ブラウザ(Claude desktop のペイン)では、Gmsh のメッシュ生成が止まった(実Chromeでは正常)。実Chromeを使う。

## 8. 再開のコツ

- 並列化: 担当エージェントごとに書き込み範囲を分け、`src/progress.json` は触らせない。実Chromeを使う担当は1つだけにする(同じ作業ツリーで src を編集する担当と同時に動かさない)。別の worktree を使う。
- 実Chromeの証跡の取り方: スクラッチの Node ドライバーが `studio-mcp.mjs --browser-origin=http://127.0.0.1:5174` を stdio で起動し、stderr の `Browser connector:` から接続情報を読み、ページの接続 UI(`#agent-endpoint`、`#agent-token`、`[data-agent-scope]`、`#agent-connect`)に入力する。ドライバーは `C:\Users\YAMASH~1\AppData\Local\Temp\claude\...\scratchpad\` 配下(セッション固有で、消えている可能性がある)。
- `gh pr merge` は許可ルールが必要。拒否されたら回避せず、利用者に伝える。
- 作業ツリーでの `git add -A` は、他の担当の未追跡ファイルを巻き込む。対象を明示して `git add` する。

## 9. 未確認のこと(合格として扱わない)

- 公開 HTTPS ページからの接続(PUBLICHTTPS1)。
- ブラウザのヒープ、裏のタブ・最小化ウィンドウでの挙動、固定フレーム/MP4/GIF/時間・断面・変形・音響の出力。
- 実画面での全結果種(Node 側の測定のみ)。
- V8 エラーの根本原因(nodejs/node#66366 は候補で、このリポジトリの Windows の失敗が同根かは未確認)。
