# 51 VIEWCOMPARE — 実音響GIFと均一delayを照合する

今回PRの限定成果は採用対象。以下は未検証QAだけを行う追加指示で、親タスク全体の完了を意味しない。

元指示: `../opencode-work-orders-2026-10-21/36-VIEWCOMPARE.md`。time/GIF修正は取り込み済み。実Chromeと正式MCPの成果物を確認する。

## 読むファイルと試験
- `src/comparison-time-plan.js`、`src/ui/comparison-gif.js`、`tests/fixtures/comparison-acoustic-time-gif.mjs`、`docs/automation.md`。
- `node --test tests/comparison-acoustic-time-gif.test.mjs tests/comparison-time-plan.test.mjs tests/comparison-gif.test.mjs`

## 実施と数値入り受入
1. source凍結のbranded Chrome/正式MCPで同形状・mesh・境界の実過渡音響2caseを作る。音速343m/s、密度1.2kg/m3、4kHz、pulseWidth0.0001s、duration0.0012s、振幅1Pa/2Paを明示する。
2. GUI/APIで同じ2case、instantPressure、time animationを選ぶ。共通固定色rangeとcameraを保存する。
3. 2秒/24frame/640×320でexportし、正式取得経路で全GIF byteを取得する。manifestの長さ/SHAと一致させる。
4. 一般decoderで全24frameをdecodeし各640×320、均一delay、loop設定を確認する。GIFの10ms刻み量子化を含め、要求2秒と実delay合計の差を記録する。既存仕様と異なる200csを捏造しない。
5. time phase=i/23、先頭0/末尾1、物理時刻0〜0.0012s、各panelはnearest保存frame/interpolated:falseを照合する。
6. 先頭/中間/末尾の画素、1Pa/2Paの値、共通rangeを比較する。表示2秒を物理解時間と呼ばず、cameraやinput/resultを変更して一致させない。
7. 成功/取消前後のinput/result/cases/comparisonとcameraを比較。stale revision、単一時刻、逆転範囲の拒否を確認する。
8. raw GIF、manifest、decode結果と秘密なし再実行QAを保持する。headerだけでdecode/物理精度を合格にしない。

## 共通条件
- [00-COMMON.md](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/main/docs/opencode-review-followups-2026-10-21/00-COMMON.md)と元指示を読む。最新origin/mainから専用branch/worktreeを作り、主作業フォルダと他担当を変更しない。
- 今回の取り込みは限定実装の受入。親タスクは未完了。既存修正の再実装はせず、実不具合があれば再現を保存し最小修正/回帰試験だけを別途提案する。
- 正式API/MCPと正規pairingを使い、権限を増やさない。合成モデルのみ。sourceを凍結しHMR resetを混ぜない。
- 原データまたは秘密なし再実行QAスクリプトを保持する。JSONにsourceSHA・Chrome版・origin・実行コマンド・結果版・pass/fail/未実行を記録する。
- 自分のprobe/接続/serverだけcleanup。token/接続code/全環境変数を保存しない。自己merge・force push・progress変更は禁止。
- 検証できない条件は未確認のまま残し、証拠と残条件をPRへ。実行不能を成功や物理精度の保証に置き換えない。
