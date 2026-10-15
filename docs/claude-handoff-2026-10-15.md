# Claude 引き継ぎ資料(2026-10-15)

[English](en/claude-handoff-2026-10-15.md)

## 0. 目的

ユーザーの依頼により、Codex での開発はここでいったん区切り、以後は Claude が引き継ぐ。Codex 側の開発は続行しない。
本書は「確定事実」と「未確定(結果待ち)」を分けて記す。未確認の結果を合格として扱わないこと。

## 1. 作業場所と Git 状態(確定)

- 作業ディレクトリ: `C:\Users\yamashita_y00031\.codex\worktrees\case-comparison\airpocket-simulation-studio`
- ブランチ: `codex/case-comparison`
- 実装・検証対象: `a24aaed5b10cb34e26c565115c5c7179ff05bcea`(push 済み)。引き継ぎ資料・証跡のみを追加した後続コミットがブランチ先頭になる。
- 作業はこの worktree 内で直接行う。

### ルートチェックアウトの扱い(厳守)

- `D:\github\airpocket-soundman\airpocket-simulation-studio` は `main`(`3fc7c97`)。
- ユーザーの未コミット変更が 5 ファイルある:
  - `docs/printed-parts.md`
  - `src/board-strategy.js`
  - `docs/roadmap.md`
  - `docs/en/roadmap.md`
  - `src/progress.json`
- 上書き・破棄・誤ステージ・ブランチ切替は禁止。ルートでは作業しない。
- MOD1 に関するルート側の計画変更は、すでに feature worktree へ反映済み。

## 2. 実装済み内容(確定)

- ケース比較を共通モジュール `src/case-comparison.js` に統合。
  - ブラウザ操作 `caseCompare`
  - MCP ツール `studio_compare_cases`
- カタログ: ブラウザ操作 86 件、既定 MCP 30 件、ペア MCP 32 件。
- 仕様: 保存ケース 1〜8 件、リビジョン/リース、生の単位、明示的なモードとフレーム、同一グローバル点、64KiB 上限。
- ドキュメントと `CASECOMPARISON1` のチェックは追加済み。MOD1 は引き続き待機(queued)。

## 3. 検証結果

### 確定

- 初回フルスイート: 1033 テスト、1029 pass、1 fail、3 skip。
  - 唯一の失敗はツール数の期待値 31 に対し実際 32。修正済みで、関連 6 テストは pass。
- ビルド成功。進捗履歴 152 点、マニフェスト revision は `a24aaed5b10cb34e26c565115c5c7179ff05bcea`。
- ローカル公開チェックのうち、新規追加の保存ケース比較チェックは、実際の WASM/MFEM 保存結果で成功。

### 最終回収結果（Codexで実行・終了確認済み）

- 最終フルスイート: **1033件、1030成功、失敗0、skip 3**、173245 ms、終了コード0。`.qa/case-comparison-full-final.log`。
- ローカル配信物チェック: **28項目すべて成功**、74730 ms、終了コード0。`.qa/case-comparison-published-local.log`。
- 保存済み証跡: `docs/evidence/2026-10-15-case-comparison-local-runtime.json`。これはローカル配信物の検証であり、公開HTTPSサイトの検証結果ではない。
- ビルド: `.qa/case-comparison-build-final.log`。初回失敗・修正結果も `.qa/case-comparison-full.log` / `.qa/case-comparison-corrections.log` に保持。
- 引き渡し時点でCodexが起動した全体テスト・ビルド・配信物検証・Claude委譲は終了。新しい開発処理やブラウザサーバーは起動していない。

## 4. 残作業

1. 本資料と証跡を確認し、ブラウザQAの準備。新しいコミットをビルドする場合は候補revisionが変わるため再検証する。
2. 実機能のブラウザ UI QA。
3. 公開後 QA。
4. Skill 参照の同期(他エージェントが入れた無関係な Skill 更新は保持する)。
5. PR 作成、Codex が使えるなら添付、必須 CI、マージ。
6. 公開デプロイとリリースタグの確認。

## 5. 触れてはいけないもの・制約

- PR7 と PR13 は別担当者の CFD ドラフト作業。変更・マージ・干渉しない。
- main は保護されている。PR 必須、必須 CI は `verify`、最新 main への追従が必要。バイパスや管理者上書きは行わない。
- 既存の公開 HTTPS テスト許可は閲覧(inspect-only)のみ。localhost MCP は `127.0.0.1:63727`。編集・解析へ拡大しない。自前の合成データによるローカル QA とは区別する。
- テストを実行したのは Codex。Claude のコーディング/ドキュメント作業と混同して記録しない。
  - Claude の実利用: feature 48 turns・185s、docs 10 turns・20s、review 8 turns・45s、edit 18 turns・42s、countfix 7 turns・13s。

## 6. 製品方針

- ユーザー自身の LLM を SKILL で専門化させる。独自 AI のサブスクリプションは持たない。
- 差別化の中核は、全 API/MCP、専門 Skill、中間観測。
- MOD1(共有 TypeScript 契約、依存関係、独立した画面/状態、ソルバーアダプタ境界)は、新規物理よりも先に、既存 API/MCP と並行して進める。
- React/WASM は段階的に導入する。全面書き直しをリリースの前提にしない。`docs/roadmap.md` の依存関係に従う。

## 7. 次の最小モジュール化作業(推奨)

1. 限定的な共有型契約と、依存方向チェック。
2. 範囲を絞ったソルバーアダプタと UI 状態の分離。

フォルダ移動だけで MOD1 を完了扱いにしない。

## 8. Claude の起動手順(ユーザーが手動実行)

```powershell
Set-Location 'C:\Users\yamashita_y00031\.codex\worktrees\case-comparison\airpocket-simulation-studio'
claude
```

権限バイパス系のフラグは使わない。

### 最初のプロンプト例

```text
docs/claude-handoff-2026-10-15.md と docs/roadmap.md を読んでください。
その後 git status で作業ツリーを確認し、検証済みコミットと残作業を確認して、ブラウザQA・PR・必須CIから順に進めてください。
ルートチェックアウトには触れず、結果を捏造しないでください。
```
