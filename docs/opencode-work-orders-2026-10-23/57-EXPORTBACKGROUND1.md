# 57 EXPORTBACKGROUND1 — 録画中のセッション失効と日英実機条件を検証する

## 開始条件

[共通指示](00-COMMON.md)を先に読む。基準main `fe98ca3e60b4f5dfd65c02f00b33b0f76059e9cb`。この1作業だけを実行し、親全体の完成とは区別する。

## 前提と読む順

なし。Chrome操作環境を先に確認し、利用不可なら自動試験と未確認マトリクスまでを納品。

1. `src/ui/webm-recording-lifecycle.js`
2. `tests/webm-recording-lifecycle.test.mjs`
3. `tests/browser-export-session.test.mjs`
4. `docs/pr-review-2026-10-22.md`
5. `docs/visual-export.md`

## 実装・検証手順

1. 既存の実hidden成功を再実装せず、所有タブの録画中に接続セッションを正規に失効させる試験を追加する。失効は本番コードの分岐を通し単なるthrow注入と区別する。
2. visible/hidden×日英で、開始拒否・録画中失効・取消/期限・部分成果物取得拒否・画面状態復元を確認する。実hiddenが作れないセルは未実施と記す。
3. 所有track/recorder/timer/URL/接続のみを終了し、復旧後の新しい録画成功まで確認する。利用者への手動操作の再依頼は不要。

## 受け入れ条件

各セルに実際のvisibility、開始/失効/終了時刻、job状態、取得可否、復元前後の版を残す。全終了は既存の有界期限内。模擬期限と実セッション失効を別ラベルで保存する。

## 対象試験

```text
node --test tests/webm-recording-lifecycle.test.mjs tests/browser-export-session.test.mjs tests/browser-page-lifecycle.test.mjs
```

新しい振る舞いには対応するfocused回帰を追加し、共通の型・差分検査も行う。上の試験の成功だけで実ブラウザ・native・公開・一般物理精度の合格にはしない。

## 境界と納品

仕様不足・参照不一致・非有限値・他者変更との競合は原因を記録し、関係する変更を止める。外部条件不足は未実施として残す。証拠JSON、実測と期待値、変更一覧、未確認、残る親受入をPRに添える。共通進捗は71担当へ更新案を渡し、この作業だけで親をreleasedへ進めない。
