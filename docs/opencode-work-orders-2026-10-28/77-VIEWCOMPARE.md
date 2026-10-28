# 77 VIEWCOMPARE — 比較変形GIFのframe別倍率ledger

## 前提・読む順
1. [00-COMMON.md](../opencode-work-orders-2026-10-23/00-COMMON.md)。専用treeは最新origin/main（`036c2e7078a6eccfefdd3dae372b0eade7bda5ff`）から作る。
2. `src/progress.json` のVIEWCOMPARE受入と2026-10-24 lastUpdate。review #173の残り（中間panel時刻の個別manifest記録・一般形状・MP4）。
3. 時刻比較のframe ledgerは既に実装済み：`src/comparison-frame-timing.js`、`tests/comparison-frame-timing.test.mjs`。二重実装しない。
4. `src/comparison-deformation-plan.js`、`src/comparison-export-adapter.js`、`src/visual-export-jobs.js`（manifest組立）。

## 今回の単位
比較GIFの `animation:'deformation'` だけ、manifestに方針（`phasePolicy:'i/23'`）しかなく、各encoded frameで実際に描いた表示倍率の記録がない。
24 frameごとに `renderIndex/phase/deformScale` を `manifest.time.deformationFrames` へ保存し、線形計画（0→endScale、終端は厳密にendScale）と一致しない場合は成果物を公開せず失敗にする。
変形は表示倍率だけで、保存変位・応力値・荷重履歴は変えない。実時間WebM変形は1対1対応しないため対象外（ledgerなし）。

## 変更してよい場所
- `src/comparison-deformation-plan.js`：ledger生成関数を追加。
- `src/comparison-export-adapter.js`、`src/visual-export-jobs.js`：GIF変形時だけledgerを接続・検査。
- `tests/comparison-deformation-frames.test.mjs`：新規焦点試験。
- `docs/evidence/2026-10-28-opencode-77-viewcompare.json`。

## 変更しない
`src/progress.json`、roadmap、main.js、VIEWTIME関連ファイル、既存time ledger契約。

## 合否
- 24 entry、`phase===i/23`、`deformScale` が実renderに渡した値と一致、先頭0・終端endScale。
- phaseを改変したencoderは `failed` となり artifact なし、host lock解放。
- WebM変形はledgerなしで従来どおり完了。
- 返却manifestの改変が保持ledgerへ波及しない。入力配列不変。
- 焦点試験、`npm run check:contracts`、`git diff --check`、localhost内蔵ブラウザでAPI経由の比較変形GIF manifestを確認。

## 残る親受入
熱/異軸の固定WebM実画面、single-view終端、実download完了、録画中切断、MP4、公開。
