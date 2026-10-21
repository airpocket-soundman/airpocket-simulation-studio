# CFDMESH1: 壁層座標計画から限定セル品質検査へ

## 開始条件

- 最初に [00-COMMON.md](00-COMMON.md) を読む。これは OpenCode / DeepSeek v4.1 Flash 向けの限定作業指示。
- sourceの場所、branch、HEAD、`git status --short`を記録する。dirtyなら停止し、既存変更を消さない。
- primary checkoutや別ownerのworktreeで実装しない。実装先を確定するまでsourceは読むだけ。
- 現在のHEADが下記review固定HEADと異なる場合、PR差分・source・testsを再照合し修正済みか判断する。
- 既存module、入力単位、拒否条件を優先し、testだけ通すための閾値緩和やmock置換をしない。
- shared progress / Skill / 他指示書 / package-lock / 本文で許可していないUI/APIは変更しない。

## 前提PRと読む順

- 前提PR #142、review HEAD `ba39088cbf0d7d9fb2bf1d006fe742823660405b`。
- 先にPRのmergeと実装先baseへの取り込みを確認。未mergeなら待機/owner調整し、同moduleを再作成しない。
- PRが更新されていたら差分を再照合。作業branchがdirtyなら停止する。
- src/channel-layer-plan.js / tests/channel-layer-plan.test.mjsを最初に読む。
- src/mesh-validity.js / src/tetra-geometry.js / tests/mesh-validity.test.mjsを読む。
- #142は座標計画だけで追加blockerなし、軽量5tests成功。実mesh/y+/流れは未検証。

## 最初の次段と変更範囲

- 平行平板planと明示長さ/幅から直交直方体セルの幾何品質を検査する純粋moduleを作る。
- 追加候補: src/channel-layer-cell-quality.js / tests/channel-layer-cell-quality.test.mjs。
- 既存planを利用し、mesh-core/Gmsh/worker/solver/GUI/schemaへ接続しない。
- hexの幾何報告であり、Tet4/prism mesh生成・流れ解析対応とは呼ばない。
- 新module層登録はsrc/module-layers.jsonのownerと調整し、必要な行だけ追加する。

## 番号付き実装

1. plan、lengthMm、widthMm、maxAspectRatio、minimumCellHeightMmを明示契約にする。
2. 座標列の有限性、厳密増加、0/gap端点、両壁identityと中央帯の整合を検査する。
3. 隣接y座標ごとに直交セル寸法[length,width,dy]、体積mm³、最短/最長edge、aspect=max/minを返す。
4. 下壁層/中央/上壁層を区別し、元planのwallIdとlayer indexを保持する。
5. 総体積とlength*width*gapを照合し、欠損/重複区間・負体積・非有限演算を拒否する。
6. minimum heightとaspect閾値の超過を具体セルindex付きで拒否し、層を自動削減しない。
7. 入力非変更、決定的順序、JSON roundtripを確認し、品質報告のunitsを保持する。
8. 実Tet4化時に別途必要なorientation/incidence/壁tagの検査を残課題として明記する。

## 数値参照・拒否

- plan: gap10、h0=0.1、r=2、各壁3層。length=2 mm、width=1 mm。
- y=[0,0.1,0.3,0.7,9.3,9.7,9.9,10] mm、セル数7。
- dy=[0.1,0.2,0.4,8.6,0.4,0.2,0.1] mm、体積=[0.2,0.4,0.8,17.2,0.8,0.4,0.2] mm³。
- 総体積20 mm³、相対誤差≤1e-12。最薄層aspect20、中央aspect8.6。
- maxAspectRatio=20で許可、19.9で最薄層を拒否。minimum height0.11 mmでも拒否。
- 0/負length、幅、閾値、重複y/逆順y、末端9.99 mm、wallId改変、NaN/Infinityを拒否。
- 有限値の積overflowを拒否。品質報告をGmsh実要素の品質と混同しない。

## targeted command・実機境界

`node --test tests/channel-layer-cell-quality.test.mjs tests/channel-layer-plan.test.mjs`

- Chrome、実Gmsh、流れ/壁せん断/y+はこの単位では不要。未検証を成功へ昇格しない。
- 親CFDMESH1は未完。実境界層生成と境界条件対応・収束精度は残す。

## 停止・納品

- 範囲外の本番接続・一般形状・新solverが必要、既存修正と競合、前提PR不成立なら停止して不足を報告する。
- 修正済みなら重複変更せず、固定HEADと反例の拒否結果を報告する。
- 入力、期待値、実測値、拒否理由、実行command、HEADを小さい日付入りJSONでdocs/evidenceへ記録する。
- 未実行や環境不足をそのまま記す。秘密・巨大trace・ユーザーモデルを証拠へ入れない。
- 納品は変更一覧、targeted結果、未検証境界、残る親受入を短く記載する。親statusの完了昇格は禁止。
