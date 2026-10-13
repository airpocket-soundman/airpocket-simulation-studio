# MCPと専用skill

[English](en/automation.md)

`npm run mcp`はローカル標準入出力のMCPサーバーを起動します。[MCP 2025-11-25のツール仕様](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2025-11-25/server/tools.mdx)に対応し追加ライブラリは不要です。初回は`npm ci`と`npm run build`でWASMを準備してください。

6ツール: `studio_progress`（進捗）、`studio_inspect_project`（保存入力検証）、`studio_analyze`（CPU解析／メッシュ）、`studio_probe`（保存解析の点測定）、`studio_validate_cases`（ケース集検証）。ファイルパスは絶対パスを使います。解析は新規`outputPath`へ完全な結果JSONを保存し、要約を返します。入力・既存出力は上書きしません。ブラウザと同じWorkerを独立したNode workerで実行し、120秒で終了します。Airpocket CPUとMFEMに対応し、WebGPUは対象外です。

例: `studio_analyze`へ`{"path":"D:/work/project.json","outputPath":"D:/work/result.json","size":5,"method":"wasm-pcg"}`を渡します。`studio_probe`の`point`はmm、結果は各解析の物理単位です。UIから保存した入力JSONを使い、材料の出典と有効範囲を確認してください。

Codexへの登録（位置が異なる場合は変更）:

```powershell
codex mcp add airpocket-studio -- node D:/github/airpocket-soundman/airpocket-simulation-studio/scripts/studio-mcp.mjs
```

[公式MCP設定手順](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)を参照。`skills/airpocket-studio`を個人の`.codex/skills/airpocket-studio`へコピーして専用skillを使えます。

MCPはローカル保存JSONを操作し、開いているブラウザを変更しません。画像・動画はブラウザUIを使います。MCP計算の成功は画面・GPU・任意形状の物理精度の検証とは別です。

`studio_material_catalog`で同梱した樹脂物性を検索できます。[材料ライブラリ](polymer-library.md)。
