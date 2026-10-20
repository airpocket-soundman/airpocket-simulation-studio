# BROWSEREXPORT1: 実Chromeでslice 3フレームを検証

## 開始条件

- 最初に [00-COMMON.md](00-COMMON.md) を読む。これは OpenCode / DeepSeek v4.1 Flash 向けの限定作業指示。
- sourceの場所、branch、HEAD、`git status --short`を記録する。dirtyなら停止し、既存変更を消さない。
- primary checkoutや別ownerのworktreeで実装しない。実装先を確定するまでsourceは読むだけ。
- 現在のHEADが下記review固定HEADと異なる場合、PR差分・source・testsを再照合し修正済みか判断する。
- 既存module、入力単位、拒否条件を優先し、testだけ通すための閾値緩和やmock置換をしない。
- shared progress / Skill / 他指示書 / package-lock / 本文で許可していないUI/APIは変更しない。

## 前提PRと読む順

- 前提PR #138、review HEAD `0c7f75e3e05f1d2e9a12d375a7d5dc0157a560d3`。
- PRのmergeと実装先baseへの取り込みを確認。未merge/更新差分/dirtyなら先にownerと調整する。
- tests/visual-export-slice-reference.test.mjs → docs/visual-export.md → 元PR evidence JSONを読む。
- src/visual-export.js / src/visual-export-fixed-frame.js / src/visual-export-jobs.js。
- tests/browser-export-session.test.mjs / tests/visual-export-fixed-frame.test.mjs。
- 利用可能なbrowser/Studio MCP toolsを実際にdiscover。airpocket-studio Skillのbrowser-session手順も読む。

## 最初の次段と変更範囲

- 元PRはNode unit/helperだけ。今回、実Chromeのcanvasから3枚を生成し実PNG decodeで検証する。
- 追加対象はdocs/evidenceの日付入りJSONと必要最小PNG、再実行用の秘密を含まないQA script。
- 既存sourceに欠陥が見つかれば一旦止めて報告。承認なしでsource修正・新UI/formatを追加しない。
- ブラウザ操作は環境の正式browser API、製品操作は発見したsemantic API/MCPを優先する。

## 番号付き実施

1. 自己所有localhost devを起動、sourceを固定。HMRによるresetと正式検証を混ぜない。
2. 10×10×40 mm棒、E=1e9 Pa、nu=0.3、z=0固定、z=40へ+Z100 N、size5 mmの実結果を準備する。
3. 実solverの結果版・mesh軸範囲・暫定性を記録。既存保存結果を使うなら再計算の有無を明示する。
4. 自己所有local接続を正規pairing手順で準備。scopeは共通承認範囲だけ、拡張が必要なら停止。
5. 初期の入力/ケース/結果表示/比較設定の4状態を取得し、section位置4 mm・axisX・section無効を記録。
6. startExportをformat=png-sequence、animation=slice、frames=3、現在expectedResultRevisionで開始。
7. terminalまで待ち、artifact全ページ取得。全ZIP SHA、STORE entry CRC、frame SHAを独立に再計算する。
8. manifestのphase0/0.5/1、slicePosition0/5/10 mmと実PNGの寸法・画像差を照合する。
9. ブラウザ由来PNGを一般decoderで全3枚decodeし、画素hashを比較。fake IDAT試験タグを使わない。
10. 完了後4状態が初期状態へ復元されること、断面/カメラ/controlsが戻ることを確認する。
11. GUIまたは許可済APIで別slice出力を取消し、terminal cancelled・partial artifact拒否・復元を確認。
12. 不正frames=1、png-sequence+seconds、stale版を拒否することを確認する。
13. 自己所有job/transferをrelease、接続失効、一時secret削除、tab/dev/MCP停止まで記録する。

## 受入・拒否・証拠限界

- PNG枚数3、指定軸Xの0/5/10 mm、Zで行うなら0/20/40 mmと区別。単位mmを証拠へ明記。
- 画像寸法は実canvas値を測る。unitの320×316を実Chrome期待値として固定しない。
- 同じ凍結状態・localeでの再出力同一性を調べ、caption/物理版の差を物理精度差と呼ばない。
- 3枚が同画素なら原因を調べる。metadataの位置違いだけで実画像差を合格にしない。
- browser操作不可/decoder不在/配布artifact不足ならその不足を報告し、Node mockを代替証拠にしない。
- 120枚/4MiB/24MiB境界、一般形状、publicHTTPS、OS download完了は未検証を維持する。

## targeted command・実機境界

`node --test tests/visual-export-slice-reference.test.mjs tests/visual-export-fixed-frame.test.mjs tests/browser-export-session.test.mjs`

- 上記は元PRのbaseline確認。実Chromeの手順・実行環境は別JSONに記録し、Node test passと区別する。
- pairing codeをstdout/URL/ログ/証拠へ出さない。公開サイトや他user tabへ接続しない。
- 親BROWSEREXPORT1は未完のまま。小規模localhostの受入だけを報告する。

## 停止・納品

- 範囲外の本番接続・一般形状・新solverが必要、既存修正と競合、前提PR不成立なら停止して不足を報告する。
- 修正済みなら重複変更せず、固定HEADと反例の拒否結果を報告する。
- 入力、期待値、実測値、拒否理由、実行command、HEADを小さい日付入りJSONでdocs/evidenceへ記録する。
- 未実行や環境不足をそのまま記す。秘密・巨大trace・ユーザーモデルを証拠へ入れない。
- 納品は変更一覧、targeted結果、未検証境界、残る親受入を短く記載する。親statusの完了昇格は禁止。
