# 52 RESULTCURVE1 — 実解析から再入力可能な段階bundleを生成する

## 開始条件

[共通指示](00-COMMON.md)を先に読む。基準main `fe98ca3e60b4f5dfd65c02f00b33b0f76059e9cb`。この1作業だけを実行し、親全体の完成とは区別する。

## 前提と読む順

なし。PR178/179の静止グラフ・比較UIは既存機能として利用する。

1. `src/increment-curve-data.js`
2. `src/increment-curve-export.js`
3. `scripts/create-increment-curve-export-reference.mjs`
4. `tests/increment-curve-data.test.mjs`
5. `docs/increment-curve-export.md`

## 実装・検証手順

1. 既存参照generatorと正規契約を再利用し、明示した荷重列の独立線形解からspec/steps bundleを作る有界サービスまたはCLIを整備する。既に同等の汎用入口があれば拡張せず受入を検証する。
2. 入力版・mesh・calculation・resultを実結果から取得する。各段階を再計算し、変位/反力の倍率コピーを禁止する。0荷重、除荷順序、失敗段階を保持する。
3. 通常project、検証済み表JSON、再入力bundleを区別して保存する。出力先の上書きを拒否し、失敗時は完成ファイルを残さない。現在のGUI状態へ暗黙適用しない。

## 受け入れ条件

合成10×10×40mm、E=1e9Pa、nu=0、100Nで標点伸び0.04mm、応力1MPa、ひずみ0.001を照合。生成bundleを既存共通サービスへ渡し、独立に読み直したCSV/JSONの値と版を一致させる。計算失敗時に偽の収束行を生成しない。

## 対象試験

```text
node --test tests/increment-curve-data.test.mjs tests/increment-curve-export.test.mjs
```

新しい振る舞いには対応するfocused回帰を追加し、共通の型・差分検査も行う。上の試験の成功だけで実ブラウザ・native・公開・一般物理精度の合格にはしない。

## 境界と納品

仕様不足・参照不一致・非有限値・他者変更との競合は原因を記録し、関係する変更を止める。外部条件不足は未実施として残す。証拠JSON、実測と期待値、変更一覧、未確認、残る親受入をPRに添える。共通進捗は71担当へ更新案を渡し、この作業だけで親をreleasedへ進めない。
