# RESULTCURVE1: 実線形棒結果から版付き段階表を作る

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

実 solveElastic の結果から軸方向反力/標点変位/工学SSを抽出する純粋moduleと版付き段階JSONを作る。
今回は線形弾性の独立solveだけ。静止グラフUI/API/MCP/CSV/履歴保存は次単位へ残す。
最終結果の表示倍率を掛けて物理段階を捏造しない。独立solveを塑性履歴と呼ばない。

## 読む順

1. docs/roadmap.md の RESULTCURVE1節 / src/progress.json。
2. src/fem-core.js / tests/elastic.test.mjs の axial bar reference。
3. src/plasticity-core.js の history: 現在各段階に変位/反力が揃わないことを確認する。
4. src/result-view-api.js / src/project-revision.js / src/cases.js。
5. src/observation-profiles.js / tests/nonlinear-observation-profiles.test.mjs。

## 変更範囲

- 追加可: src/increment-curve-data.js / tests/increment-curve-data.test.mjs。
- 既存solverの物理結果や塑性history形式、archive/API/MCP/GUIを変更しない。
- project revision の既存hash方式を利用し、独自にhash文字列を偽造しない。

## 実装手順

1. axis(unit vector)、initialGaugeLengthMm、initialAreaMm2、loaded/fixed/gauge node IDsを明示入力にする。
2. 実resultのdisplacementとconstraint reactionsから、反力合計Nと標点の軸方向伸びmmを集計する。
3. 複数節点の標点は明示重み（和1）を要求し、最大変位へ自動置換しない。
4. tensileForceNの符号を定義し、engineeringStressPa=forceN/(areaMm2*1e-6)。
5. engineeringStrain=extensionMm/gaugeLengthMm。true stress/strain は出力しない。
6. schemaVersion、入力/結果revision、case/step identity、controlled quantity、units、converged/provisionalを保持。
7. independent-linear-solves と明示した段階表を構成し、異なる材料/形状/ゲージの行混在を拒否する。
8. failed段階は状態だけ記録し数値null、後続へ補間しない。immutable入力とJSON roundtripを検証。

## 数値参照と拒否

- 既存棒: 10×10×40 mm、E=1e9 Pa、nu=0、A=100 mm²、L=40 mm。
- 実CPU solveをF=0/25/50/100/50/0 Nで個別実行し、面積重みのtractionを使う。
- F=100 N → extension=0.04 mm、stress=1e6 Pa、strain=0.001、support reaction=-100 N。
- 相対誤差≤1e-6、力釣合い絶対誤差≤1e-5 N。戻り50 Nは0.02 mm、終端0は0 mm。
- この往復は線形の同一路線であり、塑性ヒステリシスを主張しない。
- 面積/長さ≤0、非unit軸、範囲外/重複node、重み不整合、非有限結果、revision欠落を拒否。
- maxVonMisesPa/maxDisplacementMmのみの入力、modal正規化結果、historyのみのJ2出力を拒否。
- 最大値をゲージSSへ置換するfallbackは作らない。

## targeted 実行と実機境界

`node --test tests/increment-curve-data.test.mjs tests/elastic.test.mjs`

- Gmsh/WASM生成artifactが未準備なら共通手順に従い不足を明示。mock結果を実棒solveとしない。
- Chrome/API/MCP/保存互換/静止描画の一致は次単位。親 RESULTCURVE1 queued を維持する。

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
