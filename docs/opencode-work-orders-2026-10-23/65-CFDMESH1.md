# 65 CFDMESH1 — 限定直交セルをTet4化して向き・壁tagを検査する

## 開始条件

[共通指示](00-COMMON.md)を先に読む。基準main `fe98ca3e60b4f5dfd65c02f00b33b0f76059e9cb`。この1作業だけを実行し、親全体の完成とは区別する。

## 前提と読む順

なし。既存cell-qualityの閾値を緩和せず利用する。

1. `src/channel-layer-plan.js`
2. `src/channel-layer-cell-quality.js`
3. `src/tetra-geometry.js`
4. `tests/channel-layer-cell-quality.test.mjs`
5. `tests/mesh-validity.test.mjs`

## 実装・検証手順

1. 既存の平行平板直交セル品質報告から、決定的な共有節点/適合面を持つ限定Tet4集合を生成するpure処理を追加する。一般Gmsh境界層には接続しない。
2. 各Tetの正体積、内部面の2重incidence/反対向き、外部面と上下壁tagを確認する。隣接セルで分割対角線を一致させ、重複や隙間を拒否する。
3. gap10mm、length2mm、width1mmの既存7セル参照で、Tet体積和20mm³と壁面積を独立照合する。壁tagの流体solver利用やy+評価は未対応のまま。

## 受け入れ条件

全Tetの符号付き体積>0、相対体積誤差≤1e-12、上下壁面積各2mm²。薄層/逆順/巨大値/不適合面を拒否し、入力不変・順序再現性を確認する。

## 対象試験

```text
node --test tests/channel-layer-cell-quality.test.mjs tests/mesh-validity.test.mjs （追加Tet4変換テストを同時実行）
```

新しい振る舞いには対応するfocused回帰を追加し、共通の型・差分検査も行う。上の試験の成功だけで実ブラウザ・native・公開・一般物理精度の合格にはしない。

## 境界と納品

仕様不足・参照不一致・非有限値・他者変更との競合は原因を記録し、関係する変更を止める。外部条件不足は未実施として残す。証拠JSON、実測と期待値、変更一覧、未確認、残る親受入をPRに添える。共通進捗は71担当へ更新案を渡し、この作業だけで親をreleasedへ進めない。
