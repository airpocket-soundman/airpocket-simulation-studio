# 73 PRINTMEASURE1 — 試験機の要求仕様と共通機器プロファイル形式

## 開始条件

書式は 10月23日の共通指示（primary checkout `docs/opencode-work-orders-2026-10-23/00-COMMON.md`、本ブランチには無い） に倣う。基準main `e776ff1dc7f0cf13dfa049dc4d255734f7c55b08`。親PRINTMEASURE1（queued、任意）のうち最初の有界な一歩だけを実行し、親全体の完成とは区別する。並行する74 PRINTMEASURE2（試験片・Bambu出力）の出力側には踏み込まない。

## 前提と読む順

前提: 指示63 PRINT2で `src/printed-measurement-dataset.js`（測定dataset取込、instrument/calibration欄あり）が既存。機器自体を記述する形式と、自作機・販売機の共通要求はまだ無い。`docs/roadmap.md` にPRINTMEASURE専用の節は無く、企画書が唯一の仕様源。

1. `docs/printed-material-measurement.md`（「引張と圧縮の測定装置」「段階と未決定事項」）
2. `docs/printed-measurement-dataset.md` と `src/contracts/printed-measurement-dataset.d.ts`
3. `src/progress.json` の PRINTMEASURE1（読むだけ）
4. `src/module-layers.json`（domain層）

## 実装・検証手順

1. 自作機・販売機共通の要求（モード、荷重検出、変位源の区別、装置側停止、装置剛性、校正、識別）と未決定事項を `docs/printed-test-machine.md`（日英）に書く。容量・精度・価格・部品性能は未確定と書き、数値を発明しない。
2. 機器プロファイルschemaVersion 1の純粋validator `src/printed-test-machine-profile.js` と型 `src/contracts/printed-test-machine-profile.d.ts` を追加し、domain層へ登録する。明示単位をN/mm/mm/sへ正規化、装置側停止のみ許可、荷重停止≤定格、各モードに治具、校正/剛性は未検証/報告（根拠必須）、accuracyVerifiedは常にfalse、合成は報告を持てない。
3. 既存dataset正規化結果との照合関数を追加し、ID/版不一致・校正矛盾・標点変位源なし・制限超過・非提供モードを所見として返す。荷重符号（正=引張）は本照合の仮定と明記する。

## 受け入れ条件

合成プロファイル（定格10N、停止5N/20mm/2mm/s — いずれも合成値）が kN/m/(m/s) 表記でも同じ正規化値になる。欠損/余分field、未知単位、ホスト停止、定格超過停止、治具欠落、重複ID、根拠なし報告、合成の報告を `PRINTED_MACHINE_PROFILE_INVALID` で拒否。既存取込器を通した合成datasetが一致プロファイルで所見0、意図的に不一致にしたプロファイルで6種の所見を返す。

## 対象試験

```text
node --test tests/printed-test-machine-profile.test.mjs tests/printed-measurement-dataset.test.mjs tests/module-boundaries.test.mjs tests/docs.test.mjs
npm run check:contracts
git diff --check
```

これらの成功は実機・実校正・実測ログの合格ではない。

## 境界と納品

範囲外: 機械/電気設計図・部品表・ファームウェア、通信方式、GUI/MCP接続、装置剛性補正の適用、試験片とBambu出力（74）、同定（PRINTMEASURE3）。`src/progress.json` は編集しない（更新案を納品に添える）。証拠 `docs/evidence/2026-10-28-opencode-73-printmeasure1.json`。残る親受入: 実機の設計と製作、実校正・装置剛性測定、装置側停止の実証、実測ログでの照合、販売方式の決定。
