# 63 PRINT2 — 材料同定データの入力検査と分離を整備する

## 開始条件

[共通指示](00-COMMON.md)を先に読む。基準main `fe98ca3e60b4f5dfd65c02f00b33b0f76059e9cb`。この1作業だけを実行し、親全体の完成とは区別する。

## 前提と読む順

実測なしでも取込契約まで進める。PRINTMEASURE/FINITEVISCOの実験を代替しない。

1. `src/printed-equivalent-material.js`
2. `tests/printed-equivalent-material.test.mjs`
3. `tests/fixtures/printed-equivalent-material.mjs`
4. `docs/printed-equivalent-material.md`
5. `docs/printed-material-measurement.md`

## 実装・検証手順

1. 既存printedEquivalentへ関連付ける測定datasetの取込契約を整える。試験片ID/寸法/造形方向/batch/温度/速度/生荷重変位/単位/機器版/データ版を明示する。
2. 識別用と独立検証用の試験片重複・欠損・不正単位・非有限・範囲外を拒否する。原データのhashと正規化版を保持し、同定係数は自動発明しない。
3. 合成データで検査器を試し、実データ未提供を明記する。既存の等価材料/明示構造二重加算拒否と旧入力互換を維持する。

## 受け入れ条件

合成1N、初期面積1mm²の工学応力1MPa、伸び0.1mm/標点10mmのひずみ0.01を単位検査で確認。校正済み・精度検証済みの表示は実測なしで付与しない。

## 対象試験

```text
node --test tests/printed-equivalent-material.test.mjs （追加datasetテストを同時実行）
```

新しい振る舞いには対応するfocused回帰を追加し、共通の型・差分検査も行う。上の試験の成功だけで実ブラウザ・native・公開・一般物理精度の合格にはしない。

## 境界と納品

仕様不足・参照不一致・非有限値・他者変更との競合は原因を記録し、関係する変更を止める。外部条件不足は未実施として残す。証拠JSON、実測と期待値、変更一覧、未確認、残る親受入をPRに添える。共通進捗は71担当へ更新案を渡し、この作業だけで親をreleasedへ進めない。
