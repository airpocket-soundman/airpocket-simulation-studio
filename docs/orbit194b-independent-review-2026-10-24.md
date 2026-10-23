# 194b切断試験の独立再照合

[English](en/orbit194b-independent-review-2026-10-24.md)

固定base `a4e1430`、実行runtime `c26010082fa5d23ab3b910116ac0e60227041748`。既存captureだけを読み、32ファイルの長さ/SHA-256、driver SHA、物理5state不変、session切替、releaseとcleanup記録を独立assertした。追加export・codec・solver実行は0。

正式MCPでrunning 13.773% / executionSettled:false、GUIで前景・切断有効・操作lockを観測した。marker受領からclick要求まで615ms。ただしclickはfocus timeoutで成功応答がなく、完了前の切断効果も確認できない。その後completed / executionSettled:trueとなり、新sessionでartifact先頭1byteが読めた。354459bytesとSHAはmetadata報告値であり、全動画bytes/hash/decodeの再検証ではない。

194a/194bとも部分結果を維持する。取消・取消後artifact拒否・取消後復元の受入は閉じない。194aのrefusalBasis文字列は予定判定基準として読む必要があり、取消拒否の実観測ではない。194bではactual refusalBasis:nullとplannedRefusalBasisを区別している。

後続の通常切断による旧session拒否、sessions空、job release後Unknown、GUI controls復元、owned child graceful exit、PID不存在/private token削除の記録を確認した。executionSettled自体が示すのはPromise chainとqueue排他の終了であり、OS/codec/GPU資源終了の保証ではない。日本語・前景IABの一条件だけで、英語/hidden/他engineのmatrixは未検証。171/37のstatusと進捗は変更しない。

再現: `node docs/evidence/verify-orbit194b-independent.mjs`。原capture・inventoryは無変更。結果は[独立JSON](evidence/2026-10-24-orbit194b-independent.json)、原記録は[194b README](evidence/2026-10-24-orbit-disconnect-synchronized-partial/README.md)。
