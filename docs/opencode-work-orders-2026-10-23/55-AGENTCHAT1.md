# 55 AGENTCHAT1 — 会話パネルをsession状態と拒否条件へ接続する

## 開始条件

[共通指示](00-COMMON.md)を先に読む。基準main `fe98ca3e60b4f5dfd65c02f00b33b0f76059e9cb`。この1作業だけを実行し、親全体の完成とは区別する。

## 前提と読む順

54の契約が統合済みになるまで本番接続を実装しない。先行する場合はUI契約案と合成試験に限定する。

1. `src/ui/agent-connection-status-ui.js`
2. `tests/ui-agent-connection-status.test.mjs`
3. `tests/ui-agent-connection-status-scanner.test.mjs`
4. `docs/agent-operation.md`
5. `docs/agent-acp-probe.md`

## 実装・検証手順

1. 54の公開状態を消費する小さなUI境界を設計し、接続/初期化/認証不足/会話可能/取消中/終了/失敗を区別する。未実装の本番接続は利用可能と表示しない。
2. 送信・停止・エラー再操作、1prompt制約、セッション変更時の旧応答破棄を実装する。会話内容をHTMLとして挿入せず、本文/添付/保持量の上限を決める。
3. 日英切替でaria-liveとラベルが戻らないこと、390pxとキーボード操作を確認する。MCP操作委任、認証自動化、モデル選択は追加しない。

## 受け入れ条件

合成状態プロバイダーで多重送信拒否・取消・遅延更新・切断からの表示復旧を自動確認し、実Chromeで日英とキーボード確認を分離する。本番session未接続ならその状態を明記する。

## 対象試験

```text
node --test tests/ui-agent-connection-status.test.mjs tests/ui-agent-connection-status-scanner.test.mjs （追加会話UIテストを同時実行）
```

新しい振る舞いには対応するfocused回帰を追加し、共通の型・差分検査も行う。上の試験の成功だけで実ブラウザ・native・公開・一般物理精度の合格にはしない。

## 境界と納品

仕様不足・参照不一致・非有限値・他者変更との競合は原因を記録し、関係する変更を止める。外部条件不足は未実施として残す。証拠JSON、実測と期待値、変更一覧、未確認、残る親受入をPRに添える。共通進捗は71担当へ更新案を渡し、この作業だけで親をreleasedへ進めない。
