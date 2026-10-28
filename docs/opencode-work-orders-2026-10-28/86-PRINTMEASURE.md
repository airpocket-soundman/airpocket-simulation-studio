# 86 PRINTMEASURE — 試験片3MFの計画と測定datasetの試験片参照を照合する

## 開始条件

[2026-10-23共通指示](../opencode-work-orders-2026-10-23/00-COMMON.md)の書式と規則に従う。基準main `4e9cef7`（73 PRINTMEASURE1、74 PRINTMEASURE2 統合済み）。親PRINTMEASURE1/2（queued）の第2歩だけを実行し、親全体の完成とは区別する。`src/progress.json` は編集しない。

## 前提と読む順

73で試験機プロファイルとdatasetの照合、74で計画条件付きダンベル3MFの書出し・往復読込ができた。datasetの試験片と、それを造形した3MF計画とを結ぶ手段はまだ無い。63 PRINT2のdataset取込契約は変更しない。

1. `docs/opencode-work-orders-2026-10-28/73-PRINTMEASURE1.md`、`74-PRINTMEASURE2.md`
2. `src/printed-measurement-dataset.js`（dimensions[0]×[1]を断面、[2]を長さとして応力を計算）
3. `src/printed-measurement-specimen.js`（`readSpecimen3mf` の record）
4. `src/printed-test-machine-profile.js`（所見を返す照合の書式）

## 実装・検証手順

1. 新module `src/printed-specimen-link.js` を domain 層へ登録し、型 `src/contracts/printed-specimen-link.d.ts` を追加する。
2. 参照表 `{datasetSpecimenId, specimenId, specimenVersion, planSha256}` を dataset とは別入力で受け取る。余分/欠損field、重複参照、重複record、未対応recordを `PRINTED_SPECIMEN_LINK_INVALID` で拒否する。
3. 寸法許容差 `{dimensionMm}` は呼出側必須とし、既定値を持たない。
4. 所見: 参照先dataset試験片なし、未参照試験片、計画欠落、計画hash不一致、断面（平行部幅×厚さ、軸順はどちらも可）不一致、長さ≠平行部長、標点>平行部長、造形方向不一致（flat=厚さ軸、on-edge=幅軸、upright=長さ軸、符号は問わない）。
5. 不一致時に `PRINTED_SPECIMEN_LINK_MISMATCH` で拒否する関数を併設する。

## 受け入れ条件

74の書出し→再読込を通した合成計画（規格値ではない）3方向が、既存取込器を通した合成datasetと所見0。意図的な不一致datasetで8種の所見を返し、拒否関数が投げる。許容差未指定・負・NaN・余分fieldを拒否する。

## 範囲外・未確認

実測寸法の許容差の決定、造形物の実寸測定、スライス後設定の照合、試験機ログとの結合、UI/MCP接続、同定（PRINTMEASURE3）。dataset座標系での造形方向表現は本照合の仮定であり、dataset契約には未記載。

## 対象試験

```text
node --test tests/printed-specimen-link.test.mjs tests/printed-measurement-specimen.test.mjs tests/printed-test-machine-profile.test.mjs tests/printed-measurement-dataset.test.mjs tests/module-boundaries.test.mjs tests/docs.test.mjs
npm run check:contracts
git diff --check
```

## 納品

証拠 `docs/evidence/2026-10-28-opencode-86-printmeasure.json`。progressの更新案は納品に添えるのみ。
