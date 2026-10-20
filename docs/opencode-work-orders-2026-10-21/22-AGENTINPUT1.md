# 22 AGENTINPUT1 — 次の限定受入単位

## 必読・開始条件

1. [00-COMMON.md](00-COMMON.md) を最初に読み、この指示を実行する。専用 branch/worktree は `codex/opencode-next-22` / `D:/github/airpocket-soundman/studio-opencode-next-22` とする。
2. 実行時に fetch した `origin/main` が前提 PR #127 の commit `26b97a9433c64481ac70b1c5dfd3b014f9a5eec4` を含むことを `git merge-base --is-ancestor 26b97a9433c64481ac70b1c5dfd3b014f9a5eec4 origin/main` で確認する。履歴再編なら対応する公開変更を確認し、判定不能は停止報告。未取り込みなら自分で merge/cherry-pick せず待機する。
3. primary、thermal-compare、他の OpenCode worktree、制作中の別 PR/worktree を編集しない。知らない dirty を消さない。既存実装の再実装はしない。
4. 変更前に対象 source/test を読み、対象ファイル・追加動作・合否条件を短く記録する。下記パスは作成時に存在確認済み。前提 PR の新規ファイルは取り込み後に存在確認する。

## 今回の目的と読む順

3成分 E の単位警告は実装済み。次は各警告から正しい既存入力/案内へ辿れることを限定実装する。新たな物理閾値は作らない。

1. `src/preflight-unit-magnitude.js`、`tests/preflight-unit-magnitude.test.mjs`。
2. `src/ui/analysis-preflight-ui.js`、`tests/ui-analysis-preflight.test.mjs`。
3. `src/ui/material-form-ui.js`、`tests/ui-material-form.test.mjs`、main.js の material markup（読取）。

## 重要な現状と変更範囲

作成時の material-form は orthotropic を保持・状態表示するが専用3成分編集欄はない。`material-dependence` は別の dependence JSON であり代用禁止。isotropic E 欄にも誘導しない。
変更可: preflight UI module/test、必要最小の material-form の案内/test、evidence。
main.js/i18n・新しい3成分 GUI・solver・物性保存形式・警告の既存 Pa 範囲は変更禁止。追加 UI が不可欠なら担当調整を報告する。

## 番号付き実装と受入

1. 実行時に `youngModuliPa/0,1,2` の既存編集欄の有無を調べる。正しい欄があればその実 ID だけを個別 mapping に使う。
2. 欄がない現状なら、3 pointer を既存 `material-status` の案内へ誘導する限定動作とする。「専用編集欄は未実装、API/保存入力で該当成分を確認」と明示し、「成分編集欄へ移動済み」と偽らない。既存 focus helper で親 details を開く。
3. 合成 E=[210,220,230] Pa で3警告と index 0/1/2 を確認。各ボタンが正しい対象/案内へ1回 focus し、配列・値・入力版を変えないことを test。
4. E=[1e9,2e9,3e9] Pa でこの警告なし。せん断弾性率・Poisson 比へ流用しない。既存 warning-only と不正物性拒否を維持する。
5. stale、disabled/hidden、未知 index 3 を試験。prefix 一括 mapping で任意 subtree を正当化しない。
6. 実 Chrome で APIから合成 orthotropic 入力→preflight→ボタンを確認。日英の案内と activeElement を記録。専用編集 GUI 未実装を証拠/残条件に残す。

## 対象試験

```powershell
node --test tests/preflight-unit-magnitude.test.mjs tests/ui-analysis-preflight.test.mjs tests/ui-material-form.test.mjs
npm run check:contracts
git diff --check
```

3成分の GUI 編集完了とは呼ばない。正しい既存欄/案内を用意できなければ停止報告する。

## 証拠・停止・納品

- `docs/evidence/<実行日>-opencode-next-22.json` に base/head、前提確認、コマンド、実測値と単位、pass/fail/skip、ブラウザ版・origin・入力版・未確認を記録する。合成値と実測値を分離し、秘密・pairing code・全環境変数は記録しない。
- source を凍結して実 Chrome を確認する。Node fixture、localhost Chrome、公開 HTTPS は別の検証。ブラウザ機能がなければ未実証とし、必須ブラウザ受入を完了扱いしない。自分の tab/server/probe/接続だけ片付ける。
- 予期しない dirty/競合、前提欠落、保存互換性破壊、非有限値、値不一致、秘密や権限拡張が必要なら関係変更を停止し、再現・安全な成果・必要判断を残す。test skip/閾値緩和/架空証拠で通さない。既知 Node24 V8 fatal はログを短く保存して報告し、runtime を勝手に変更しない。
- `src/progress.json` と共通 docs/Skill は編集禁止。親 AGENTINPUT1 を complete/released にせず、限定受入と残条件の更新文案だけ納品する。
- 最終成果: 動作、変更ファイル、通った対象試験と数値、未確認、証拠、commit/push/PR URL、レビュー箇所。専用 branch のみ commit/push/PR 作成し、自己 merge・force push はしない。

