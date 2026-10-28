# 01 UIIMPROVE1 — requiredPointersにも入力欄への導線を付ける

対象: OpenCode / DeepSeek v4.1 Flash。親全体を完了させる依頼ではない。
最初に[00-COMMON.md](00-COMMON.md)を最後まで読む。作業場所・branch・公開制約は共通指示に従う。
このファイルの受入単位だけを実装する。別タスクへ横展開しない。

## 到達点

preflightのrequiredPointers行にも、既存diagnostics行と同じ「入力箇所へ」buttonを表示する。
既知pointerだけが対象。入力を補完せず、利用者が正しい欄へ移動できる状態にする。
既存diagnosticsの導線、stale無効化、legacy/provisional表示は維持する。

## 読む順序

1. src/ui/analysis-preflight-ui.js 全体。
2. tests/ui-analysis-preflight.test.mjs のdocument/focus fixtureとstale試験。
3. src/main.js のcreateAnalysisPreflightUi呼出しだけ。
4. docs/automation.md の解析前チェック節。
5. docs/evidence/2026-10-19-preflight-gui-spherical-browser.json。

上記パスは指示作成時にthermal-compareで確認済み。作業開始時にrgで再確認する。
現在diagnosticsにはbuttonがあるが、requiredPointersはp要素だけをappendしている。
既実装のパネル全体を作り直さない。

## 変更してよい範囲

- src/ui/analysis-preflight-ui.js。
- tests/ui-analysis-preflight.test.mjs。
- 必要な説明だけdocs/automation.mdとdocs/en/automation.md。
- 新規のsanitized証拠JSON（docs/evidence/配下）。

## 変更禁止

- solver、物理閾値、analysis-preflight.jsのallowed判定、provenanceの確認規則。
- main.jsの無関係な画面、MCP/tool数、別UI、installed Skill。
- 他ownerの変更、親statusのreleased化、タスク追加。

## 実装手順

1. diagnostics行のbutton生成とpointer→control解決を確認する。
2. 必要なら同module内の小さな共通関数に切り出し、両行から使う。
3. requiredPointersにも同じbuttonを付ける。異なるfocus規則を新設しない。
4. 既知の/materialProperties/youngModulusはmat-youngModulusへ移動する。
5. /options/sizeはmesh-sizeへ移動する。
6. 未知pointerにはpointer文字列を残し、架空の入力欄へ飛ばさない。
7. disabled/hiddenの対象は入力を変えず、既存と同じ失敗表示にする。
8. button押下時にも最新snapshotを照合し、古い報告から移動させない。
9. closed detailsは開いてfocusする。keyboardでbuttonを操作できること。
10. 日本語/英語は既存翻訳方式を再利用する。

## 数値を含む受入

- requiredPointers=['/materialProperties/youngModulus','/options/size']で既知導線が2件できる。
- Eの単位はPa、mesh sizeはmm。buttonは値も単位も変換しない。
- mesh-size=0 mmの拒否後、利用者が4 mmへ修正すると旧報告が無効になる。
- 未知pointer1件は表示を保持するが、無効なfocus成功を報告しない。
- diagnostics側の既存buttonも同じ対象へ動き、二重イベントを発火しない。
- preflight実行前後のproject JSONが完全一致する。
- allowed/provisional/completePreflight:falseは同じAPI報告と一致する。

## テスト

既存fixtureを拡張し、requiredPointersだけの報告を最低1件含める。
closed details、未知対象、stale、disabled、言語切替を検査する。

```text
node --test tests/ui-analysis-preflight.test.mjs
```

新しい純実装一致テストを大量に増やさない。上記の利用者操作を検査する。

## 実Chrome

source凍結/no-HMRで、JA/EN、390px幅、Tab/Enter、focus移動と再checkを確認する。
pairing等は共通指示。input/optionsの前後revisionと表示対象IDを記録する。
実機不可ならunit成功と未実機を分け、この受入のChrome完了を主張しない。

## 失敗時

focus先が不明なら勝手なIDを追加せず、pointerと不足対応だけ報告する。
staleや入力改変があれば停止し、原因を直すまで成功扱いしない。
物性や支持を追加してallowedを通すことは禁止。

## 証拠・最終成果

対象pointer、focus先、locale、viewport、入力不変、実機/代替の別をJSONに残す。
UIIMPROVE1はbuildingのまま。171/133/残38の集計をこの単位で変更しない。
共通指示が許可する最新欄だけ更新し、親の6case負担比較は未完と書く。
最終報告は変更ファイル、対象test結果、実Chrome範囲、残条件、差分概要。
