# CFDPORT1: PR #139 の誤閉殻・非凸candidate拒否

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

- 元PR #139、branch `codex/opencode-cfdport1`。
- review HEAD `d7b568dc53b936bd52f5e95fddb7afe95a76f4e8`。
- worktree例: `D:/github/airpocket-soundman/studio-opencode-cfdport1`。
- 読む順: src/opening-loop-candidates.js → tests/opening-loop-candidates.test.mjs → src/mesh-validity.js。
- 比較参照: src/fluid-opening-caps.js / tests/internal-fluid-step-connectivity-cad.test.mjs。
- 変更可: opening-loop-candidates.js、対応testsと証拠。既存cap/OCC/mesh/schema/UIは変更不可。

## 実測した不具合

nodes=[0,0,0,1,0,0,0,1,0] mm、triangles=[[0,1,2],[0,1,2]]、toleranceMm=1e-6を渡すと
boundaryEdgeCount=0、closedShell=true、rejected=[]になった。2枚の重複面は正常な閉殻ではない。
またXY=[(0,0),(2,0),(1,1),(2,2),(0,2)]、apex=(1,1,1)の5側面で、面積3 mm²の非凸loopが
convex:falseのcandidateとして返り、rejectedは空だった。限定受入では非凸を候補成功にしない。

## 番号付き実装

1. unordered vertex tripleで重複faceを検査し、同向/逆向きduplicateを区別して拒否する。
2. 各edgeの有向incidenceを保持し、通常の内部edgeが反対方向2本であることを検査する。
3. count=2という事実だけで閉殻にしない。退化triangleと方向矛盾を先に拒否する。
4. closedShellはboundaryなしに加え、対象componentのmanifold/向き/面の健全性が成立した場合のみtrue。
5. 不正面があるcomponentから正常候補を捏造しない。全体拒否かcomponent別拒否かを契約へ明記する。
6. 非凸loopはrejectedへ移し、候補には平面凸・非自己交差だけを残す。
7. 接触/collinear overlapを含むpolygon不正例と、平面残差の既存拒否を確認する。
8. canonical cycleと元node/triangle identityを保持。座標近接による自動溶接は禁止。
9. outward='undetermined'を維持し、単位法線の物理的向きを推論しない。

## 受入・拒否

- 既存四角管x,y=±1、z=0/10 mmは候補2個・各4点・面積4 mm²、元配列非変更。
- 正常tetra閉殻はcandidate0/rejected0/closedShell=true。
- 同向duplicate2枚、逆向きduplicate2枚、共有edge同向、collinear triangleを明示拒否。
- 上記非凸5点はcandidateに残さず、非凸codeを返す。
- 全triangle向きを反転した正常管も候補geometryは同じ。triangle順序変更でもcanonical IDを保持。
- toleranceMm=1e-6、既存非平面0.01 mm・seam・branch・bow-tie拒否を維持。

## targeted commandと限界

`node --test tests/opening-loop-candidates.test.mjs`

- reviewでは既存6tests成功。新反例を追加し、既存成功だけで修正完了にしない。
- STEP wire/局所蓋/一般join/実Workerへ接続しない。既存3CAD参照の成功を新fuseの理由にしない。
- 親CFDPORT1のbuilding/未完範囲を維持し、候補検出moduleの修正だけ報告する。

## 停止・納品

- 範囲外の本番接続・一般形状・新solverが必要、既存修正と競合、前提PR不成立なら停止して不足を報告する。
- 修正済みなら重複変更せず、固定HEADと反例の拒否結果を報告する。
- 入力、期待値、実測値、拒否理由、実行command、HEADを小さい日付入りJSONでdocs/evidenceへ記録する。
- 未実行や環境不足をそのまま記す。秘密・巨大trace・ユーザーモデルを証拠へ入れない。
- 納品は変更一覧、targeted結果、未検証境界、残る親受入を短く記載する。親statusの完了昇格は禁止。
