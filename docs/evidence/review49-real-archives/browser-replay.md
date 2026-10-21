# Chromeと正式MCPの再実行

1. source56576af6でqa-review49-archives.mjsを空出力先へ実行。既存資料を上書きしない。
2. localhost Chromeでcombined.jsonをImport case archiveする。実Node計算の保存結果でありChrome再計算ではない。
3. 公式studio-browser-mcp.mjsを同originでstdio起動。codeはメモリだけに保持し既定inspectのみGUI接続。
4. 各ケースをView saved result in 3Dし正式getResultView(frameLimit:0)を読む。GUI/Node/MCPのsnapshotStorageを照合。
5. nodeCount=xyz長/3、bytes=nodeCount*count*8。反復inspect/caseList/getResultViewで入力/ケース/view不変を照合。
6. 実reload後にarchive再import、新inspect接続がConnectedになってから現在sessionIDを取得し再読取。summary/resultRevisionを比較。
7. timeoutは成功と合算しない。GUI Disconnect、stdio EOF、所有server終了。tokenを証拠へ残さない。
