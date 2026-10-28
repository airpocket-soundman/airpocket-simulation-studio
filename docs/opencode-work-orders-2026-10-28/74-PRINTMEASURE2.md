# 74 PRINTMEASURE2 — 寸法指定ダンベル試験片と条件付き3MFを出力し往復検証する

## 開始条件

[2026-10-23共通指示](../opencode-work-orders-2026-10-23/00-COMMON.md)の書式と規則に従う。基準main `e776ff1dc7f0cf13dfa049dc4d255734f7c55b08`。親PRINTMEASURE2（queued）の最初の有界な一歩だけを実行し、親全体の完成とは区別する。`src/progress.json` は編集しない。

## 前提と読む順

並列の73 PRINTMEASURE1（試験機と測定データ形式）とは試験片ID/寸法/造形方向の記録で接するだけで、試験機・ログ形式には踏み込まない。既存の63 PRINT2の測定dataset取込契約は変更しない。

1. `docs/printed-material-measurement.md`（Bambu用試験片プロジェクト節）
2. `docs/printed-parts.md`、`docs/printed-measurement-dataset.md`
3. `src/print-3mf.js`、`src/print-zip.js`、`tests/print-import.test.mjs`
4. `src/module-layers.json`

## 既に済んだ部分

3MF/.gcode.3mf/G-codeの読込（PRINT1/PRINTAPI1）、測定datasetの取込契約（63 PRINT2）。試験片形状の生成とプロジェクト出力は未実装。

## 実装・検証手順

1. 新module `src/printed-measurement-specimen.js` を `operations` 層へ登録する。外部依存を増やさない。
2. 全寸法（全長、つかみ幅、平行部幅、平行部長、フィレット半径、厚さ）を引数で受け取るダンベル外形を生成する。規格寸法は内蔵しない。出典を確認できない数値を既定値にしない。接線フィレットが成立しない寸法、欠損・余分field、非有限値を拒否する。
3. 造形方向 flat/on-edge/upright を回転として適用し、閉じた外向きmeshをベッド面z=0へ置く。
4. 計画条件（層高さ、壁ループ数、インフィル率とパターン、上下面層数）を版付き試験片ID・形状hash・計画hashと共に `Metadata/airpocket_specimen_plan.json` へ記録したコア3MFを書き出す。温度・材料・プリンター等は利用者が選ぶ項目として列挙し値を持たない。スライス後設定は `null`。
5. 既存 `parsePrint3mf` で再読込し、計画・hash・外形範囲が一致すること、改竄を拒否することを検査する。

## 受け入れ条件

合成寸法（規格値ではない）で、R=5・幅差5の1/4円フィレットの解析体積と生成mesh体積が相対2e-4以内、全方向で閉じた外向きmesh、往復読込で計画とboundsが一致、同一計画で同一bytes、計画/形状改竄を拒否。

## 範囲外・未確認

Bambu `project_settings.config` の生成、Bambu Studioでの実読込・スライス、実機造形、採用設定の照合、UI/MCP接続、規格試験片の寸法表。これらは後続の作業指示とする。

## 対象試験

```text
node --test tests/printed-measurement-specimen.test.mjs tests/print-import.test.mjs tests/module-boundaries.test.mjs
npm run check:contracts
git diff --check
```

## 納品

証拠 `docs/evidence/2026-10-28-opencode-74-printmeasure2.json`。PRで変更・試験・未確認・残る親受入を示す。progressの更新案は納品に添えるのみ。
