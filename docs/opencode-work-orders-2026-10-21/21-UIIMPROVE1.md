# 21 UIIMPROVE1 — 次の限定受入単位

## 必読・開始条件

1. [00-COMMON.md](00-COMMON.md) を最初に読み、この指示を実行する。専用 branch/worktree は `codex/opencode-next-21` / `D:/github/airpocket-soundman/studio-opencode-next-21` とする。
2. 実行時に fetch した `origin/main` が前提 PR #126 の commit `452d878a4568812523d2d566c32f153fdfe0df24` を含むことを `git merge-base --is-ancestor 452d878a4568812523d2d566c32f153fdfe0df24 origin/main` で確認する。履歴再編なら対応する公開変更を確認し、判定不能は停止報告。未取り込みなら自分で merge/cherry-pick せず待機する。
3. primary、thermal-compare、他の OpenCode worktree、制作中の別 PR/worktree を編集しない。知らない dirty を消さない。既存実装の再実装はしない。
4. 変更前に対象 source/test を読み、対象ファイル・追加動作・合否条件を短く記録する。下記パスは作成時に存在確認済み。前提 PR の新規ファイルは取り込み後に存在確認する。

## 今回の目的と読む順

requiredPointers の「入力箇所へ」は実装済み。実 Chrome で実際の focus・閉じた details・stale を検証し、そこで見つかった限定的な不具合だけ修正する。

1. `src/ui/analysis-preflight-ui.js`、`tests/ui-analysis-preflight.test.mjs`。
2. `src/main.js` の preflight 配線・対象 control ID（読むだけ）。
3. `src/analysis-preflight.js`、前提 PR の証拠、`docs/automation.md` の正規ブラウザ接続手順。

## 変更範囲

変更可: 上記 UI module/test、今回 evidence と必要な画像。main.js は原則読取のみ。実配線に修正が必須なら具体差を報告して担当調整まで止める。
変更禁止: solver、物理拒否基準、requiredPointers の生成規則、API/tool 件数、制作中の別PR、広いレイアウト改修。

## 番号付き実施と受入

1. localhost の合成入力を用意し、実 preflight が requiredPointers に既知 pointer を返す例を特定する。diagnostics のボタンだけで代用しない。既存材料欠落例で生成できなければ条件不足を報告する。
2. 既知 `/materialProperties/youngModulus` → `mat-youngModulus` 等の実 ID を確認。閉じた材料 details が開き、Tab→Enter で `document.activeElement.id` が対象になることを記録する。
3. 合成値 E=1e9 Pa、mesh size=4 mm を保存し、ボタン前後に値・入力版・条件数が変わらないことを確認する。focus は入力の自動修正ではない。
4. preflight 後に mesh size を 4→5 mm に編集。旧リンクが stale として無効になり、旧 snapshot のまま focus/解析しないことを確認する。再チェック後だけ有効になる。
5. 未知 pointer はボタンなし。disabled/hidden の既知入力へ強制 focus しない。既存 Node fixture の結果と実 Chrome の確認範囲を分ける。
6. 日英・幅390 px でボタンの表示名、キーボード到達、横幅、focus 可視性を記録。完了後も `completePreflight:false` は維持する。

## 対象試験

```powershell
node --test tests/ui-analysis-preflight.test.mjs
npm run check:contracts
git diff --check
```

新しい架空ブラウザ自動化層は作らない。実 Chrome 操作不能なら Node 成功だけでこの受入を完了にしない。

## 証拠・停止・納品

- `docs/evidence/<実行日>-opencode-next-21.json` に base/head、前提確認、コマンド、実測値と単位、pass/fail/skip、ブラウザ版・origin・入力版・未確認を記録する。合成値と実測値を分離し、秘密・pairing code・全環境変数は記録しない。
- source を凍結して実 Chrome を確認する。Node fixture、localhost Chrome、公開 HTTPS は別の検証。ブラウザ機能がなければ未実証とし、必須ブラウザ受入を完了扱いしない。自分の tab/server/probe/接続だけ片付ける。
- 予期しない dirty/競合、前提欠落、保存互換性破壊、非有限値、値不一致、秘密や権限拡張が必要なら関係変更を停止し、再現・安全な成果・必要判断を残す。test skip/閾値緩和/架空証拠で通さない。既知 Node24 V8 fatal はログを短く保存して報告し、runtime を勝手に変更しない。
- `src/progress.json` と共通 docs/Skill は編集禁止。親 UIIMPROVE1 を complete/released にせず、限定受入と残条件の更新文案だけ納品する。
- 最終成果: 動作、変更ファイル、通った対象試験と数値、未確認、証拠、commit/push/PR URL、レビュー箇所。専用 branch のみ commit/push/PR 作成し、自己 merge・force push はしない。

