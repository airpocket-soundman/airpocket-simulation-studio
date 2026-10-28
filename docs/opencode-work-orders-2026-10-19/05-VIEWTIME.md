# 05 VIEWTIME — 保存量metadataを既存getResultViewへ有界公開

対象: OpenCode / DeepSeek v4.1 Flash。最初に[00-COMMON.md](00-COMMON.md)を読む。
保存密度・予算のsolver実装をやり直す依頼ではない。

## 到達点

GUIにはsnapshotInfoの保存枚数/bytes表示があるが、getResultViewには有界な保存量要約がない。
既存getResultViewの加算的metadataとして、保存量の意味と限界を返す。
新method/toolは追加しない。物理配列や全steps配列を返さない。

## 読む順序

1. src/time-history-plan.jsとtests/time-history-plan.test.mjs。
2. src/result-view-api.jsのsummary/get。
3. src/result-frames.jsとtests/result-view-api.test.mjs。
4. src/main.jsのtime-history-storage表示だけ。
5. src/browser-operation-view-contracts.jsのgetResultView宣言。
6. docs/evidence/2026-10-18-viewtime-storage.json。

上記パスは実在確認済み。開始時rgで現状を再確認する。

## 変更可能

- src/result-view-api.js。
- 必要な小helperを既存time-history-plan.jsへ追加する場合は検証関数を再利用。
- src/browser-operation-view-contracts.jsのgetResultView説明だけ。
- tests/result-view-api.test.mjs、必要ならtests/time-history-plan.test.mjs。
- docs/automation.md、docs/en/automation.md、Skill result-views参照の関連部分。
- sanitized JSON。型で該当shapeが既に表現されていればその任意fieldだけ整合。

## 変更禁止

- thermal/acoustic計算dt、solver、既定保存密度、予算上限64 MiB。
- snapshotInfoなし旧archiveの拒否、schemaVersionの破壊的変更。
- 全snapshots/steps/warningsの無制限コピー、peak RAMの保証。
- main.jsの新画面、新tool、installed Skill、他ownerファイル。

## 実装手順

1. 戻りfield名はsnapshotStorageとする。既に同名があるなら重複実装せず差を報告。
2. snapshotInfoがある対応結果だけへ任意fieldとして追加する。
3. requested/count/bytes/budgetBytesと単位byteを返す。
4. bytesの意味をstored-scalar-values-only、bytesPerScalar=8として明示する。
5. excludesにobjects/rendering/observations/receiver-traces/peak-memoryを固定記述する。
6. warningsは全本文でなくwarningCount等の有界要約にする。
7. metadataを信頼してコピーせず、既存validateHistoryMetadataの整合検査を使う。
8. 不正metadataを静かに消して成功にせず、明示拒否する。
9. snapshotInfoなし旧結果にはfieldを付けず既存出力互換を守る。
10. detached objectを返し、利用者による戻り値の編集でresultを書換えられないようにする。
11. framesのoffset/limit、storedFrameIndex、thermal state.frameIndex=nullの互換は維持する。
12. docs/契約説明を同時更新する。新しい物理検証成功とは書かない。

## 値・単位付き受入

- 熱94nodes×3frames×8bytes=2256bytes、requested11、budget2400bytesを同値で返す。
- 音響741nodes×7frames×8bytes=41496bytes、budget65536bytesを同値で返す。
- 上記数値に整合する実fixtureを既存testから生成する。架空field数を無理に合わせない。
- 旧resultはsnapshotStorageを持たず、get/set/probeの既存挙動を保つ。
- bytes/count/最終step/time/最終場の改変は既存整合検査で拒否。
- 戻り値を書換えた後の再getで元metadataが保持される。
- frameLimit=0でも保存量要約が得られ、pressure/temperatureの全配列は漏れない。
- get前後のresultRevision/physicalRevisionと入力が不変。

## テスト

```text
node --test tests/result-view-api.test.mjs tests/time-history-plan.test.mjs tests/result-frames.test.mjs
```

必要な型変更があれば共通指示に従いcheck-contract-typesを追加する。
solver全体試験や巨大historyを回す必要はない。

## 実Chrome

正式MCP getResultViewで少なくとも熱1例の有界metadataを読む。
以前の94nodes例を再現できなければ実際のnodes/count/bytesを証拠へ記す。
Node-hosted/unitのみなら実Chrome未実証と明記する。
公開HTTPS/一般形状のpeak RAM保証に拡張しない。

## 失敗・最終成果

既存metadata不整合を見つけたらfieldを捏造せず対象fixtureとpointerを報告する。
予算を増やして拒否回避しない。2frame未満拒否を維持する。
変更、対象test、返却JSON例、bytes算式、旧互換、未実証を提出する。
VIEWTIMEはbuilding。親の精度/peak RAM/公開検証は未完、171/133/残38を維持。
