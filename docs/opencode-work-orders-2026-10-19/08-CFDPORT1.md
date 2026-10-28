# CFDPORT1: 三角形表面の限定開口ループ抽出

## 作業前の共通条件

- 最初に [00-COMMON.md](00-COMMON.md) を読み、その作業場所・実行環境・承認条件を守る。
- 対象モデル: OpenCode / DeepSeek v4.1 Flash。曖昧な部分を推測で実装せず、この限定範囲を優先する。
- このファイルは次の実装担当への指示。指示書作成時点で機能が完成したという意味ではない。
- 開始時に branch / HEAD / dirty paths を記録し、既存変更を退避・破棄・上書きしない。
- 以下の既存パスは thermal-compare checkout の読み取りで確認した。実装先で存在と内容を再確認する。
- shared docs / progress / Skill / main.js / package.json / lockfile は本単位の変更対象外。
- 新規 module は src/module-layers.json の所属を確認し、所有者と調整して必要行だけ追加する。
- 認証情報・ユーザーモデル・巨大 trace を証拠へ入れない。commit / push とレビュー用PRは00-COMMONの納品手順に従う。merge・公開は行わない。

## 最初の受入単位

明示半空間 cap の次段として、三角形表面から境界 edge の閉ループを抽出する純粋 module を作る。
対象は有限座標の単一 manifold 管壁表面、平面・凸・非自己交差の各開口だけ。
これは「三角形表面の候補検出」であり STEP/OCC の任意 wire 認識、局所蓋生成、流体結合ではない。
既存 CAD-only 3参照が成功しているため、成功例を増やすだけの fuse / union を追加しない。

## 読む順

1. src/progress.json の CFDPORT1 と docs/internal-fluid.md。
2. src/fluid-opening-caps.js / src/internal-fluid.js / src/fluid-domain.js。
3. tests/internal-fluid-step-connectivity-cad.test.mjs: adjacent-voids / fragmented-shell / six-wall-assembly。
4. tests/fluid-opening-caps.test.mjs / tests/fluid-opening-caps-cad.test.mjs。
5. src/mesh-validity.js: 既存 edge/triangle 検査を重複実装しない。

## 変更範囲

- 追加可: src/opening-loop-candidates.js / tests/opening-loop-candidates.test.mjs。
- 証拠以外の docs、既存 caps/source schema、Gmsh production 経路は変更しない。
- 既存 capped mesh の boundary identity / tetra incidence 検査を弱めない。

## 実装手順

1. 入力を indexed nodes(mm), triangles, 明示 toleranceMm とし、出力契約を module 冒頭に記す。
2. 有向 triangle edge を数え、incidence=1 の境界だけを取り出す。節点を距離だけで勝手に溶接しない。
3. 各境界 vertex の次数が2であることを検証し、決定的順序で閉ループを構成する。
4. 面法線・平面残差・polygon 面積・凸性を計算。法線の物理的 outward は推論せず未確定として返す。
5. 元 triangle/node identity と tolerance、候補平面を返し、呼出元配列を変更しない。
6. source/API/UI に接続せず、利用側が確認する前提の candidate に留める。

## 数値参照と拒否

- 四角管の側壁: x,y=±1 mm、z=0/10 mm。両端 loop は各4点・面積4 mm²、計2個。
- triangle 配列順序や循環開始点を替えても同じ canonical candidate identity。
- toleranceMm=1e-6、平面残差≤1e-6 mm。既知入力の面積誤差≤1e-10 mm²。
- 1頂点だけ z を0.01 mmずらした開口、次数3分岐、edge incidence3、反復頂点を拒否。
- bow-tie polygon、NaN/Infinity、負/0 tolerance、同一座標別IDによる未溶接 seam を成功扱いしない。
- 閉殻は候補0件を返す。境界がある不正形状と区別する。

## targeted 実行と実機境界

`node --test tests/opening-loop-candidates.test.mjs tests/fluid-opening-caps.test.mjs`

- CAD regression 実行可なら `node --test tests/internal-fluid-step-connectivity-cad.test.mjs` を別記録する。
- 純粋 unit は実 STEP wire 抽出の証拠ではない。Chrome/MCP 成功・本番開口閉鎖を主張しない。
- 親 CFDPORT1 は building を維持。任意 wire、局所蓋、一般join、公開 Worker の残条件を保持する。

## 証拠と納品

- 変更ファイル一覧、実行した targeted command、pass/fail、残課題を短い日本語で提出する。
- docs/evidence/ に日付入り小さい JSON を追加。fixture の由来、入力値、単位、期待値、実測誤差、拒否例を残す。
- テスト未実行・dependency 不足・実ブラウザ未確認は、そのまま記載する。mock を実 CAD / solver / Worker の証拠にしない。
- 親タスクは未完を維持する。小単位の成功から status=done / checking / 公開済みへ昇格しない。
- 納品に「今回実装」「未接続」「親に残る条件」を分けて書く。

## 停止条件

- 既存実装が本受入を満たす場合、重複 module を作らず根拠と次の不足を報告する。
- 指定外の物理モデル、一般 CAD、外部 solver 導入、UI/API 本番接続が必要ならそこで止めて設計差分を報告する。
- 数値不一致を tolerance の拡大・fixture の置換・失敗 test の skip で隠さない。
- 環境準備ができない場合は不足を記録し、他 owner の source を改変して突破しない。
