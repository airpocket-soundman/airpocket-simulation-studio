# 同期した切断検証194b: 部分結果 / Synchronized disconnect probe: partial

Runtime `c26010082fa5d23ab3b910116ac0e60227041748`、通常main/IAB同一page、日本語・前景条件。新規comparison orbit WebMを15秒で1回だけ開始し、solver・追加export・再試行は0。旧194とは独立した要求で、旧履歴を置換しない。

正式MCPのrunning進捗13.77%とGUIの録画lock/切断ボタン有効を同一CUA呼出し内で確認した。しかし直後のclick呼出しは `Emulation.setFocusEmulationEnabled` timeoutとなり、成功応答も完了前の切断効果も確認できなかった。jobはcompletedへ到達した。その後の通常GUI切断により旧session拒否とsessions空を確認した。取消・cancelled artifact拒否の受入は未達である。

同child/tokenでinspect/viewだけの新sessionへ再接続し、旧job completed/executionSettled:trueとartifact先頭1byte取得成功を観測した。artifact metadataは354459bytesだが全bytes/hash/動画decodeを検証していない。物理5state不変、同page/接続epoch増加、GUI最終controls復元は成立した。旧job release後のUnknown job、最終sessions空、child実終了、PID43600不存在、private token削除を確認した。これは取消後復元の実証ではない。

既存archiveを正式輸送で全bytes/hash再確認したため、import・caseView・compare設定変更は0、両sessionでedit/analyze権限は0。`primary-result.json` のactual refusalBasisはnullで、plannedRefusalBasisは未達の判定基準である。JA以外、hidden、他engineのmatrixは未確認。

One new 15-second comparison orbit export was attempted on the fixed runtime above, in Japanese and foreground, with zero solver runs or retries. Within one browser-control invocation, positive MCP progress and active GUI recording controls were observed. The immediately requested disconnect click timed out in focus emulation; no successful click return or pre-completion disconnect effect was established. The job completed before a later ordinary GUI disconnect. Cancellation acceptance remains unmet.

A fresh same-page inspect/view session observed the retained completed job, settled execution, and an available one-byte artifact read. Five physical-state snapshots matched; the connection epoch increased and final GUI controls were restored. The job and transfers were released, sessions became empty, the owned child exited, its PID disappeared, and the private pairing file was removed. Full media bytes/hash/decode, cancelled-state refusal, and restoration after cancellation are not claimed. The earlier 194 partial history remains separate.

Raw files and the frozen driver are byte-preserved; `byte-inventory.json` inventories their SHA-256 values. GUI screenshots were captured after the click attempt, not used to delay that attempt.
