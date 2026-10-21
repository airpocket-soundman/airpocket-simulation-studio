# 42 PRINT2 — 造形条件と等価異方性の根拠を結び付ける

先に [共通手順](00-COMMON.md) を読む。小さなPRは中間成果であり、下記の親タスク完了条件まで継続する。外部条件だけは未実施として明示する。

## 現状と今回の出口
- PRINT2はbuilding。9定数・材料軸の静的CPU接続と理論/回転/JS-WASM/保存試験は既存。印刷校正、壁・層・インフィル詳細、実測検証は未完。
- 今回は「印刷条件付き等価材料」の根拠を保存・拒否・復元できる最小契約を作る。G-code表示を造形解析の完成と扱わない。
- 最終段階の任意機能であり、公開優先経路を遅らせない。

## 作業場所と読むもの
- origin/mainからD:/github/airpocket-soundman配下の専用worktree/branchを作り、主作業フォルダ/他担当の変更を保護する。
- `docs/printed-material-measurement.md`、`docs/printed-parts.md`、`docs/orthotropic-materials.md`を先に読む。
- `src/orthotropic-material.js`、`src/orthotropic-input-contract.js`、`src/orthotropic-result.js`と対応testsを確認する。
- 取込側`src/print-3mf.js`、`src/print-gcode.js`、`src/print-operations.js`は既存範囲を保持する。測定装置開発まで広げない。

## 実装・検証手順
1. 現在の材料/保存schemaで保持するID・単位・根拠・材料軸を表にし、印刷条件を落としている箇所を特定する。
2. 試験片ID/寸法、材料/機種、積層方向、層高さ、壁/インフィル条件、測定/同定版、有効範囲を持つ限定recordを設計する。
3. 実測根拠なしの値は理論/仮定と明示する。未知の壁厚を壁数から決めず、同定と独立検証のデータを分ける。
4. 既存入力契約・保存復元へ接続し、欠損単位、不正材料軸、非正定値材料、有効範囲外を既存の拒否経路へ返す。
5. 等価材料を使う経路と壁/インフィルを明示する経路の排他を実装し、同じ剛性を二重加算しない。
6. 根拠recordの保存→復元→再計算で値/軸/根拠IDが一致する試験を追加する。旧保存データの互換性を維持する。
7. 実測入力が手元にない場合は合成fixtureと明示し、取得すべき測定条件/独立検証片の一覧を残す。数値を捏造しない。

## 試験と証拠
- `node --test tests/orthotropic.test.mjs tests/orthotropic-integration.test.mjs tests/orthotropic-input-contract.test.mjs tests/print-import.test.mjs tests/print-operations.test.mjs`
- 構造計算では理論棒の変位/反力、回転共変性、せん断、JS/WASM一致を回帰確認する。
- sourceSHA、fixtureの根拠区分、単位、材料軸、入力/保存/復元識別、数値誤差と拒否例をJSONへ記録する。
- GUIを変更したら実ブラウザで日英・値保持・不正値の説明を確認。測定精度と数値実装の一致を分ける。

## 提出・完了条件
- schema/実装/意味のある回帰試験/日英説明を1PRへ。自己merge・force pushは禁止し、レビュー後の公開を依頼する。
- PRINT2全体の完了には壁・層・インフィルモデルと造形条件校正、独立した実測検証が必要。今回の契約追加だけならbuildingを維持する。
- 実測不足や未対応の組合せを残作業として明記し、既存受入条件を縮めない。
