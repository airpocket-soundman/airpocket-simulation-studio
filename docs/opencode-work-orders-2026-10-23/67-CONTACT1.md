# 67 CONTACT1 — penalty感度と解析解を参照モデルで照合する

## 開始条件

[共通指示](00-COMMON.md)を先に読む。基準main `fe98ca3e60b4f5dfd65c02f00b33b0f76059e9cb`。この1作業だけを実行し、親全体の完成とは区別する。

## 前提と読む順

なし。既存結果と符号が違う場合は符号契約を先に照合し、期待値を都合よく変えない。

1. `src/unilateral-contact-reference.js`
2. `tests/unilateral-contact-reference.test.mjs`
3. `docs/roadmap.md`

## 実装・検証手順

1. 既存1自由度spring/penalty接触の厳密な区分解を独立に導き、開離/接触開始/接触中/除荷の参照表を作る。状態履歴を持たない解を摩擦履歴と呼ばない。
2. spring=100N/mm、gap=1mm、force=150Nに対しpenalty=100/1000/10000N/mmを比較し、侵入量と反力/残差/反復数を記録する。
3. maxIterations上限、停滞、極小tolerance、非有限演算の拒否を保持する。大penaltyがいつでも高精度と断定せず数値条件を報告する。

## 受け入れ条件

接触時u=(F+kp*g)/(k+kp)、侵入=u-g、反力=kp*(u-g)を既存符号に合わせ独立照合。kp=1000でu=1150/1100mm、反力50000/1100N。3D接触や摩擦対応とはしない。

## 対象試験

```text
node --test tests/unilateral-contact-reference.test.mjs
```

新しい振る舞いには対応するfocused回帰を追加し、共通の型・差分検査も行う。上の試験の成功だけで実ブラウザ・native・公開・一般物理精度の合格にはしない。

## 境界と納品

仕様不足・参照不一致・非有限値・他者変更との競合は原因を記録し、関係する変更を止める。外部条件不足は未実施として残す。証拠JSON、実測と期待値、変更一覧、未確認、残る親受入をPRに添える。共通進捗は71担当へ更新案を渡し、この作業だけで親をreleasedへ進めない。
