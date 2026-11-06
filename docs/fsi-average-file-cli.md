# 合成FSI平均力設定の保存ファイル実行

[English](en/fsi-average-file-cli.md)

`node scripts/run-fsi-average.mjs --request <絶対JSONパス> --output <新規絶対JSONパス>` は、[時間平均力方式](fsi-channel-average-force.md)の明示した合成設定を独立Node workerで再計算し、新しいJSONへ保存します。GUI・MCP・材料登録・測定校正は行いません。入力はpure APIの `schemaVersion:1,method:'time-averaged-midpoint'` とfluid/plate/初期状態/dt/steps/microstepsで、出力結果をrestoreする機能ではありません。初期板速度0、SI単位、線形x一様laminar接線壁という限界を維持します。

要求はstrict UTF-8/BOMなしで最大65536 bytes、深さ6・2048値・配列512要素以内です。復号後の重複キー・非有限数・未知core field・不正versionを拒否します。通常ファイルとリンクのない絶対パスを既存の有界FD readerで確認し、読取中の変更・増大を拒否します。元ファイルに書き込まず、snapshotのraw bytes/SHAを成果物へ記録します。読取後の外部編集をロックするものでも、SHAで真正性や校正を保証するものでもありません。親directoryを敵対的に差し替えるOS環境を隔離するsandboxではありません。

計算上限は元kernelの2000000 cell-steps、macro/micro各4096を増やしません。workerのV8ヒープ/スタックには64MiB old/16MiB young/4MiB stackのNode上限を設定します（全process RSSの上限ではありません）。計算実行の既定期限は120000msです。host API `writeFsiAverageFiles(paths,{timeoutMs,signal})` は1..120000msとAbortSignalを受けます。期限はworker実行に対するもので、OSのファイルI/O全体の期限保証ではありません。CLIのSIGINT/SIGTERMは同じ取消へ接続します。取消・期限切れ・workerエラー時は所有workerのterminate完了とexitイベントの両方を待ち、完成成果物を出版しません。

正常時も結果messageだけでは保存せず、workerのexit0と両private streamの終了を確認します。stdout/stderrは親へ転送せず、保持せずdrainします。非empty出力は直ちに拒否して所有workerの終了を待ちます。全配列のdense own data、profileの有限number、全history行の必須数値、work safeinteger/上限、入力の再導出一致を検査してから出版します。重複messageやnull/sparse/nonfinite結果は拒否します。Float64ArrayのprofileはJSONで通常の有限number配列（m/s）へ明示変換します。成果物は最大4194304 bytesで、最大4097行の有界合成回帰もこの容量内です。ただし全ての許容数値で同じbyte数になる保証はなく、最終容量超過は出版前に拒否します。

成果物には `methodVersion:1,synthetic:true,calibrated:false`、raw要求identity、正規化初期設定のcanonical SHA、終了確認、全結果を含みます。canonical SHAも入力内容同一性であり、署名や実測校正ではありません。stdoutは出力bytes/SHAと有限の終端診断を含む小さいsummaryです。通常終了は0、失敗は1で安定codeだけを返します。raw入力本文・stackは返しません。利用可能な失敗snapshotのSHAは残します。

出力はexclusive atomic publicationで既存ファイル・directory・linkを置き換えません。同時2実行は1件だけが完全な成果物を出版します。出版開始がcommit点で、それ以後の取消では完成ファイルを取り消しません。実CLI成功/競合、実worker取消終了、timeoutで終了待ちするhost境界、独立1step拡散oracle、最大history、型と不正protocolを回帰しました。GUI/実測/一般FSIの成功とは区別します。

## 正式MCP

`studio_run_fsi_average({request,output})` は同じ保存サービスを使います。`studio_capabilities.fsiAverageSavedFiles` はNode対象だけavailableです。新規ファイルを書き出す非冪等な操作で、browser入力を変更しません。この同期stdio呼出しは固定120秒worker期限を使い、別の取消通知を保証しません。Node API/CLIの取消とは区別してください。
