# COUPLE4B: 曲面圧力の保守的節点荷重と仮想仕事

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

曲面連成の基礎として、向き付き三角形曲面の面一定複素圧力を節点力へ積分する純粋moduleを実装する。
流体→構造の荷重演算子と、その転置による仕事/体積速度の一致までに限定する。
強制周波数応答・減衰・双方向連成solveは本番へ追加しない。

## 読む順

1. src/progress.json の COUPLE4B / COUPLE4。
2. src/vibration-source.js / tests/vibration-source.test.mjs。
3. src/acoustic-core.js / src/acoustic-impedance.js / src/modal-core.js。
4. src/tetra-geometry.js / src/boundaries.js: 面積と荷重の既存単位を確認。

## 変更範囲

- 追加可: src/curved-pressure-transfer.js / tests/curved-pressure-transfer.test.mjs。
- vibration-source の平面/一方向限定拒否を外さない。
- acoustic/elastic solver、modal正規化、入力schema、main/MCP本番経路を変更しない。

## 実装手順

1. nodes(mm), oriented triangles, 各面pressurePa={real,imag}を明示契約にする。
2. outward法線nに対し構造へ作用するtraction=-p*n、各頂点へ面積/3を配分する。
3. 面積mm²を1e-6でm²へ変換し、complex nodal force Nを返す。
4. 同じ積分重みの転置で節点変位(m)から面の法線変位積分m³を計算する。
5. conjugate規約を固定し、仕事 Σconj(u)·f と -Σp*conj(integral u·n dA) の一致を検証する。
6. 幾何法線/総面積/力・モーメントを返す。入力を変更しない。
7. 開曲面と閉曲面の宣言を分け、閉面ではedge incidenceと向きが整合することを検査する。

## 数値参照と拒否

- 直角三角形(0,0,0),(10,0,0),(0,10,0) mm、normal+Z、面積50 mm²。
- p=1000+500i Pa → 合力Z=-0.05-0.025i N、各頂点=-1/60-i/120 N。
- 閉じた正八面体(軸±10 mm)の一様圧力では全力/原点モーメント≈0。
- 面ごと異なる複素pと節点変位で仮想仕事相対誤差≤1e-12、近零時絶対誤差≤1e-14 J。
- 一様圧力を加えた閉曲面では、一様並進・剛体回転に対する仕事も0。面ごとに異なる圧力では合力/モーメントが一般に0にならないため、仕事0を要求しない。法線を逆転した開面は荷重符号が逆になる。
- NaN/Infinity、面数不一致、退化面、重複face、閉殻の開edge/不整合向き、未知単位を拒否。
- pressure magnitudeだけを用いてimaginary位相を捨てない。

## targeted 実行と実機境界

`node --test tests/curved-pressure-transfer.test.mjs tests/vibration-source.test.mjs`

- 「離散曲面積分の保守性」の証拠に限定。非一致曲面projection、複素周波数応答、付加質量は未実装。
- 正八面体を滑らかな球の厳密精度と呼ばない。親 COUPLE4B queued を維持する。

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
