# CFDMESH1: 平行平板の壁面層配置計画

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

一般3D境界層 mesher の前段として、平行平板の両壁からの層厚配置と品質拒否を純粋 module で実装する。
出力は「座標計画」であり、実 Gmsh prism/tet mesh、流れ解析、y+ 保証とは呼ばない。

## 読む順

1. src/progress.json の CFDMESH1、docs/internal-fluid.md。
2. src/mesh-core.js / src/mesh-validity.js / src/tetra-geometry.js。
3. src/internal-stokes-boundary.js / tests/internal-stokes-boundary.test.mjs。
4. tests/fluid-domain.test.mjs / tests/stokes.test.mjs: 本番流体の対応範囲を確認。

## 変更範囲

- 追加可: src/channel-layer-plan.js / tests/channel-layer-plan.test.mjs。
- mesh-core、solver、study schema、worker、GUI の生成オプションを変更しない。
- 既存 quality 閾値や要素上限を下げて layer を通さない。

## 実装手順

1. gapMm / firstHeightMm / growthRatio / layersPerWall / maxLayers を明示契約にする。
2. h_i=h0*r^i、片側厚さ=sum(h_i) を overflow に注意して計算する。
3. 下壁0からと上壁gapからの座標を作り、中央の未層領域を明示する。
4. 両壁層が接触/交差するときは削減や正規化せず拒否する。
5. 各層厚と壁ID、両壁からの距離、中央幅、総枚数を返す。mm 以外への暗黙変換禁止。
6. 座標は厳密増加し、端点0/gapを保持。入力を変更しない。
7. 将来mesh化する際に必要な壁tag保持・tet反転検査をコメントに残すが、この単位では未接続。

## 数値参照と拒否

- gap=10 mm、h0=0.1 mm、r=2、n=3 → 各壁0.1/0.2/0.4 mm、片側0.7 mm、中央8.6 mm。
- gap=2 mm、h0=0.1 mm、r=1、n=3 → 片側0.3 mm、中央1.4 mm。
- 既知値の絶対誤差≤1e-12 mm、mirror symmetry の誤差≤1e-12 mm。
- gap=1 mm、h0=0.2 mm、r=2、n=2 は片側0.6 mmなので重なりを拒否。
- gap=1 mm、h0=0.25 mm、r=1、n=2 は中央幅0で拒否。
- NaN/Infinity、gap/h0≤0、r<1、非整数/0層、maxLayers超過、指数overflowを拒否。
- 数値限界で隣接座標が同値になる例も拒否。隠れて極薄層を捨てない。

## targeted 実行と実機境界

`node --test tests/channel-layer-plan.test.mjs tests/internal-stokes-boundary.test.mjs`

- 実 Gmsh 生成・wall mapping・quality・solver 精度はこの unit の証拠外。
- UI に選択肢を増やさない。y+ は壁せん断と粘性などの根拠がないため計算しない。
- 親 CFDMESH1 queued を維持し、局所計画 module の実装だけを報告する。

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
