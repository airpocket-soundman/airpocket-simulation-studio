# 録画中切断の部分実測 / Partial orbit disconnect observation

**録画中取消の受入は未達。** 日本語・前面の通常main IABで比較orbit WebM15秒を1回開始したが、actorは切断拒否より先にcompletedを観測した。再接続後もcompleted / executionSettled=trueで、成果物1byte取得は成功した。cancelledや成果物拒否を確認したとは扱わず、再出力しない。

**Active-recording cancellation was not established.** One15second comparison orbit WebM ran in the foreground Japanese ordinary-main IAB page. The actor observed completion before connection refusal. The fresh session saw completed / executionSettled=true and could read one artifact byte. No cancelled-state/artifact-refusal success or repeat export is claimed.

## Scope and order

- Runtime c26010082fa5d23ab3b910116ac0e60227041748, origin http://127.0.0.1:5188, ordinary main IAB2 tab11, Japanese only. Browser reports reduced Chrome155.0.0.0 UA, not an independently verified full version. Root confirmed visible/hidden=false and stopped solvers. No English/hidden/expiry matrix was attempted.
- Fixed driver SHA05b9cdbd7991b84e30f1d56c4e55aa92bbea5a0f6aebbd78a6a7598306ec820f. Pair/metadata, case-mutation and export gates were distinct. Root alone wrote the export gate and watched the positive-running file directly. No driver restart or uncertain mutation retry occurred.
- Setup used inspect/edit/view and no analyze permission, importing the existing synthetic acoustic archive through formal chunked MCP and verifying its complete readback/hash/content. Fresh pairing used inspect/view only on the same page and same child/token. No solver or extra export ran. Budget:1export,15requested seconds,120s watchdog,32MiB artifact capacity.
- Formal MCP observed positive running progress with executionSettled=false. Root captured GUI modelDisabled=true / animationStopDisabled=false / disconnectDisabled=false while visible. The actor then observed completed at+15639ms and old-session refusal at+15844ms relative to its request start. These are actor receipt timestamps, not exact GUI-click timestamps. The earlier GUI running/lock snapshot does not prove recording was still active at the later click.

## What did pass

The old session became unavailable and the broker listed sessions[]. A new session ID on the same page could read the retained old job. That read correctly returned completed and executionSettled=true. This verifies the new public settlement field for this completed run, not the cancelled-but-unsettled transition.

Status/artifact methods are shared delegates, not per-job ownership ACLs. The new session's artifact read succeeded because a completed artifact remained. Only1byte was requested. Metadata reported358336bytes and SHAb97c227fab169734654904cd2318f78f8f9965a0f0377b101514387ed447aa54; full artifact bytes, SHA integrity and decoder quality were not independently verified. The raw primary-result refusalBasis text describes the planned cancelled-state criterion; it is not an observed refusal here.

Input/remaining inspect data, cases/IDs/revisions, comparison state, result state and camera/view were unchanged. Page instance identity stayed the same and connection epoch increased. Root's selected before/after controls match exactly: Japanese/visible/model enabled/animation-stop disabled/disconnect enabled. Restoration happened after completed output and same-page reconnection; cancellation recovery is not proven.

The fresh session released the retained old job, then received Unknown visual export job. This is absence after release, not ownership refusal. Root finally disconnected and cleared endpoint/code. Formal final sessions[], graceful child close(exited=true,terminated=false,escalated=false), driver exit0, OS absence of owned child PID12692 and private-token-file deletion were confirmed. All temporary case transfers were released.

## Evidence

started.json / running-ready.json / old-session-status-polls.json / missed-window.json preserve the recording order. old-session-call-rejection.json and old-session-explicit-unavailable.json preserve disconnection refusal. fresh-session-old-job-status.json / fresh-session-artifact-result.json preserve the completed outcome. before-after-state.json and root gui-before/during/after.json preserve separate physical/UI observations. during.jpg and after.jpg are normal-main screenshots. source-identities.json fixes source blobs; driver.mjs.txt is the exact frozen source. Raw bytes are copied with fs.copyFileSync and dedicated -text attributes, with staged SHA/length checks against byte-inventory.json. Credentials are excluded.

## Remaining acceptance

Cancelled plus executionSettled=true and artifact-unavailable after active disconnect remain unverified in this condition. Hidden/English/all-browser behavior is not added. The completed history is retained even if a later separately budgeted test succeeds. A future attempt needs a new explicit budget/request, not blind replay. Root's proposed improvement is one computer-use call that writes the gate, watches positive running, reads GUI lock and immediately clicks Disconnect; screenshots occur only afterwards to reduce observation delay. No such second attempt was started by this task.

日本語補足: 旧接続の失効・同page再接続・公開settled値・共有status/artifact参照・完了後の5状態と選択GUI復元・資源解放は成立。一方、切断時点の稼働継続と取消は成立しなかった。拒否の根拠はsession失効/解放後不存在であり、今回はcancelled-state成果物拒否そのものが起きていない。親タスク完了へ昇格しない。
