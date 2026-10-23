# 印刷材料測定dataset取込契約

[English](en/printed-measurement-dataset.md)

2026-10-23、指示63 PRINT2。`src/printed-measurement-dataset.js` は独立した取込関数であり、画面・MCP・solverへの接続、材料同定、精度保証は未実施。実測は提供されておらず、回帰試験はすべて合成。

`importPrintedMeasurementDataset(rawJson)` は最大2,000,000 UTF-8 byte、100試験片、全片合計10,000 sampleのschemaVersion 1 JSONを受け付ける。正確な入力文字列、SHA-256、normalizationVersion=1を返す。加工済みobjectや利用者申告hashは原データの代わりに受け付けない。生ログが別形式なら、その元ファイルの保管は呼出側の責任であり、このhashはJSON文字列だけのhash。構造は `src/contracts/printed-measurement-dataset.d.ts` と合成fixture `tests/printed-measurement-dataset.test.mjs` を参照。

必須情報はdataset ID/版、synthetic/measured、単位、機器ID/ハード版/ソフト版、校正根拠、試験片ID/3寸法/標点長/単位造形方向/batch/温度/速度/変位測定種別、生の時刻・荷重・変位。寸法順は初期断面の幅・厚さ・試験片長さ。全長より長い標点、重複試験片、欠損・余分なfield、非有限・範囲外、時刻重複を拒否する。寸法の許容範囲等は取込の数値保護上限であり、機器の測定能力や物理的有効範囲を保証しない。

長さmm/m、荷重N/kN、速度mm/sまたはm/sを明示換算し、時間sと温度degCを必要とする。標点変位だけを受け付け、クロスヘッド変位から装置剛性や滑り補正を推定しない。初期断面積による工学応力Pa、標点長による工学ひずみを返す。合成1 N / 1 mm² = 1 MPa、0.1 mm / 10 mm = 0.01を検証する。

校正statusはunverified（根拠は全て明示null）、reported（力・変位・寸法の根拠文字列を全て要求）。reportedも第三者による確認ではなく、accuracyVerifiedは常にfalse。合成入力はreportedを拒否する。校正係数の生成や適用、一般的な物理精度、完全な直交異方性同定は実装しない。

`importPrintedEquivalentDatasets(properties, rawDatasets)` は既存のprintedEquivalent validatorを先に使い、同定dataset、独立検証datasetの順に照合する。既存basisのID/版/試験片集合とbatchが一致し、同定と検証の試験片は別でなければならない。入力propertiesは変更せず、既存schema/旧入力互換と等価・明示構造の二重加算拒否を維持する。合成datasetを紐付けても測定済み・同定済みという新しい保証を付与しない。

残る親受入は実機校正、実測取得、同定と独立片による予測比較、不確かさ評価、GUI/API導線。PRINT2全体の完了や公開を意味しない。
