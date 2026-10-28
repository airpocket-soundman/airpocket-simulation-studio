# COUPLE3: 非一致平面間の保守的熱流転送

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

固体/流体の本番連成前に、重なる非一致平面三角形間の熱流転送演算子を純粋 module で実装する。
既存 thermalContactEntries の重なり積分を調べ、再利用可能なら小さな共通幾何 helper だけ抽出する。
熱接触の係数行列と熱流転送を混同しない。流体移流 solver が完成したとは扱わない。

## 読む順

1. src/progress.json の COUPLE3。
2. src/thermal-contact.js / tests/thermal-contact.test.mjs。
3. src/temperature-transfer.js / src/thermal-core.js。
4. src/fluid-input-contract.js / src/stokes-study.js: 既存流れ solver に熱移流を捏造しない。

## 変更範囲

- 追加可: src/planar-heat-transfer.js / tests/planar-heat-transfer.test.mjs。
- 抽出が必要な場合だけ thermal-contact.js と既存 test の互換確認を含める。
- thermal/stokes production solve、input schema、MCP/GUI、連成statusは変更しない。

## 実装手順

1. A/Bの別節点平面mesh、Aの一定/線形熱流密度 W/m²、明示面向きとtoleranceMmを受け取る。
2. overlap 面積と線形 shape function を積分し、Bの節点熱入力 W を作る。
3. A outward 正と B inward 正の符号規約を記述し、双方の外向き量なら和0となるよう扱う。
4. mm²→m²は1e-6だけ一度適用。nodal W を W/m² と表示しない。
5. covered area / sourceW / targetW / balanceErrorW を返す。
6. 未被覆・重複被覆は拒否し、最寄り点で穴を埋めない。入力を変更しない。
7. 定数/線形場の解析積分を unit で照合し、温度連成反復は実装しない。

## 数値参照と拒否

- 10×10 mm の一致領域。Aは対角線2三角、Bは中央点を含む4三角の非一致分割。
- q=1000 W/m² → source=target=0.1 W。絶対balance誤差≤1e-12 W。
- xはmとして q(x)=1000+100000*x W/m²、x=0..0.01 m → 平均1500、総0.15 W。
- 両側outwardとして記録すると Q_A=+0.15 W / Q_B=-0.15 W。
- 反対の面法線は規約どおり扱い、同方向面を自動反転して通さない。
- 1%欠損、重複三角、0.01 mm平面ずれ(tol1e-6)、退化面、非有限q、共有節点を拒否。
- 合計が小さいケースも絶対誤差で確認し、0除算した相対誤差を成功にしない。

## targeted 実行と実機境界

`node --test tests/planar-heat-transfer.test.mjs tests/thermal-contact.test.mjs`

- thermal-contact既存testは実CPU solverを使うが、新moduleの流体共役熱伝達成功を意味しない。
- 実流体移流・温度/熱流反復・非平面・本番連成/UI は残す。
- 親 COUPLE3 queued を維持。演算子の保守性を局所受入として納品する。

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
