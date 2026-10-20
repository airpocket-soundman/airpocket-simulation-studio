# COUPLE3: PR #140 の有限演算overflow拒否

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

- 元PR #140、branch `codex/opencode-couple3`。
- review HEAD `2130a8f12ce262d93d63c3945ea958377f89e6eb`。
- worktree例: `D:/github/airpocket-soundman/studio-opencode-couple3`。
- 読む順: src/planar-heat-transfer.js → tests/planar-heat-transfer.test.mjs → src/triangle-overlap.js。
- 次に src/thermal-contact.js / tests/thermal-contact.test.mjsを確認。共通helper抽出の既存動作を守る。
- 変更可: planar-heat-transfer.jsと対応tests/証拠。共有helper変更が必要ならownerと先に調整。

## 実測した不具合

A=(0,0,0),(1e6,0,0),(0,1e6,0) mm、Bは別nodeで同じ面を逆向き、q=1e308 W/m²。
全入力が有限だがline76–86の積分/累積でsourceW=Infinity、targetW=NaN、balanceErrorW=NaNを成功returnする。
これはguard用の極端な合成入力であり、現実の熱物性/実測モデルとは主張しない。

## 番号付き実装

1. 上記反例を既存test fileに追加し、非有限結果を成功扱いしない受入を固定する。
2. geometryのdifference/cross/norm/area/plane projectionで非有限が生じたら計算を中止する。
3. affine qの評価だけでなくareaM2*q、積分重み、各node累積、source/target合計を検査する。
4. 0*InfinityでNaNが生じる経路も拒否。Number.isFiniteを最終balanceだけへ置く対症療法にしない。
5. covered area、各nodeHeatW、sourceW、targetW、targetOutwardW、balanceErrorWの有限性を最後にも保証。
6. typed errorまたは安定した拒否messageを定義し、呼出元が成功と数値限界を区別できるようにする。
7. 値clamp・NaN→0・Infinity→MAX_VALUE・q縮小で成功させない。
8. 同向normal/欠損/重複/平面ずれ/共有nodeの拒否を維持し、入力非変更を確認する。

## 数値参照・拒否

- 通常10×10 mm、q=1000 W/m² → 0.1 W、absolute balance error≤1e-12 W。
- q(x)=1000+100000*x_m W/m² → 0.15 W、mm→m/面積→m²を一度だけ変換。
- 右三角の既存節点熱量0.020833333333333332/0.020833333333333332/0.025 Wを維持。
- q=1e-9の小合計1e-13 Wと0流束でNaNを作らない。
- 上記1e6 mm/q1e308の積overflow、巨大座標のdifference overflow、有限寄与の累積overflowを拒否。
- 普通の負流束は物理的に逆向きの入力として維持し、overflowと混同して禁止しない。

## targeted commandと限界

`node --test tests/planar-heat-transfer.test.mjs`

`node --test tests/thermal-contact.test.mjs`

- 前者は軽量、後者は実CPU solverを含むため他heavy実行と直列化。review時前者6tests成功。
- 本番CHT/流体移流/温度反復/非平面転送を追加しない。親COUPLE3は未完のまま。

## 停止・納品

- 範囲外の本番接続・一般形状・新solverが必要、既存修正と競合、前提PR不成立なら停止して不足を報告する。
- 修正済みなら重複変更せず、固定HEADと反例の拒否結果を報告する。
- 入力、期待値、実測値、拒否理由、実行command、HEADを小さい日付入りJSONでdocs/evidenceへ記録する。
- 未実行や環境不足をそのまま記す。秘密・巨大trace・ユーザーモデルを証拠へ入れない。
- 納品は変更一覧、targeted結果、未検証境界、残る親受入を短く記載する。親statusの完了昇格は禁止。
