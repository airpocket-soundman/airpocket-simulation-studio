# 印刷材料3増分の締め監査（2026-11-04）

[English](en/printed-final-integration-audit-20261104.md)

統合 `6718614bf731073ee345eb40cd1932792d0e43f9` を基準に、バッチCLI `889f5e1`、条件別集計 `7caa941`、holdout予測誤差の締め監査を実施した。新機能や進捗変更は加えていない。rootの最終全件試験とは別の、固定ソースと関連試験の監査である。

バッチの実CLI試験は8件・合計入力容量の境界、事前の全原文SHA照合、共有ファイルの版衝突、個別拒否、既存path/alias/link保全、競合時の排他的公開を確認した。共通FD読取り抽出後も、既存単一CLIの成功/拒否成果物が保存済みgoldenと全bytes一致する。条件別純粋APIは方向・温度・速度・batch・寸法・標点長の完全一致で分け、singletonの散布は不明(null)、未同定片の係数は補わない。holdoutは既存11試験で訓練のみfitと明示片対応・Pa誤差・条件/履歴/容量境界を維持する。

初回関連49件は成功したが、別の独立probeで、元温度20°Cの正しい返信のgroup条件だけ999°Cへ変えるとUIが成功表示する漏れを発見した。原文SHAと内部統計が一致しても、memberの元条件を認証することにはならない。owner修正 `fe3274caacf5251bb49b6c1bd084f99b9cd40e72` は既存正規化APIを同じ準備枠で待ち、原文から複製したdataset identity・各memberの条件と返信をObject.isで照合する。未完了SHA枠と世代管理を維持する。

修正後の独立2群で、全6条件の有効範囲内すり替え、2群のmemberと統計を一緒に交換するすり替えを拒否した。温度反例はaccepted trueからfalse/invalid/空表示へ変わり、Workerを終了する。バッチ・条件・holdout・単一CLI独立試験・UI・層・文書を含む69/69成功、40宣言の型検査成功。[JSONとrawログ](evidence/2026-11-04-printed-final-integration-audit.json) に初回と修正後を分離して保持する。

本監査コミットは独立試験・証拠のみ。製品修正はownerの上記コミットである。新しいsolver、実測、GUI実機、物理的独立性・校正・材料適用・公開の検証は実行していない。PRINTMEASURE3の親受入、タスクリストの最終更新とcommit/pushはroot担当であり、ここでは状態を昇格しない。
