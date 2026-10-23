# 診断stdio clientの終了確認

[English](en/stdio-client-close.md)

`scripts/perf-browser.mjs` の `createStdioClient.close()` は冪等なPromiseを返す。stdin EOF後に最大3000ms、所有childのexit/close確認を待つ。未確認ならSIGTERM後2000ms、さらにSIGKILL後2000ms待ち、確認できた場合だけ `{exited:true,terminated,escalated}` を返す。signal送信の成功は終了確認ではない。確認不能は `STDIO_CHILD_EXIT_UNCONFIRMED` でrejectし、成功にしない。対象はこのclientがspawnしたchildのみで、孫process-tree全体の終了保証ではない。

close開始時に新RPCを拒否し、保留RPCを `STDIO_CLIENT_CLOSED` で決着して期限timerを解除する。終了後はreadline・所有stream・listenerを解放する。既に終了したchildへsignalを送らない。通常の `await client.close()` 呼出側は返り値を無視してよい。起動失敗時も同じ終了処理を行う。WindowsのspawnはwindowsHide:true、shell:false。

RPCの既定期限は30000ms。期限切れは `STDIO_RPC_TIMEOUT` であり、remote側の操作を取り消した証拠ではない。変更系操作を自動再送せず、利用者は公開契約に従い状態を確認する。起動/RPC/3段階の終了期限は正の整数で最大120000msまで明示でき、短いfakechild試験に利用する。通常CLI/solver/物理設定を変更しない。

fake7試験でEOF正常・遅延SIGTERM終了・SIGKILL終了・終了不能拒否・既終了・RPC期限/破棄・起動失敗を確認。既存perfを含め32試験成功。依存未導入の最初の試行では既存realstdio試験だけが起動失敗し、npm ci後に全成功した。検証対象をskipしたものではない。

[実終了証拠](evidence/2026-10-24-stdio-confirmed-close.json): Win32/Node v24.11.1で別の1回のmetadata-only smokeを実行し、sessions=[]、通常close16ms、exit0/signalなし、exit/close両イベント確認、所有active handle0、stdout data listener0、stream全破棄を確認。GUIpair・solver・token出力/保存はなし。過去fresh評価の終了証拠へ遡及適用しない。
