# 64 CFDPORT1 — 開口候補から明示確認済みcapへの変換境界を作る

## 開始条件

[共通指示](00-COMMON.md)を先に読む。基準main `fe98ca3e60b4f5dfd65c02f00b33b0f76059e9cb`。この1作業だけを実行し、親全体の完成とは区別する。

## 前提と読む順

なし。GUI/API接続を広げず変換契約とテストに限定する。

1. `src/opening-loop-candidates.js`
2. `src/fluid-opening-caps.js`
3. `tests/opening-loop-candidates.test.mjs`
4. `tests/fluid-opening-caps.test.mjs`
5. `docs/fluid-domains.md`

## 実装・検証手順

1. 三角形開口候補のID/元mesh版と、利用者が明示したoutward単位法線/内点を受け取り、既存cap契約へ変換するpure adapterを作る。候補の法線符号だけで外向きを決定しない。
2. 平面凸ループだけを対象に、古いmesh版、無効component、候補改ざん、法線と面の不整合を拒否する。元の節点identityと許容値を保持する。
3. 正常な箱の単一開口、向きを反転した法線、二重面、未解決seamで確認する。OCCの局所蓋生成や任意wire/複数体積は追加しない。

## 受け入れ条件

明示確認済み候補だけが既存cap入力になり、未確認/古い候補は入力不変で拒否される。候補検出成功を閉殻・流体領域生成成功と扱わない。

## 対象試験

```text
node --test tests/opening-loop-candidates.test.mjs tests/fluid-opening-caps.test.mjs
```

新しい振る舞いには対応するfocused回帰を追加し、共通の型・差分検査も行う。上の試験の成功だけで実ブラウザ・native・公開・一般物理精度の合格にはしない。

## 境界と納品

仕様不足・参照不一致・非有限値・他者変更との競合は原因を記録し、関係する変更を止める。外部条件不足は未実施として残す。証拠JSON、実測と期待値、変更一覧、未確認、残る親受入をPRに添える。共通進捗は71担当へ更新案を渡し、この作業だけで親をreleasedへ進めない。
