# 38 CONTACT1 — 元 PR #143 の限定修正

## 開始・読む順

1. [00-COMMON.md](00-COMMON.md)、特に「元PRを修正する9件の特別手順」を読む。
2. レビュー対象 head は `bf0cc946ab99f4c09fce413ce876a7a88ca69bdb`。実行時 `gh pr view 143 --json headRefName,headRefOid,state` と fetch で再確認する。変化していたら修正済みか再評価し、古い差分を上書きしない。
3. 未mergeなら取得した最新元 head から自分の `codex/opencode-repair-38` / `D:/github/airpocket-soundman/studio-opencode-repair-38` を新設。owner worktree は読取のみ。primary/thermal-compare/UI2/他PRの編集は禁止。
4. 反例 test→失敗確認→最小修正→対象試験。無限ループの反例は子プロセスを timeout で隔離する。既にmerge済みなら最新main起点の修正PRとする。

## 具体的問題・変更範囲

`src/unilateral-contact-reference.js`（レビュー時54行）は Number.isInteger のみで 1e20 を許容。Newton反復は丸め停滞して残差判定を通らず、事実上戻らなくなる。
読む: 同 module、`tests/unilateral-contact-reference.test.mjs`、元PRの限定1自由度モデル説明。
変更可: 同 module/test、必要な同モデル契約の小さな修正、evidence。
一般接触solver/mesh/摩擦/大変形/新本番capability導入、許容残差を増やす修正は禁止。

## 番号付き実装と受入

1. 元の合成反例をそのまま child process の最大2秒 timeoutで確認する:
   springNPerMm=100 N/mm、penaltyNPerMm=10000 N/mm、gapMm=1 mm、forceN=200 N、toleranceN=1e-30 N、maxIterations=1e20。
   レビュー観測は残差約8.5265e-14 Nの停滞。CPU無制限で親testを固めない。
2. maxIterationsに安全整数チェックと明示的な有限反復予算を設ける。参照モデルの既存契約/利用例に基づく計算資源上限として説明し、物理閾値と混同しない。単に MAX_SAFE_INTEGER まで許せば十分とはしない。
3. finiteな next===u、または反復状態の繰返し等の停滞を bounded に拒否する。許容残差を満たさない状態を converged と返さない。既存 CONTACT_NOT_CONVERGED と拒否code互換を必要範囲で保持する。
4. maxIterations を採用した許容上限内に置いた同反例でも有限回で停滞拒否。k/kp/force のfinite極端値で residual/tangent/最終反力がoverflowする場合も明示拒否し、JSONへ NaN/Infinity を返さない。
5. 通常 toleranceN=1e-9 N、同 k/kp/gap/F の解 u=10200/10100 mm、接触反力=-10000*(u-1) N、残差<=1e-9 Nを確認する。既存開離/接触/符号/非収束testを保持。
6. 0/負/小数/Infinity/NaN/1e20 と上限境界を test。安全整数でも過大な値と、妥当反復予算の停滞を別々に拒否することを確認する。

## 対象試験・反映

```powershell
node --test tests/unilateral-contact-reference.test.mjs
npm run check:contracts
git diff --check
```

修正前反例のtimeoutと修正後の有限拒否回数/時間を evidence に記録。Node数理参照の受入でありChromeや本番接触解析を実証しない。
元head不変を確認し取得した元branchへ通常FF push。force/重複PRは禁止。上限を根拠なく決められなければ仕様判断を報告して止める。

## 検証境界・停止・納品

- 合成 fixture と実 Chrome、公開 HTTPS を分ける。Chrome 未操作なら実ブラウザ確認済みとしない。秘密/pairing code/全環境変数を出力しない。所有 tab/server/接続だけ cleanup。
- 数値不一致、非有限値、元 head 進行、知らない dirty、保存互換性破壊、権限拡張必要なら関係変更を停止して再現と判断点を報告する。試験の削除/skip/物理閾値緩和は禁止。
- `docs/evidence/<実行日>-opencode-next-38.json` に base/head・前提 SHA・コマンド・数値/units・pass/fail・未確認を sanitize 記録。失敗前後を混ぜない。自己参照 SHA は作らない。
- progress/共通 docs/Skill は編集しない。親 CONTACT1 の全完了/released を宣言せず、限定受入・残条件の更新文案を添える。
- 最終納品: 変更動作/ファイル、実行試験と実測値、未確認、証拠、commit/push先/PRまたは元PR、次レビュー箇所。自己 merge・force push は禁止。

