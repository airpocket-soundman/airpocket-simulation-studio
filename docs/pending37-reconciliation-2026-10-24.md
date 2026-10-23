# 未完37件の候補追補照合（2026-10-24）

[English](en/pending37-reconciliation-2026-10-24.md)

固定base `46ccfcb`。読取専用の棚卸しであり、原本171件/released134/未完37と全親受入条件を維持する。過去の照合記録を上書きしない。

[機械可読一覧](evidence/2026-10-24-pending37-reconciliation.json)に全IDの原本受入・状態・証拠・残件分類を保持した。試験・solver・GUI・外部照会は実行していない。

| ID | 残件分類 | 限定成果と実際の残件 |
|---|---|---|
| MESH1 | implementation | 限定Tet境界検査は追加済み。一般CAD体積化・局所細分・部分領域適合は残る。 |
| REG2 | implementation | 空欄/明示円錐半径の日英条件文と再適用は実確認済み。一般UV矩形・一般曲面精度は残る。 |
| CFD1 | numerical-research | 追加SU2起動2/2消費。N144も全受入不成立。離散流束取得・格子収束・牛精度は未完。 |
| COUPLE1 | implementation | 限定熱流/圧力転送は親連成の完成ではない。熱応力/放射/共役熱の一般連成参照が必要。 |
| FAIL1 | external-measurement | 破断モデルと試験材料校正・独立実験が必要。合成材料点を代用しない。 |
| CFDMESH1 | numerical-research | 壁面解像度・品質・境界対応の一般検証は未完。 |
| CFD2 | implementation | 乱流モデルの適用性・収束・質量収支は未完。 |
| CFD3 | implementation | 圧縮性/多相は研究計画。候補採用・実装・参照試験は未完。 |
| COUPLE3 | implementation | 平面任意P1節点熱流・保存再導出・独立積分は限定達成。曲面/温度/反復連成は未接続。 |
| COUPLE5 | implementation | 時間同期・双方向力保存・安定性の実装/連成参照が残る。 |
| CONTACT1 | numerical-research | 一般接触収束・反力・摩擦参照は残る。 |
| PERF1 | validation | 固定Chrome/IAB規模・取消記録は限定証拠。IABは同Chrome系で別engineではなく全体peak RAMも未完。 |
| PRINT2 | external-measurement | 等価異方性UI/保存/拒否は限定達成。実スライス/実測材料・層/壁/インフィルモデルは残る。 |
| COUPLE4B | implementation | facet固定複素圧力の保存演算子を追加。一般曲面間転送・複素応答・流体付加作用は残る。 |
| CFDPORT1 | implementation | candidate確認→pure cap変換は達成。mainはclosedTet/非index表示で候補mesh provider/版不足、無理なUI接続はしない。 |
| MOD1 | implementation | export/selection/chat等の境界分離と型を追加。全代表GUI/API/MCP同等・保存/数値/取消復元の全網羅は残る。 |
| P0 | implementation | 能力・安定診断は部分実装。全既存操作/実行組合せ・nested契約の完全化は残る。 |
| P1 | implementation | fresh合成線形2mesh/2solveの正式Skill一巡は達成。全物理資料適用性・後メッシュ検査・精度/収束は未完。 |
| P2 | validation | 取得/資源計測部分のみ。回線/端末/別engine・peak RAM・容量不足/解放の全行列は残る。 |
| P3 | validation | stdio実終了とexecutionSettledを追加。実録画切断2件は切断前にcompletedとなり取消未達。全再接続/終了行列は残る。 |
| P4 | implementation | 比較GIF/固定WebMの有界実証を追加。single time・全出力能力/取消・公開等は残る。 |
| P5 | implementation | SolidCraft交換・設計3案の領域対応/収束を含む反復統合例題は未完。 |
| P6 | validation | 限定native Tet4選択/数値比較は追加。一般契約同等・公開全体とは別。 |
| UIIMPROVE1 | validation | REG2/focus/i18n/選択境界は限定確認。全代表操作数/復帰/日英狭幅keyboard公開比較は残る。 |
| AGENTINPUT1 | implementation | 正式MCPの3pointer/focusとlocale修正、fresh合成一巡は達成。全物理preflight/一般品質/精度は残る。 |
| VIEWCOMPARE | validation | GIF熱/音響24枚ledger、固定音響WebM48枚2秒96panel/終端成功。旧実時間欠落保持。異軸/GUI全download/取消は残る。 |
| VIEWTIME | validation | 保存時刻と表示/出力は限定確認。一般伝播精度・全体peak RAMは未完。 |
| PRINTMEASURE1 | external-measurement | 治具/装置停止/校正/剛性補正と実測ログが必要。 |
| PRINTMEASURE2 | external-measurement | 実機Bambuスライス/設定照合/造形条件追跡が必要。 |
| PRINTMEASURE3 | external-measurement | 校正引張圧縮と独立片による材料同定が必要。 |
| BROWSEREXPORT1 | implementation | 固定比較time経路は別能力で成功。single timeは旧MediaRecorder、slice/容量/120枚/GUI保存/MP4等の残条件維持。 |
| RUNTIMEWASM1 | runtime-investigation | PR187単独Linux非再現は根治でない。PR193job-store file失敗も原因不明、V8/OOM署名なしで同因断定不可。 |
| EXPORTBACKGROUND1 | validation | 194/194bのJAforeground切断は両方partial。背景/非選択/日英失効行列・取消部分成果物拒否は未達。 |
| AGENTACP1 | external-integration | 限定text session/検出probeは実装。installed会話認証/本番transport/標準browser実接続は未完。 |
| AGENTCHAT1 | external-integration | 明示providerのDOMなしcontroller/UI境界のみ。本番認証・transport・main mountと全会話一巡は未接続。 |
| RESULTCURVE1 | implementation | 独立線形stepの変位制御/反力curveを追加。非線形状態履歴・実材料校正/一般構造経路は別未完。 |
| FINITEVISCO1 | implementation | 有限Green材料点と入力履歴replayは合成/暫定/未校正。構造solver/塑性/損傷/実験照合は未接続。 |

## 閉じた確認と未解決失敗

PR185〜192の固定候補CI記録はJSONから参照する。PR193初回39984626501はjob-storeファイル単位失敗（2107成功/1失敗/8skip）で、assertion・signal・V8/OOM署名がなく原因未解明。後続通常39986234059・head41a1645は成功（2123total/2115pass/0fail/8skip）、単独39986224476はdefaultでexactly1回・12passの非再現のみ。根治とは呼ばない。raw追補は `evidence/ci193-followup-20261024/summary.json`。新docshead193 CI39987901430とPR194 CI39988201881は照合時running。PR187の単独Linux成功は歴史的失敗の根治ではない。PR194のlocal build/配布物検査成功は最終CIや公開成功へ読み替えない。

比較GIFは熱/音響各24frameの保存時刻ledgerを実取得した。新固定比較WebMは音響合成同軸2caseの48frame/2秒、96panel時刻・終端1.2ms・全bytes/hash/外部decodeを確認した。異時刻軸・single-view・他engine・GUI download完了の確認には広げない。旧MediaRecorder比較の終端欠落も保持する。fresh Skill一巡はGUI pair後の合成線形例で、GUI準備や実材料校正まで無人化した証拠ではない。

194と194bは別要求で各1export。後者はrunning/GUI lockを同一操作内で確認したが、click時focus timeoutで完了前の切断効果を確認できず両方partial。completed artifactは取得可能だった。取消による成果物拒否・復元の成功へ昇格しない。

## 使い切った実行予算

SU2追加起動は2/2で残0（N128延長とN144）。追加格子/再反復/solverを自動実行しない。GIFは3/3、旧実時間音響WebM1/1、新固定比較WebM1/1、orbit194と194bは各1/1。これらは独立した予算で、失敗分も消費に含む。この棚卸しは追加実行を許可しない。

## 次に実装できる小単位

1. **全物理preflightの段階を明示する。** `analysis-preflight.js` と `preflight-physics-coverage.js` を起点に、入力検査・メッシュ後検査・収束/精度の必要事項を分け、定常熱の連結成分anchor（熱接触含む）、音響波長、構造剛体rankはメッシュ後に実装済み。まず静的等方線形のcoverage欠落を直す。requiredInputContractは同契約名を返すが、physicsCoverageへundefinedが渡る。既存/不足metadataを正確に列挙し、allowed・実行許可・剛体mode診断の現在の意味は変えず、`completePreflight:false`を維持する。桁警告や入力存在だけで物理妥当としない。
2. **single-view保存時刻の固定フレーム出力。** 既存比較codec/containerを再利用し、別capability・結果lease・全timestamp encode/decode証明・取消/hidden cleanupを持つ境界を実装する。旧single欠落は未再現なので不具合実測とは呼ばない。orbit/deformationを変えず、実出力は別の明示予算を要する。
3. **FINITEVISCOの非接続referenceを進める。** 材料点の実験条件/観測比較をpure境界として整え、合成・暫定・未校正を維持する。指定F応答を応力自由試験片/反力/永久塑性へ読み替えない。構造単要素接続はtensor/energy/tangentの独立受入を先に設計し、実験校正とダンベルへ飛躍しない。
4. **録画切断の実行面を修復する。** 新exportより先にCUA focus timeoutを切り分ける。要求timestampはクリック成功ではない。意味的cancelの別検証は可能だが、実GUI切断の成功と呼ばない。

公開/merge/配信manifest/公開HTTPSは別の外部ゲートであり、自動mergeしない。37件のどれも本照合だけで親完了にはならない。
