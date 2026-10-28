# Codex引き継ぎ（2026-10-19）

[English](en/codex-handoff-2026-10-19.md)

利用者の「いったんコミットプッシュして引き継ぎ資料を書く」に対応する記録。本資料の作業ブランチは`codex/handoff-2026-10-19`、起点は公開済みmain `d2d20c09b3dbbf568c596a503276c187267fc490`。今回は資料をcommit/pushするだけで、新たなmerge・公開は行わない。再開時には現行Git/公開manifestを再確認する。

最初に読む順序は、本書→[今回の公開証拠](evidence/2026-10-19-publication-d2d20c09.json)→[全体経路](task-critical-path.md)。roadmap・progress・個別仕様は、次に選んだ既存IDの必要部分だけ読む。

利用者はタスク全般でサブエージェントの並列活用とトークン節約を希望している。担当ファイルを分け、既存証拠を再利用し、細切れの確認依頼で止めず、意味のある開発単位を検証・ボード更新・公開までまとめて進める。今回の区切りでは追加開発はせず、資料のpushで停止する。

## 確定した公開状態

- [PR #125](https://github.com/airpocket-soundman/airpocket-simulation-studio/pull/125)はmerge済み。PR/main両CIは**1594件、1591成功・3skip・失敗0**。mainの`verify`/`deploy`/`verify-published`は全成功。
- 公開manifestはmain SHA一致・`dirty:false`。`release-d2d20c09b3dbbf568c596a503276c187267fc490`のpeeled SHA、公開progressとhistoryのhead/hashも一致。[公開証拠](evidence/2026-10-19-publication-d2d20c09.json)を正とする。古い`release.testCount:1570`等はPR124時点のbaselineで、今回の失敗や最終件数を意味しない。
- **171タスク＝released 133＋未完38（queued 19・building 14・checking 5、ready 0）**。既存未公開計画から`AGENTACP1`/`AGENTCHAT1`/`RESULTCURVE1`/`FINITEVISCO1`の4件をqueuedとして計上した。完了の後退ではない。[照合記録](evidence/2026-10-19-planning-reconciliation.json)。親エピックや製品/Skillの全受入を閉じてはいない。
- リポジトリSkillと既存installed Skillの**13ファイルを同期・照合・検証済み**。[同期証拠](evidence/2026-10-19-skill-sync.json)。同期はMCPの新規登録/有効化ではない。現行宣言は35 default/37 paired tools、live 91、minimal connector 3。会話に実登録されたtoolを先に発見する。

## 今回公開した3つの増分

| 対象 | 成立した範囲と根拠 | 維持する限界 |
|---|---|---|
| REG2 球面寸法領域 | 単一STEP/組込み球の緯度経度sector。`selectSphericalRegion`→条件寸法保持→CAD分割。解析面積、極cap/全球/任意軸、再メッシュ、123N/37W保存、実STEP Worker反力とケースJSON復元。[core証拠](evidence/2026-10-19-spherical-cad-region.json)、[正式MCP＋Chrome入力保存](evidence/2026-10-19-preflight-gui-spherical-browser.json) | 新GUI selectorなし。一般UV/複数体積/STL/流体/球面thermalContactは未対応。browser file chooser再import・sphere browser solve・SolidCraft連携は未実証。 |
| VIEWCOMPARE GIF | orbit/time/deformation、固定24枚・640×320・RGB332。orbitはi/24、時間/倍率はi/23で両端。整数delay合計は指定秒数。正式MCP/Chrome・外部decode・GUI取消/再作成・元4状態一致。[証拠](evidence/2026-10-19-comparison-time-deformation-gif-real-chrome.json) | 時間は近傍保存フレームのみ、色範囲/カメラ固定。変形は表示倍率で載荷履歴ではない。単一ビューGIF/MP4、一般形状、OSダウンロード完了は未確認/未対応。 |
| UIIMPROVE1 解析前チェック | 共有preflightのsolve/mesh報告、code/pointer/提案、既知入力へのfocus、変更時のstale無効化。実Chromeでlegacy表示、size修正、材料欄、EN→JA→EN・390px。[証拠](evidence/2026-10-19-preflight-gui-spherical-browser.json) | `completePreflight:false`。provisional:true/API無変更一致はunit根拠。未登録物性draftは対象外。全診断の翻訳や共通6caseの負担測定は未完。 |

仕様は[球面](reg2-curved-regions.md)、[比較](view-compare-design.md)、[操作/API](automation.md)、[GUI対応表](operation-correspondence.md)を参照。上記3タスクはbuildingのまま。新しい物理閾値や許容緩和、表示倍率からの物理履歴の捏造は行っていない。

## 保全した旧計画と作業場所

primary `D:/github/airpocket-soundman/airpocket-simulation-studio`には利用者のdirty 5ファイルをそのまま残している：`docs/roadmap.md`、`docs/en/roadmap.md`、`docs/printed-parts.md`、`src/board-strategy.js`、`src/progress.json`。一時indexで作ったcommit **`887d72ae18eb47d2c4ec14fd3ac26c64209b7a23`**をremote **`codex/planning-snapshot-2026-10-19`**へpush済み。primaryのファイル・index・branchは変更していない。

**このsnapshotは古いPR12相当baseの保全物。現行実装へ丸ごとmerge/cherry-pickしない。** 計画の意図と4件の追加計上はPR125へ照合して取り込んだ。参照用に残し、現行の正はPR125/mainとする。

- 今回の資料作業：`C:/Users/yamashita_y00031/.codex/worktrees/thermal-compare/airpocket-simulation-studio`（branch `codex/handoff-2026-10-19`）。
- もう一方：`C:/Users/yamashita_y00031/.codex/worktrees/next-fluid-plan/airpocket-simulation-studio`。再開前にbranch/statusを確認し、旧候補を現行mainと思い込まない。
- 両worktreeの依存物・既存`node_modules`/CAD/WASM/build cacheを再利用し、不要な再clone・大規模download・全削除を避ける。junctionを削除/移動する前に実体と対象を確認する。成果物のcache一致を公開済みSHAの証明に代用しない。

SolidCraftは**0.16.1へ更新済み**。旧版不要という利用者指示はソースrepo/CAD設計/設定の削除を含まない。Studioとの統合成功は未実証。SolidCraft作業のtemp cleanupは**automatic approval reviewに拒否されたため、同操作や経路を変えた再試行をしない**。未実施のcleanupを成功扱いしない。Studio QAのowned tab/bridge/dev/private pairing file cleanupは各証拠に記録した範囲で完了している。

## 次の優先と未完条件

1. [全体経路](task-critical-path.md)と[roadmap](roadmap.md)、現行progressを読んで、既存ID内の小さな受入単位を選ぶ。次段の計画は既存API/MCP・モジュール境界を土台とするACP/会話接続（AGENTACP1/AGENTCHAT1）と版付き載荷段階データ（RESULTCURVE1）。FINITEVISCO1は校正/実測と段階検証が必要で、J2/Neo-Hookeanや表示倍率で代替しない。
2. AGENTINPUT1/UIIMPROVE1等の入力・診断・修正導線は自律的に進められるが、親P0〜P6や物理妥当性を一緒に完了にしない。REG2の一般曲面、CFDPORT1の任意wire/局所蓋/一般体積結合等も残る。
3. CFD接続体積は、許容STEP 3表現のCAD-only参照で既存cutが内部512mm³を1volumeへ統合することを確認済み。`tests/internal-fluid-step-connectivity-cad.test.mjs`を再利用し、public gapの再現入力なしに将来用fuse helperだけを追加してfeature完了にしない。別cavity・辺/点接触は未評価。
4. RUNTIMEWASM1はchecking。Node24系の`jit_page.has_value()` / `jit_page_->allocations_.erase(addr) == 1`のV8 fatalが既知。[記録](evidence/2026-10-18-runtime-jit-failure.json)、[比較診断の限界](evidence/2026-10-18-runtime-comparison-smoke.json)。今回CI成功や単独再試験成功を根治扱いせず、黙ったflag変更・skip・物理閾値緩和はしない。
5. EXPORTBACKGROUND1の本物のhidden録画確認は**利用者が今は操作できず手動待ち**。繰返し依頼しない。停止監視/復元のunit成功と実hidden証明を分離する。材料/造形実測、登録済SDK型投影、一般形状/公開接続の残条件も保持。

## 実Chrome再検証の方法と後片付け

対象worktreeで既存依存物を使い、他のQAとport/CPUを調整する。sourceを凍結して**no-HMR**のlocalhostを使う。今回HMR中にpage reset/ケース消失/命令detachを観測したが、原因同一とは断定していない。

正式stdio MCPの`initialize`/`tools/list`→利用者GUI pairing→必要最小scope→実toolで操作する。出力manifest/SHA、保存入力revision、ケースrevisionと元の入力/ケース/結果/比較設定を記録し、成功/取消/再作成後の復元を確認。browserのメモリ状態をNodeホストで代用した場合は区別する。公開HTTPSはこれまでのinspect-only証拠を超えて自動で権限拡大しない。

pairing code、token、資格情報、環境変数や秘密入り一時ファイル内容を文書・標準出力・chatへ出さない。自分のtab/MCP/bridge/devだけを閉じ、owned jobのsettled/解放と秘密ファイルcleanupを記録する。未確認・タイムアウト・自動審査拒否はそのまま残す。今回の資料作業には新fulltestは不要で、差分/リンク確認後にrootがcommit/pushする。
