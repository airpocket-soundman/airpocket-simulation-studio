# 54 AGENTACP1 — ACPの有界session状態機械を合成childで実装する

## 開始条件

[共通指示](00-COMMON.md)を先に読む。基準main `fe98ca3e60b4f5dfd65c02f00b33b0f76059e9cb`。この1作業だけを実行し、親全体の完成とは区別する。

## 前提と読む順

なし。固定v1仕様で必要なmethodを確認できなければ、確認できた契約と不足点までを納品し未実装を明記する。

1. `scripts/acp-client-process.mjs`
2. `tests/acp-client-process.test.mjs`
3. `tests/fixtures/acp-agent-stub.mjs`
4. `docs/agent-acp-probe.md`

## 実装・検証手順

1. 固定ACP v1 schemaのsession/new、session/prompt、session/cancelとupdateを一次資料で確認し、参照URL/版/hashを記録してから実装する。initialize専用CLIの互換性は保持する。
2. 別のsessionクライアント境界で1session/1prompt、応答上限、update保持上限、期限、取消、closeを実装する。未提供fs/terminal/tool権限は拒否し、所有child以外へ終了を送らない。
3. 合成childだけで順序違反・不明session/id・不正UTF-8・巨大update・取消後の遅延通知を試す。実Codex起動方法・認証・ログインは推測せず別条件として残す。

## 受け入れ条件

正常prompt終了、取消、期限、途中child終了で全pending要求が有限時間に決着し、timer/listenerを解放する。initialize readyを認証済みと表示しない。会話本文/環境/認証情報を証拠へ記録しない。

## 対象試験

```text
node --test tests/acp-client-process.test.mjs （追加sessionテストを同時実行）
```

新しい振る舞いには対応するfocused回帰を追加し、共通の型・差分検査も行う。上の試験の成功だけで実ブラウザ・native・公開・一般物理精度の合格にはしない。

## 境界と納品

仕様不足・参照不一致・非有限値・他者変更との競合は原因を記録し、関係する変更を止める。外部条件不足は未実施として残す。証拠JSON、実測と期待値、変更一覧、未確認、残る親受入をPRに添える。共通進捗は71担当へ更新案を渡し、この作業だけで親をreleasedへ進めない。
