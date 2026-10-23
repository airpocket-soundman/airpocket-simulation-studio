# 未完検証と未実装の全数照合（2026-10-23）

[English](en/verification-inventory-2026-10-23.md)

固定候補 `5647a6ff36e2ff5e5a886e770d9e2cb1829c5b72`、進捗原本、既存監査、並列実装記録、52〜71の20指示を照合した。[機械可読一覧](evidence/2026-10-23-verification-inventory.json)には原本SHA-256と全37未完IDの受入条件を保存する。指示書はprimaryのdocsフォルダを読取参照し、primary・共有進捗・既存監査は変更していない。

**既存実装の追加検証、新機能の実装、外部の実測・認証条件は別の残件である。** この監査は既存機能を実装済みと仮定して全件合格にするものではない。後続担当が並行中の実機・runtime検証は、固定候補の証拠へ先取りして記録しない。

## 指示52〜71の照合

| 指示 | 固定候補に存在するもの | 残る作業の種類と内容 |
|---|---|---|
| 52 | 実解析からの段階bundle、移動bounds・容量・残差の監査修正 | 既存実装の最終候補CI/公開検証。変位制御・一般非線形履歴は別の未実装機能 |
| 53 | 単一/比較グラフと限定実Chrome証拠 | 既存実装のBlob全bytes/hash、拡大、390px、遅延選択、入力版不変、HTTPS一巡の検証。root担当 |
| 54 | 有界ACP text sessionと合成child回帰 | 限定単位の自動検証あり。実Codex入口/認証は外部条件、GUI/MCP委任は未実装機能 |
| 55 | 接続status UI、54のNode session | 会話パネルへのsession配線・世代破棄・送信/停止は未実装。日英/390px/keyboard検証は実装後の条件 |
| 56 | 復元job発見・requestId拒否・settlement試験 | 既存契約の実stdio停止/再起動/取得不能/新要求の一巡照合。結果永続化の新設はこの指示の対象外 |
| 57 | 背景録画・lock解放・限定hidden証拠 | 既存実装の実録画中失効、日英、通常/背景/非選択の実機検証。root担当 |
| 58 | Chrome2規模のcold/warm/取消測定 | 既存計測のcase間3秒idleと正規exportProject snapshot/hash不足。測定手順修正と再計測が必要 |
| 59 | 他browser計測の計画 | 58の固定入力が前提。第2browser能力確認・同一入力cold/warm/取消測定は未実施。未導入browserの取得は条件にしない |
| 60 | SU2細meshのraw/config/hashと評価器 | 既存参照のCd mesh差4.1226959%が3%許容を超過。既存予算内の追加数値検証が必要。許容緩和不可 |
| 61 | 節点遠方積分とSU2 adapter | solver積算の離散面流束取得/parserは未実装・出力裏付け不足。既存節点積分の成功で置換不可 |
| 62 | prepared Tet4 record/力・モーメントvalidator | 境界節点集合→recordの変換が未実装。既存host/WASM成功はこの新変換の実証ではない |
| 63 | 測定dataset取込と単位/分離/原文hash | 今回、正確な容量境界・独立圧縮数値・型API回帰を補完。実データ/校正は外部条件、材料同定/GUIは未実装 |
| 64 | 明示開口確認→既存half-space cap | 今回、ID/mesh版/内側余裕/法線許容の境界と型API回帰を補完。局所CAD蓋・任意wire・UIは未実装 |
| 65 | 限定直交セルの適合Tet4生成 | 今回、最大容量で独立体積・全境界の外向き・面積を補完。一般Gmsh境界層/流れ/y+は未実装 |
| 66 | 線形非一様熱流の総量と単一triangle節点参照 | 別分割の独立節点積分、部分被覆の扱い、保存演算子同値の追加検証/対応範囲照合が残る。一般反復solverは未実装 |
| 67 | penalty独立解析解・開離/接触/除荷/逆荷重 | 限定静的試験を独立監査済み。一般履歴/摩擦/3D接触は未実装であり、単なる再試験では閉じない |
| 68 | 閉Tet複素圧力の合力/モーメント/剛体虚仕事 | 限定独立検算済み。一般曲面精度・本番連成solverは未実装/未検証 |
| 69 | time/view helperとmain選択経路 | 選択世代・非同期取消の対象1経路分離とA→B→A等の追加回帰が未実装。既存helperの全体成功では代替不可 |
| 70 | 専門Skillと単一/比較MCP | 曲線手順改訂とfresh独立一巡が未実施。実MCP全bytes/hash・入力不変・改ざん拒否はroot担当 |
| 71 | 進捗/公開milestone validator | この全数一覧は入力資料。採用PR/headと最終CI/manifest/公開verifyを結んだ候補監査は未完 |

## 今回実行して閉じた検証不足

- PRINT2: 正確に2,000,000 UTF-8 bytesを受理し1 byte超過を拒否。100試験片、合計10,000 sampleを受理し各+1を拒否。2×5 mm断面・−30 N・−0.4/20 mmから−3 MPa/−0.02を独立計算し、m/kN入力と完全一致。
- CFDPORT1: 64文字cap IDと安全整数mesh版の両端、範囲外/小数/負版を照合。既存1e-6 mmの厳密内側余裕と1e-8法線許容を緩和せず試験。
- CFDMESH1: 最大512 wall layersから2,056節点/3,078 Tet4。別の三重積計算で全体積2,000 mm³、全Tet正体積、外部面の外向き、上下壁各2 mm²、全境界面積ベクトル和0を確認。
- 63/64/65: 公開runtime importを使う正例/負例の型fixtureを通常Node試験からコンパイル。64/65のruntime隣接宣言を追加し、既存64 fixtureも毎回実行する。これまでは宣言ファイル自体の検査と手動fixture実行で、通常全体試験への自動組込が不足していた。

関連99試験が成功、失敗0・skip0。契約10宣言の検査と差分検査も成功。実物性・一般流体精度・実ブラウザ・公開の成功件数へ読み替えない。既存65の7セル参照（20 mm³、上下壁各2 mm²）と容量超過拒否も再実行した。

## 全37未完IDと公開ゲート

`src/progress.json`の再集計は171件、released134・queued12・building21・checking4、未完37。状態は変更していない。`task-critical-path.md`冒頭の集計値とは整合するが、文書内の過去のqueued/building数と試験件数は履歴である。

| 群 | 全ID | 未完を維持する理由 |
|---|---|---|
| 既存実装の検証と追加実装が混在する15件 | REG2, CFDMESH1, COUPLE3, CONTACT1, COUPLE4B, CFDPORT1, PERF1, UIIMPROVE1, AGENTINPUT1, VIEWCOMPARE, VIEWTIME, BROWSEREXPORT1, AGENTACP1, AGENTCHAT1, RESULTCURVE1 | 各親受入に一般形状・精度・GUI/API/MCP・保存互換・実機/公開等がある。上の限定単位完了では親完了にできない |
| 実測/実機/外部条件を含む7件 | PRINT2, PRINTMEASURE1, PRINTMEASURE2, PRINTMEASURE3, RUNTIMEWASM1, EXPORTBACKGROUND1, FINITEVISCO1 | 材料/機器校正と実測、runtime原因、実browser失効等の証拠が必要。ソフト側の実行可能検証は別途進める |
| 親エピック15件 | MESH1, CFD1, COUPLE1, FAIL1, CFD2, CFD3, COUPLE5, MOD1, P0, P1, P2, P3, P4, P5, P6 | 子機能・研究・限定合成入力の成功だけでは受入全体を満たさない |

公開milestoneは6 gate中1 complete・5 pending。既存completeは過去候補固有の記録で、`5647a6f`のCI/配信/公開を証明しない。本監査ではネットワーク上の候補CI/manifest/verifyを再取得していない。未公開候補を公開済みへ昇格せず、他担当の最新証拠は最終統合時に照合する。
