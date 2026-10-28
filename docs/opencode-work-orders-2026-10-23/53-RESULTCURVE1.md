# 53 RESULTCURVE1 — 単一・比較グラフの実Chrome操作と保存を検証する

## 開始条件

[共通指示](00-COMMON.md)を先に読む。基準main `fe98ca3e60b4f5dfd65c02f00b33b0f76059e9cb`。この1作業だけを実行し、親全体の完成とは区別する。

## 前提と読む順

52を待たず同梱参照で開始できる。52の成果を採用する追加確認は52統合後。

1. `docs/increment-curve-ui.md`
2. `docs/increment-comparison-ui.md`
3. `src/ui/increment-curve.js`
4. `src/ui/increment-curve-comparison.js`
5. `tests/ui-increment-curve-comparison.test.mjs`

## 実装・検証手順

1. 最新の単一/比較UIを合成同梱bundleで操作し、実ブラウザからCSV/JSON/SVGを取得する。単なるDOM stubを画面検証と呼ばない。
2. 日本語/英語、390px、Tab/Enter、拡大リンク、入力再選択、不正bundle、遅延読込中の再選択を検証する。旧表示とリンクが再表示されないことを確認する。
3. 出力値を正式MCPの曲線サービス応答と独立に比較し、操作前後のproject/結果/ケースの版が不変であることを記録する。必要な不具合修正だけを行う。

## 受け入れ条件

参照A/Bの成功点・失敗点分断、N/mm/Pa/無次元、凡例、CSVの行数と数値、SVGの外部参照なしを確認する。遅延競合は自動テスト、実操作で確認した範囲は画像と取得hashで別記する。

## 対象試験

```text
node --test tests/ui-increment-curve.test.mjs tests/ui-increment-curve-comparison.test.mjs tests/increment-curve-mcp.test.mjs tests/increment-curve-comparison-mcp.test.mjs
```

新しい振る舞いには対応するfocused回帰を追加し、共通の型・差分検査も行う。上の試験の成功だけで実ブラウザ・native・公開・一般物理精度の合格にはしない。

## 境界と納品

仕様不足・参照不一致・非有限値・他者変更との競合は原因を記録し、関係する変更を止める。外部条件不足は未実施として残す。証拠JSON、実測と期待値、変更一覧、未確認、残る親受入をPRに添える。共通進捗は71担当へ更新案を渡し、この作業だけで親をreleasedへ進めない。
