# Saved-file Skill 一巡の独立実行 / Independent saved-file recipe execution

2026-10-23。実装・既存試験・過去QAを参照せず、最終レシピ `skills/airpocket-studio/references/increment-curve-loop.md`、今回のMCP discovery、公開合成A/Bと今回返却された成果物だけを用いて実行した。レシピを途中で改訂していない。最初の手動一巡後に独立consumer scriptへまとめ、新しい使い捨てフォルダで再実行した。証拠JSONは最終script実行の結果。

正式stdio initialize → initialized通知 → tools/list → 曲線保存 → offset 0,1,2,3 の1行paging → CSV/JSON/SVGのUTF-8 byte数・SHA-256照合 → 各形式を別ファイルへ保存して再照合 → 改ざんと上書きの拒否 → 原文hash不変 → stdin EOF終了まで成功した。local repository serverを対象とし、登録済みconnectorの能力は主張しない。

各曲線は4行、失敗gap各1行。最終荷重A=20 N/B=40 N、伸びは共に0.012 mm（浮動小数表現では0.011999999999999999）。失敗行の測定値はnull。CSVは引用符を扱う独立parserでheader 1＋data 8行。SVGはXMLで2panel、A/B identity、step 0→1の線分と孤立step 3、step 2の非描画を確認。script/event/external参照はなかった。

自己申告svgを追加したwrapperは拒否され、新規出力は作られなかった。既存成功出力の再利用も拒否され、byte hashは不変。元公開A/Bのbytes/hashも不変。MCP processはEOFによりexit 0、stderr 0 byteで終了。

再現コマンド（新しい出力フォルダ必須）:

```text
node scripts/verify-saved-curve-recipe.mjs <new-disposable-folder> <absolute-final-recipe-path>
```

Synthetic public references and a newly discovered local stdio server completed the final recipe independently. No implementation or prior QA helpers were consulted. Exact source/runtime identities, source and artifact hashes, row counts, refusals and process exit are recorded in the adjacent JSON. Recipe content remained unchanged throughout execution.

This covers the saved-file route only. Browser pairing/downloads, an open browser project's revisions, real measured accuracy, plastic history, AI login, registered connector discovery and publication remain outside this execution. No recipe deficiency was encountered for this bounded route.
