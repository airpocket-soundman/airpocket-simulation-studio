# 50 BROWSEREXPORT1 — 実3枚PNG ZIPを取得しdecodeする

今回PRの限定成果は採用対象。以下は未検証QAだけを行う追加指示で、親タスク全体の完了を意味しない。

元指示: `../opencode-work-orders-2026-10-21/32-BROWSEREXPORT1.md`。slice参照修正は取り込み済み。実canvas出力の受入だけを行う。

## 読むファイルと試験
- `src/visual-export.js`、`src/visual-export-fixed-frame.js`、`src/visual-export-jobs.js`、`docs/visual-export.md`。
- `node --test tests/visual-export-slice-reference.test.mjs tests/browser-export-session.test.mjs tests/visual-export-fixed-frame.test.mjs`

## 実施と数値入り受入
1. source凍結のbranded Chromeで10×10×40mm棒、E1e9Pa、nu0.3、z0固定、z40へ+Z100N、size5mmを実計算する。
2. 正式MCPと同じresult/viewを選び、入力/ケース/結果/比較の4状態、camera、結果版、meshのX範囲を保存する。
3. 初期sectionはaxisX、位置4mm、無効。expectedResultRevisionを指定してformat=png-sequence、animation=slice、frames3でstartExportする。
4. terminalまで待ち、正式artifact取得経路で全ページを取得する。ZIP全体SHA、STORE entry CRC、各frame SHAを独立再計算する。
5. manifest phase0/0.5/1とslice位置0/5/10mmを実mesh範囲と照合する。単なる初期位置4mmの反復でないことを確認する。
6. 一般decoderでブラウザ由来PNG全3枚をdecodeし、寸法と画素hash/差分を検査する。fake IDATのNodefixtureを実画素証拠にしない。
7. 成功後と取消後の4状態/camera/元section設定が復元され、部分成果物が正常登録されないことを確認する。
8. 実ZIPか再取得可能なartifact記録と秘密なしQAスクリプトを保持する。解読不能ならdecode成功と記載しない。

## 共通条件
- [00-COMMON.md](https://github.com/airpocket-soundman/airpocket-simulation-studio/blob/main/docs/opencode-review-followups-2026-10-21/00-COMMON.md)と元指示を読む。最新origin/mainから専用branch/worktreeを作り、主作業フォルダと他担当を変更しない。
- 今回の取り込みは限定実装の受入。親タスクは未完了。既存修正の再実装はせず、実不具合があれば再現を保存し最小修正/回帰試験だけを別途提案する。
- 正式API/MCPと正規pairingを使い、権限を増やさない。合成モデルのみ。sourceを凍結しHMR resetを混ぜない。
- 原データまたは秘密なし再実行QAスクリプトを保持する。JSONにsourceSHA・Chrome版・origin・実行コマンド・結果版・pass/fail/未実行を記録する。
- 自分のprobe/接続/serverだけcleanup。token/接続code/全環境変数を保存しない。自己merge・force push・progress変更は禁止。
- 検証できない条件は未確認のまま残し、証拠と残条件をPRへ。実行不能を成功や物理精度の保証に置き換えない。
