# REG2と入力案内の実画面追補（2026-10-23）

[English](en/reg2-agentinput-main-iab-2026-10-23.md) / [固定候補の再照合](verification-followup-reconciliation-2026-10-23.md)

root担当が固定source `35e5b0a` の実main画面をIAB2で操作し、別担当が取得済み証拠を整理した。[集約JSON](evidence/2026-10-23-reg2-agentinput-main-iab.json)にsource git blob/SHA-256、保存証拠のbytes/hashと限界を保持する。ブラウザはChrome155系の縮約UAを返すIABであり、独立したChrome extensionの実行証拠ではない。画像は1280×720。親受入・未完37件・公開状態は変更していない。

## REG2の空欄と明示半径

既存 `tests/conical-wiring.test.mjs` と同じgmsh円錐STEP/Three表示の生成法による合成入力を、QAページの公開studio APIから読み込んだ。実mainの円筒指定で半径10 mm、終端空欄、許容差2 mm、Y軸方向−10〜10 mm、開始315°・幅90°を選択し、384三角形へ100 N条件を登録した。

条件文は「半径 10 mm」で、`undefined`や0への矢印は出ない。数値領域再適用後も終端欄は空。終端8 mm・許容差0.3 mmの第2条件は「半径 10 → 8 mm」となり、日英の表示を確認した。[比較画像](evidence/reg2-agentinput-iab-20261023/reg2-blank-and-explicit-en.jpg)と[DOM原文](evidence/reg2-agentinput-iab-20261023/reg2-observed-text.json)を保持する。空欄は円筒指定であり、円錐形状の自動推論ではない。

保存JSONは593,069文字で、CUAの200k出力上限により全文取得が切れ、取得文字列のJSON.parseは失敗した。その後DOM内でJSON.parseした条件/source要約のみを取得し、source kind=step、第1条件は終端半径なし、第2条件は8を確認した。全文bytes/hashは未確認。ソルバーは起動せず、元CADとの厳密一致・メッシュ精度・力保存を今回の画面確認から主張しない。

## AGENTINPUT1の正式MCPとfocus

既存 `docs/evidence/review46-chrome/valid-warning.json` を正規に読み込んだ。Young成分1000/2000/3000 Pa・条件2件に対し、日英のGUIで3つの正確なpointerと専用編集欄未実装のfallback案内を確認。Tab→Enterで最初の案内へ到達し、全3案内をEnter実行して `material-status` のfocus、親detailsのopen、可視outlineを両言語で確認した。[EN画像](evidence/reg2-agentinput-iab-20261023/agentinput-focus-en.jpg)、[JA画像](evidence/reg2-agentinput-iab-20261023/agentinput-focus-ja.jpg)、[GUI読取](evidence/reg2-agentinput-iab-20261023/gui.json)を保持する。

正式stdio MCPをinspect-onlyでpairし、GUIと3診断のtargetを照合した。EN/JAのbefore/after計4回のrevisionは `sha256:3879741459419d04e78ac5ee4e323604572f68174812e0ba5838ca1d343ab62d` で完全一致、両inspectEqual=true。秘密値を除いた[EN全report](evidence/reg2-agentinput-iab-20261023/mcp-report-en.json)、[JA全report](evidence/reg2-agentinput-iab-20261023/mcp-report-ja.json)、[contract](evidence/reg2-agentinput-iab-20261023/mcp-contracts.json)を保存した。

mesh-sizeを6に変えると旧diagnosticsは空になり、fresh checkで3件へ復帰。既存valid-inrange fixtureでは単位警告0件。[無効化読取](evidence/reg2-agentinput-iab-20261023/invalidation.json)。これは全物理preflightの完成や入力作成→solve→中間取得のSkill一巡ではない。JAのfallback案内は日本語だが、focus先material-statusの文はこの観測では英語のまま残った。後続修正の成功は先取りしない。

## 再現と終了

既存cone生成法とreview46 fixtureを、公開 `studioApi.loadProject` のQAボタンから読み込み、mainの既存 `cylinder-*` / `preflight-run` / `preflight-diagnostics` / `material-status` を操作する。診断の正規値・受入手順は `docs/opencode-review-followups-2026-10-21/46-AGENTINPUT1.md` と `docs/evidence/review46-chrome/replay.md` を参照する。資格情報を含むdriverのコピーや自動再接続は保存しない。

所有stdio childの終了と一時pairing file削除を[cleanup](evidence/reg2-agentinput-iab-20261023/driver-cleanup.json)で確認。GUIは切断しendpoint/codeを空にし、所有tabとserverを終了した。編集要求・実solverはなし。i18n修正 `115ff39` 後、外部流体の現説明全文が実EN DOMで英語になることもrootが確認したが、画像は未保存なので画像証拠とは呼ばない。
