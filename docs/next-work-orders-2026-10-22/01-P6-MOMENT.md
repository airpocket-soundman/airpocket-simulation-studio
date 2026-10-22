# 01 P6 — 誤反力の偶力を受理しない

## 問題と範囲

`verifyNativeTet4Output` は並進の力釣合いを確認するが、支持2点に逆向きの誤反力を足すと合力0のまま回転の釣合いが壊れても通る。準備済み等方Tet4の出力検証へモーメント釣合いを追加する。CAD条件転送や一般物理の対応を追加したとはしない。

## 実行手順と受入

1. `scripts/native-tet4-contract.mjs`、`tests/native-tet4-contract.test.mjs`、`docs/native-tet4-proof.md`を読む。
2. recordの第1節点を原点とし、mmをmへ変換した腕と節点荷重/支持反力から各軸のモーメントを積算する。大きな全体平行移動に依存しないこと。
3. 絶対許容値1e-8 N m + 各軸の積算絶対項×1e-7を使用し、非有限値も拒否する。
4. 合力が正しいままx/y/z各軸に偶力を追加する反例を拒否し、平行移動した正しい合成参照を受理する。既存の合成反力も力だけでなくモーメントが釣り合う分布に直す。
5. `node --test tests/native-tet4-contract.test.mjs tests/native-proof.test.mjs`を実行。localの実host/WASMがないskipは成功に数えない。必須native-proof CIで新validatorと実host/WASMを検証する。
6. 日英文書へ単位/許容値/適用範囲を追記し、レビューへ提出する。

## 実行状態

2026-10-22: 手順2〜4を実装。focused試験の結果は統合担当へ提出する。実バイナリをこのWindows環境で再実行したとはしない。必須CIと独立レビュー前でありP6全体はbuildingを維持する。
