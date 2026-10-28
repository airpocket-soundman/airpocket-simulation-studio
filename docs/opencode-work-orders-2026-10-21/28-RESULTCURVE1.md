# RESULTCURVE1: PR #134 の制御値と結果identity整合

## 開始条件

- 最初に [00-COMMON.md](00-COMMON.md) を読む。これは OpenCode / DeepSeek v4.1 Flash 向けの限定作業指示。
- sourceの場所、branch、HEAD、`git status --short`を記録する。dirtyなら停止し、既存変更を消さない。
- primary checkoutや別ownerのworktreeで実装しない。実装先を確定するまでsourceは読むだけ。
- 現在のHEADが下記review固定HEADと異なる場合、PR差分・source・testsを再照合し修正済みか判断する。
- 既存module、入力単位、拒否条件を優先し、testだけ通すための閾値緩和やmock置換をしない。
- shared progress / Skill / 他指示書 / package-lock / 本文で許可していないUI/APIは変更しない。

## 元PRの修正先

- これは元PRのblocker修正。新しい重複PRを作らず、元PRの最新headから作成した自分専用の修正branch/worktreeを使う。
- origin/mainに未mergeで対象moduleがない場合、別名moduleを作らず、共通指示の修正用worktreeを作成するか、変更ownerと調整する。
- 元PRbranchを共有中なら先にownerと担当範囲を確認する。dirty/HEAD不一致をreset・cherry-pickで強制解消しない。
- 修正commit/pushとPR更新は共通の承認・所有ルールに従う。mergeや親タスク完了の判断は別担当。

## 固定した出発点

- 元PR #134、branch `codex/opencode-resultcurve1`。
- review HEAD `68687a675e4c9f63ff305980852ef331fdc7f207`。
- worktree例: `D:/github/airpocket-soundman/studio-opencode-resultcurve1`。
- 読む順: src/increment-curve-data.js → tests/increment-curve-data.test.mjs → src/project-revision.js。
- 次に src/fem-core.js / tests/elastic.test.mjs / docs/roadmap.mdのRESULTCURVE1を読む。
- 変更可: increment-curve-data.js、対応tests、元PR証拠。solver物理/UI/API/MCP/schema本体は変更不可。

## 実測した不具合

buildIncrementCurveはcontrolledValue=999 Nと、appliedAxis=100 N、reactionAxis=-100 N、extension=0.04 mmの
resultをstatus=convergedとして受理した（guard用合成結果による反例、実solver再計算の主張ではない）。
line160–173は自己申告rowIdentityと力釣合いしか確認せず、制御値や実入力との対応を保証しない。
現在inputRevisionはspec.inputだけから生成され、step.resultとの出所関係がない。

## 番号付き実装

1. 入力仕様を整理し、各stepを実outputのinput/mesh/result/calculationと結び付ける最小契約を決める。
2. input/結果revisionは既存canonical hashから導出。callerが渡したhash文字列だけを信用しない。
3. 荷重段階で変わる条件と不変の形状/材料/ゲージを分け、実内容から互換性を検査する。
4. rowIdentityラベルが同じでも異なる材料E/mesh/node-order/gaugeの結果を混ぜたら拒否する。
5. force制御ではcontrolledValueと実applied軸力/定義した合力を照合する。符号と許容誤差Nを明示。
6. displacement制御は実指定変位・節点反力の確認ができる場合だけ許可。未対応なら明示拒否する。
7. gaugeの初期位置/軸/長さとmeshを照合し、宣言nodeCountだけの一致を安全性の代わりにしない。
8. failed段階の数値null、非補間、independent-linear-solves/plasticHistory:falseを保持する。
9. 従来の正規参照結果を新契約へ移し、JSON roundtripと入力非変更を確認する。

## 数値参照・拒否

- 棒10×10×40 mm、E=1e9 Pa、nu=0、A=100 mm²、L=40 mm。
- 実solveElasticのF=0/25/50/100/50/0 Nを使い、100 N時0.04 mm、1e6 Pa、strain0.001、反力-100 N。
- 正規誤差は既存参照の相対1e-6、力釣合い絶対1e-5 Nを維持。無根拠に緩和しない。
- 100 Nの実結果に999 Nと記した行、Eを2e9 Paへ替え同ラベルを使った結果、node順入替を拒否。
- 不正revision、欠落output input、modal/J2/最大値だけの結果を拒否。独立solveを塑性履歴にしない。
- 対応しないdisplacement制御は成功のcontrolledUnit=mmを付けて通さない。

## targeted commandと限界

`node --test tests/increment-curve-data.test.mjs tests/elastic.test.mjs`

- Gmsh/実solverを使うため他heavy実行と直列化。artifact不足は共通準備手順へ戻す。
- GUI/API/MCP/CSV/静止グラフ/保存archive統合は追加しない。親RESULTCURVE1は未完。

## 停止・納品

- 範囲外の本番接続・一般形状・新solverが必要、既存修正と競合、前提PR不成立なら停止して不足を報告する。
- 修正済みなら重複変更せず、固定HEADと反例の拒否結果を報告する。
- 入力、期待値、実測値、拒否理由、実行command、HEADを小さい日付入りJSONでdocs/evidenceへ記録する。
- 未実行や環境不足をそのまま記す。秘密・巨大trace・ユーザーモデルを証拠へ入れない。
- 納品は変更一覧、targeted結果、未検証境界、残る親受入を短く記載する。親statusの完了昇格は禁止。
