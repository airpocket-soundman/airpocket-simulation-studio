# SLS/Prony往復の読取専用ファイルCLI

[English](en/printed-sls-prony-cli.md) · [物性変換と限界](printed-sls-prony-roundtrip.md)

`node scripts/roundtrip-printed-sls.mjs --config "D:/examples/config.json" --config-sha256 "<原文64桁小文字SHA256>" --output "D:/examples/new-report.json"`

既存の合成SLS/Prony往復APIへ、原文固定のファイル入口を追加します。材料・解析入力の変更、実測/校正、GUI/MCPへの接続は行いません。stdoutは小さいJSON要約1件だけで、曲線は出力ファイルに保存します。完了は処理が終わった意味で、精度合格ではありません。終了コードは0=completed、2=理由付きrefusedを保存、1=引数/IO等errorです。stderrへ入力・stackを流しません。

configはUTF-8/BOMなし、最大65536B、重複したdecoded key・深さ8超・1024値超を拒否する専用parserです。schemaVersion1と、以下をすべて明示します。

- training / validation: `{path:絶対パス, expectedSHA256:原文64桁小文字hash}`
- options: model=`sls-relaxation`、maxStrain、minPoints、maxRelativeStandardError、holdStrainTolerance
- specimenPairs: trainingSpecimenId / validationSpecimenIdの完全な1対1配列（最大8）
- bulkModulusPa、rampDurationSeconds、workerMilliseconds（整数1〜30000）

config自身のSHAもCLI引数で固定し、3原文すべてのSHAが一致してから計算します。各datasetは最大2MB、regular fileのみ、symlink/junction成分・role間hardlink/同一パス・既存出力を拒否します。既存の有界read/stat前後検査・UTF-8検査・原子的exclusive JSON公開helperを再利用します。原文を自動修正せず、同時writerでも既存ファイルは上書きしません。これは完成bytesの原子的公開であり、停電に対するfsync耐久保証ではありません。

専用Node workerを1つ所有し、終了イベントを確認するまで結果を公開しません。期限にはworker起動・計算・返信/終了待ちを含みます。期限/Abortはterminateを要求し、実exitを待ってからresult:nullのrefusedを公開します。cleanup待ちは期限を超えることがあり、早期解放やOS全native仕事の停止を証明しません。main側のファイルIOはバイト上限付き協調処理で、hard IO deadlineはありません。SIGINT/SIGTERMの1回目をAbort要求へ接続します。強制kill/複数信号の無条件cleanupは主張しません。

最終のAbort確認後、publishJson呼出し開始を公開判断の不可逆境界とします。その後のAbortで完成ファイルを消しません。要約のabortObservedAfterPublicationで後着Abortを識別します。worker未終了・timeout・partial curveをcompletedと混同しません。temporary unlinkの警告も既存helperのcleanupWarningとして保持します。

service `writePrintedSlsPronyReport({config,configSha256,output},{signal})` はMCP等が将来再利用できる小さい要約を返します。今回MCP登録や権限は追加していません。変換は明示K/有限仮想ランプ/微小振幅・時間刻み極限の整合確認だけで、Young/せん断τは同一ではありません。全結果は未校正・精度未検証・材料未適用です。

[CLI証拠](evidence/2026-11-07-printed-sls-prony-cli.json) · [原本pack](evidence/2026-11-07-printed-sls-prony-cli/verification.json)


Workerのstdout/stderrは専用streamへ隔離し、非空ならWORKER_STDIOで拒否します。内容を親stdout/stderrへ流さず破棄し、観測byte数だけ4097で飽和・超過flagを記録。実worker exitと両stream end/closeを待って公開します。純JS workerはexecArgv:[]としてinline hostの非互換flagを継承しません。実際の--input-type=module -e入口も回帰確認済みです。隔離追加前の実CLI原本bytesは履歴として変更しません。

## 正式MCP

`studio_roundtrip_printed_sls({config,configSha256,output})` は同じ保存サービスを使います。`studio_capabilities.printedSlsPronySavedFiles` はNode対象だけavailableです。新規ファイルを排他的に保存する非冪等な操作で、実測校正・材料適用やbrowser権限を追加しません。configの明示worker期限を使い、同期stdioの別取消通知は保証しません。
