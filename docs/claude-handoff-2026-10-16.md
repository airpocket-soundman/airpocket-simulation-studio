# Codexへの引き継ぎ（2026-10-16、Claudeから）

[English](en/claude-handoff-2026-10-16.md)

利用者の指示でClaudeの作業を区切り、Codexへ引き継ぐ。本書は作成時点（main `26138f3` = PR #96のマージ）の記録。再開時はGitHub・公開JSON・実ファイルを確認し、本書の数値を断言しない。先行資料は[2026-10-15](claude-handoff-2026-10-15.md)、[B](claude-handoff-2026-10-15-b.md)、[C](claude-handoff-2026-10-15-c.md)。

## 守る方針（変更なし）

- ルートcheckout（`D:\github\airpocket-soundman\airpocket-simulation-studio`）は触らない。未コミット変更5件（`docs/printed-parts.md`、`docs/roadmap.md`、`docs/en/roadmap.md`、`src/board-strategy.js`、`src/progress.json`）は利用者のもの。作業はworktreeで行う。
- mainは保護済み。PR → 正確なheadの必須CI `verify` 成功 → mainが進んでいれば `gh pr update-branch` → `gh pr merge --merge`。管理者権限での回避は禁止。マージ後は公開run（verify/deploy/verify-published）、公開`runtime-manifest.json`のrevision、タグ`release-<sha>`を確認する。
- #13（URANS試作）はドラフトのまま保留（利用者の判断）。#7はマージ済み。
- 公開HTTPSは確認（inspect）のみ。接続コード・tokenを文書・ログ・チャットへ出さない（chrome-mediaが一度、停止済み接続のtokenを自分の出力に表示した。1回限り・ローカル・接続停止済みで実害なし）。
- 結果を捏造しない。実Chromeで未確認のものは「未確認」と書く。ボードの`ready`は公開HTTPS以外の検証済み、`released`は公開記録が必要。
- 動画は保留（`docs/intro-video.md`。実体はリポジトリ外、約49 MiB）。

## 現在地（記録時点）

- 開いているPRは#13（ドラフト）のみ。公開済み（released）125、ready 2（CASEARCHIVE1、PUBLICHTTPS1）、checking 4（AGENTINPUT1、BROWSEREXPORT1、RUNTIMEWASM1、MCPARGUMENTTYPES1）、building 10、queued 24。最新の公開確認は#95（`4b57373`付近）まで。#96以降の公開runは未確認。
- 動いているサブエージェントはchrome-mediaのみ（PR #96の熱スライダー修正の実Chrome再確認）。結果は`docs/evidence/2026-10-16-thermal-slider-fixes-real-chrome.json`（p-dのworktreeに未コミット）に書かれる予定。完了通知は新しい担当へは届かない。p-dを確認すること。

## 今日マージしたもの（要点）

| PR | 内容 |
| --- | --- |
| #7 | SU2任意経路（取得は明示実行・固定SHA-256、同梱しない、LGPL-2.1表記）。CFD1は試作のまま |
| #63, #76 | 固定フレームPNG連番ZIP、`physicalRevision`（解き直しでもZIP一致。`resultRevision`・CAS・アーカイブのハッシュは不変） |
| #66, #73, #82, #88, #91, #92 | ケースアーカイブ性能: canonicalJson再利用、コネクタ即時再ポーリング、ブリッジlong-poll（約20倍）、ケースストアのメモ化・保持量削減・256 MiB予算（`CASE_MEMORY_BUDGET`）、`at()/count()/names()` |
| #67, #71 | READMEを英語主体（`README.md`）＋日本語版（`README.ja.md`）に再構成、表示名を「airpocket Simulation Studio」へ（エンジン識別名は不変）、`docs/media`に結果画像・GIF・WebM |
| #69 | メッシュ後検査: 音響の波長あたり要素数、連結成分の拘束 |
| #74, #77, #86, #93, #96 | VIEWTIME: 補間モジュール、音響の補間スライダー、熱の節点温度スナップショット（opt-in `thermalSnapshotCount`）、熱の時間スライダー、プローブ/書出しの修正 |
| #75, #79 | REG2: 設計書、円錐領域（既存の円筒領域指定に任意の`radiusAtMax`） |
| #83, #84, #89 | VIEWCOMPARE: 配置モジュール、2ケース左右比較パネル、カラーバー |
| #80 | NUMERICREFERENCE1: 失敗捕捉フックと、線検索の基準ノルム保存（約1%の間欠失敗が717回で0件） |
| #78, #94 | CFD候補調査（SU2/OpenFOAM/HiSA/Eilmer）、V8クラッシュの上流状況と分離実験 |
| #70 | 公開記録`2026-10-16-publication-d268661.json`、6項目をreleasedへ |
| #68, #81, #85, #87, #90, #95 | 証拠JSONとボード注記 |

証拠は`docs/evidence/2026-10-16-*.json`。

## 実Chrome（real Chrome）で確認する方法

`studio-mcp.mjs --browser-origin=http://127.0.0.1:5174`を起動するスクラッチのNodeドライバと、`vite`（127.0.0.1:5174）を使う。接続tokenは.gitignore済みの`.qa/conn-local.txt`経由でページJSに渡し、出力・チャットへ出さない。localhostのみ。内蔵ブラウザペインはGmshメッシュ生成で止まるためClaude in Chromeを使う。非選択タブはタイマーが絞られ書き出しが遅くなる。ブラウザの自動翻訳が動くと動的テキストが書き換わる（書出し1枚目のキャプションが変わった例あり）。

## 未解決・未確認

- **熱スライダーの修正（#96）**: 実Chromeで未確認（確認中）。比較パネルは熱スナップショットを無視。熱の連番/時間書出しは未対応（連番書出しが音響専用）。
- **VIEWCOMPARE**: 動画出力、MCP/API操作、再読込・中止後の保持、完全に別形状の比較が未実装/未確認。
- **REG2**: 球・一般曲面（UV矩形）は未着手。円錐STEPで終端半径を空欄にした場合の条件文表示は未確認。別操作`selectConicalRegion`は凍結契約の変更になるため行っていない（利用者判断）。
- **BROWSEREXPORT1**: `slice`、容量上限境界、120枚成功、MP4/GIFが未検証。
- **CASEARCHIVE1**: `CASE_MEMORY_BUDGET`の実機到達が未検証（8件上限が先に働く）。前面・無負荷環境での再計測、公開HTTPSでの確認は残る。
- **RUNTIMEWASM1**: V8のWASMラッパーキャッシュ競合（nodejs/node#66366）。24.21.0・24.22.0とも修正を含まない（バックポートPR 66376は未マージ）。当方の93回の実行では再現0件で、引き金となる自前の操作は未特定。推奨は修正入りの24.xへのCIピン移行。暫定の`--no-wasm-code-gc`はCI変更で、利用者の承認が必要。CIでは今日もPR #88で1回発生し、失敗ジョブの再実行で通過した（失敗は記録して隠さない）。
- **AGENTINPUT1**: 実gmshの熱・音響メッシュでの検査、流体/直交異方性/非線形/モーダルの桁規則、メッシュ品質・収束検査が残る。
- **MCPARGUMENTTYPES1**: 利用者環境でのMCP再登録後のSDK型生成確認が必要。
- **ボードの状態**: VIEWCOMPARE/VIEWTIME/NUMERICREFERENCE1/CFDRESEARCH1は作業が進んだが状態はqueuedのまま（注記のみ更新）。必要なら状態の見直しを。
- **README**: 同梱メディアは英語UI。日本語UIの表示は未確認。

## 副作用・注意

- 担当の一人がMFEMビルド中断時に`taskkill`でpython.exeを止めた。他のセッションのPythonが止まった可能性がある。
- 同担当が公式配布元からNode 22.23.3/24.22.0/26.12.0のzipをスクラッチへ取得し、SHASUMS256.txtで検証した（ハッシュは`2026-10-16-v8-crash-isolation.json`）。システムには入れていない。
- 新しいworktreeはMFEM/ネイティブが未ビルドで、フルテストで十数件が失敗することがある（CIでは通る）。`npm run build`相当の準備か、関連テストの限定実行で確認する。

## 後片付け

- 作業用worktree（`C:\Users\yamashita_y00031\.codex\worktrees\`のp-a〜p-u、`p-lp`、`case-comparison`、`external-flow-su2`）のうち、マージ済みブランチ分は削除してよい。`external-flow-su2`は#13用なので残す。ブランチはGitHubの自動削除でリモートは消える。
- `p-d`の未コミット証拠JSON（chrome-mediaの出力）は、確認完了後にPRで取り込むか破棄する。
- PR待ちの定型処理: 作成 → `gh pr update-branch` → `verify`成功を待つ → `gh pr merge --merge`。更新直後はチェックが未登録の瞬間があるので、passまたはfailが出るまで待つこと。

## 次の候補

1. #96の実Chrome再確認の結果を取り込み、VIEWTIMEのボード注記を更新。
2. 熱スナップショットを比較パネル・連番書出しへ（音響専用の仕組みの一般化）。
3. VIEWCOMPAREの動画出力とMCP/API操作。
4. REG2の球領域、UV矩形領域。
5. 公開確認（最新mainのverify-published）と、新しい公開記録・ready→releasedの更新。
6. RUNTIMEWASM1: 修正入りNode 24.xの確認、承認があれば`--no-wasm-code-gc`の導入。
