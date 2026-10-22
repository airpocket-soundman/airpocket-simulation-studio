# 複数ケース同期表示の設計メモ(VIEWCOMPARE 第1段階)

[English](en/view-compare-design.md) / 関連: [結果ビューアと出力の製品仕様案](result-viewer-direction.md)

## 2026-10-22: 時間出力の各panel時刻をmanifestへ記録

時間比較GIFの完了manifestは、既存の開始/終了概要に加えて `time.frameTimings.entries` を持つ。各entryの `renderIndex`、`phase`、`requestedTimeSeconds` と、各panelの `caseIndex`、保存 `frameIndex`、実保存 `timeSeconds`、符号付き `offsetSeconds`（保存−要求、秒）を記録する。`caseIndex` は同じmanifestの `comparison.cases` を参照し、caseId・保存case revision・resultRevision SHAに結び付く。物理状態を補間・新規解析していない。

GIFでは実エンコード経路が呼ぶ24描画を出力順に記録し、途中frameも検査できる。WebMは既存の開始/終了と選択方針の概要を維持し、個別の描画/符号化frame時刻ledgerは提供しない。MediaRecorderが重複/脱落させる可能性があり、滑らかなfpsやframe枚数を保証しない。

ledgerは最大2048描画かつ60KiB、全manifestは最大64KiB。途中で上限を超えた場合は切り捨てずexportを失敗させ、host lockを解放して部分成果物を公開しない。このledgerは固定24frameのGIFだけに適用し、既存WebMへ新たな描画回数/ledger byte上限を課さない。既存PNG等の4KiB制限、requestとschemaVersion、概要metadataは維持する。非等間隔の異なる2caseについて実adapter→共通queue→manifest経路を試験し、GIFは実encoderを使う。新コードの実Chrome/WebMデコード再検証は未実施であり、VIEWCOMPARE親の全面完了を意味しない。

以下の第1・第2段階は2026-10-16時点の履歴です。現在の実装と制限は末尾の追加記録および[自動化API](automation.md)を参照してください。

策定日: 2026-10-16。実装済みは純粋な計算モジュール `src/view-compare-layout.js`(domain層、DOM・three.js・ケース保管に依存しない)と単体テストのみ。**画面(GUI)、PNG/動画の書き出し、MCP/API操作は未実装**で、板の VIEWCOMPARE は未完了のまま。

## 実装した規則

- `computeSharedRange`: 2〜4ケースの表示量の最小・最大から共通色範囲を作る。物理量(field)または単位が一致しないケースの組は拒否する(異なる量に共通尺度を付けない)。最大と最小が等しい場合は広げ、`padded: true` を返す。戻り値の `colorRange` は既存のビュー設定 `colorRange` と同じ形。
- `resolveSharedTime`: 物理時刻を指定し、各ケースの保存済みフレームのうち最も近いものを選ぶ。ずれ(秒、符号付き)を必ず返し、許容値を超えるケースは拒否する。時間軸のないケースは `timeApplies: false`。表示補間は行わない。
- `sharedScalars`: 変形倍率(0以上)と載荷倍率を一度だけ検証し、全パネルに同じ値を使う。
- `layoutPanels`: 出力画像の整数矩形を返す。2ケースは左右、3〜4ケースは2列。各パネルの上にラベル帯、下に共通凡例の帯。重ならず、サイズが小さすぎる場合は拒否する。
- `panelLabel`: ケース名と条件(名前・値・単位)を行にする。単位のない条件は拒否する(無次元は `1` と書く)。
- `planCompareView`: 上記と共通カメラを一つの計画にまとめる。

## 未実装・未検証

- 結果ビューア(`src/main.js`)への左右2画面の接続、ケースごとの値の範囲の取得、共有カメラの同期操作。
- PNG・動画の書き出し(既存の visual-export への接続)、進捗・中止、再読込後の状態保持。
- MCP/APIでの配置・書き出し操作と、GUI操作対応表・対応テスト。
- 実ブラウザでの確認。単体テストは合成データのみ。
- 載荷倍率は値の検証のみで、結果の再計算や載荷倍率軸の保存済みデータとの対応付けは行わない。

次の段階: ビューア側のアダプタで各ケースの範囲・フレーム時刻を集めて本モジュールに渡し、得た計画を既存のビュー設定APIで各パネルに適用する。

## 第2段階(GUI、2026-10-16)

「保存したケース」欄の下の「2ケース並べて比較」(`#compare-left` `#compare-right` `#compare-time` `#compare-run` `#compare-png`)。既存の結果描画(`showAnalysis`)でケースを順に描き、画面外で複製した画像を2D canvas(`#compare-canvas`)に左右に並べる。プロジェクト入力は変更せず、描画後に表示中の結果・色範囲・フレームを復元する。共通カメラは現在のカメラ、変形倍率は現在の入力、物理量は現在選択中のもの。色範囲は各ケースを自動範囲で一度描いて最小・最大を取り、`computeSharedRange`で固定範囲にして描き直す。過渡音響は共通の物理時刻を入力し、保存フレームへのずれを凡例に表示する。ラベルはケース名、メッシュ寸法(mm)と代表値(単位付き)。PNGは比較用canvasの保存(ビューアの`#view-png`とは別の経路)。

未実装: 動画書き出し、MCP/API操作、再読込・中止後の状態保持。実ブラウザでは未確認(偽DOMの単体テストのみ)。固有モードはモード0固定。


## 画面の仕上げ(2026-10-16)

実ブラウザでの所見を反映。各パネルの凡例帯に、3D結果表示と同じ色マップ(`result-view-api.js` の `colormapHsl`、main.jsから注入)のグラデーション色バーを描き、左端に最小値、右端に最大値と単位を表示する(幾何は `legendBars`)。物理時刻とずれは `formatSeconds` で有効数字5桁・us/ms/s の単位付きにし、符号付きのずれ表示は維持する。パネルは結果表示欄で選択中の物理量に従い、過渡音響の組は先に過渡結果を表示する必要があるため、その旨の説明行を追加した(日英)。契約・計算規則は変更なし。

## 過渡熱の保存フレーム比較

保存温度フレームを持つ熱ケースも、共通の物理時刻から最も近い保存フレームを選び、実時刻と符号付きのずれを凡例に表示します。補間は行いません。時間選択の対象は温度のみで、熱流束は最終結果のみです。数値比較の`caseCompare`と`studio_compare_cases`は明示した`frameIndex`で温度フレームを選び、保存時刻が完全一致する場合だけ差を返します。熱流束に`frameIndex`を付けると拒否します。熱の数値比較で`frameIndex`を省略した場合は従来どおり最終結果を使います。この追加の実Chrome確認は未実施です。


## 比較設定のブラウザ内自動保存（2026-10-17）

比較欄の「比較設定をこのブラウザに自動保存する」は既定で無効です。有効にすると、「比較を表示」が成功した後、または有効な手動プリセットを取り込んだ後の設定を1件だけ保存します。保存するのは、保存ケースの内容ハッシュと表示量・共有物理時刻/許容差・カメラ・変形倍率を含むportable設定です。ケース本体、PNG/WebM、接続トークンは保存しません。無効化しても候補は残り、その後の自動更新を止めます。「保存した比較設定を削除」は自動保存を無効にし、設定を含まない削除記録を書き込みます。

再読込時は候補の有無を表示するだけで、ケース読込・設定適用・比較描画を自動実行しません。変更のないケースを別途読み込み、「保存した比較設定を復元」で復元します。既存のrevision照合と世代ガードを使い、読込待ちの間の新しい利用者設定を古い復元で上書きしません。ケースの内容ハッシュが欠落・重複・変更されていれば復元を拒否し、候補と現在の表示を残します。復元後の確認には「比較を表示」を使います。

保存範囲は同じブラウザ/オリジン内です。専用IndexedDB airpocket-comparison-settings（kv/current）、または初期利用不可時のlocalStorage airpocket-comparison-settings:currentを使い、既存のlocalStorage記録を優先して読んだ後、選択した保存先をセッション中は切り替えません。上限は128 KiBで、形式を検証します。破損・保存容量不足・ブラウザ保存の禁止は状態欄へ通知し、手動JSONと通常の比較操作は継続できます。保存の書込みは直列化し、古い非同期処理が新設定を上書きしないようにします。

2026-10-17 localhost実Chrome（小規模熱ケース）の証跡: [比較設定自動保存の検証](evidence/2026-10-17-comparison-settings-persistence-real-chrome.json)。既定の無効状態から有効化し、「比較を表示」後の候補保存、実際のページ再読込後の有効選択/候補保持（ケース・時刻・PNGは自動復元しない）、別途ケースを新IDで再取込した後の明示復元と同じportable設定、比較の再表示を確認しました。無効化は候補を保持し、削除後の別の実再読込では無効・候補なし・復元/削除ボタン無効を確認しました。保存・復元・無効化・削除後もメイン表示/入力/ケースは不変でした。公開HTTPS・他ブラウザ/端末・実Chromeでの強制的なIndexedDB/容量不足/破損障害は未確認（障害経路は自動テストの範囲）です。ケース/結果の自動保存は対象外です。


## 比較の保存時刻WebM（2026-10-17）

startCompareExportにformat:"webm", animation:"time", startTimeSeconds, endTimeSecondsを渡すと、共通カメラを固定して物理時刻を進めます。開始・終了は明示した有限値で0以上、開始<終了が必要です。secondsは表示用動画の長さ（1〜15秒、API既定5秒・GUI既定2秒）で、物理秒数とは別です。timeモードは単一時刻timeSecondsを受け付けません。既存のPNGと既定orbitの引数・動作は維持し、物理開始/終了はtimeモードだけで使います。

対象は保存温度フレームを持つ過渡熱どうし、または瞬時音圧フレームを持つ過渡音響どうしの2ケースです。開始/終了は両履歴が重なる区間内に限ります。各ケースで要求物理時刻に最も近い保存フレームを選び、同距離なら前のフレームを使います。表示には要求時刻、各ケースの実保存時刻と符号付きのずれを記録し、補間や再解析はしません。静的結果、時間軸のない結果、混在する解析種別、熱流束など最終結果のみの表示量は開始前に拒否します。

toleranceSecondsは任意で、要求区間全体で生じ得る最大時刻ずれを許容値と比較し、超過なら録画前に拒否します。GUIの「保存時刻のずれ許容」は空欄なら制限なしです。単一時刻プリセットの許容値は隠れて引き継がず、時間動画専用欄の指定だけを使います。色範囲は両ケース・全要求区間で選択され得る保存フレームから作って固定し、カメラも固定します。manifest.comparison.timeAnimationは物理開始/終了、保存フレーム選択方針・補間なし、全期間色範囲、選択候補数、最大ずれと開始/終了の選択を記録します。これは実際にエンコードされた全フレームの一覧ではありません。

比較欄の動画種類で保存時刻の時間変化を選び、開始/終了と必要ならずれ許容を入力します。既存のプレビュー・明示保存・中止・完了後の復元と共有キューを使います。動画種類/開始/終了/時間動画の許容はportable設定・自動保存には追加しません。MediaRecorderの実時間録画と目標24fpsは従来どおりで、枚数・滑らかさは保証しません。

2026-10-17 localhost実Chrome（小規模熱2ケース）の[時間動画証跡](evidence/2026-10-17-comparison-time-video-real-chrome.json)。物理0..10秒・表示2秒のAPI動画は27,294 bytesのVP9 WebM（1280x640）でSHA-256を照合し、外部デコードで4フレーム・4種類の画像を確認しました。共通色範囲20..40°Cと固定カメラ、近傍保存時刻/ずれのmanifest、範囲外・許容0・熱流束の拒否を確認。GUIでは空欄の専用許容で作成、ネイティブプレビュー、5秒要求の中止、2秒で再作成と利用者再生の終了を確認しました。完了・中止・再作成後の元2.01秒補間表示/入力/ケース/比較設定は完全一致。GUI動画自体の外部デコードではなくAPI証跡と区別します。実機音響・公開HTTPS・一般形状・滑らかな24fps/枚数保証・GUIダウンロード完了は未確認です。

## 比較の変形動画（表示倍率のみ）

startCompareExportのWebMでanimation:"deformation"を指定します。対象は線形弾性2ケースのdisplacement/stressで、有限かつ非zeroの保存変位と正の明示deformScaleが必要です。timeSeconds/toleranceSeconds/startTimeSeconds/endTimeSecondsは拒否します。GUIの「保存変位の倍率変化（片道）」も同じキューを使います。カメラ・色範囲・結果値を固定し、表示倍率だけを0から指定倍率へ片道で線形に変えます。物理時間・載荷履歴・新しい解析結果ではありません。modal/超弾性/塑性/熱/音響/流体は対象外です。manifest.comparison.deformationAnimationに倍率端点・scalePolicy:linear・固定保存結果・loadHistory:falseを記録します。portable設定のschemaと既存回転/時間動画は変更しません。

2026-10-17 localhost実Chromeの[部分検証証跡](evidence/2026-10-17-comparison-deformation-video-real-chrome.json)。実solveElasticで解いた小規模2ケース（3/6 N、表示倍率200）でGUIの2秒動画作成・1280x640ネイティブプレビュー・利用者再生開始、5秒要求の中止、2秒再作成を確認しました。3経路後それぞれ元2.01秒補間表示/入力/ケース/比較設定が完全一致しました。再生終了・再作成後の再生動作は未確認です。API初回はComparison export expiredで失敗し、2回目はブラウザ再接続/ページ初期化に伴うexportStatus timeoutで中断しました（原因未確定）。実機API成果物のbytes/SHA/manifest・外部デコード・独立した形状変化・保存動画/画像は未取得です。公開HTTPS・一般形状・滑らかな24fps・GUIダウンロード完了も未確認。部分検証を全面受入済みとして扱いません。

追加のlocalhost実Chrome [API成果物・形状検証](evidence/2026-10-17-comparison-deformation-video-artifact-real-chrome.json)で前回部分記録を補完しました。低負荷で2秒要求の24,858 bytes VP9/1280x640をSHA-256（f2c424a5…）照合し、外部デコード4フレーム・画像4種を確認。凡例/ラベルを除く描画領域でも左右の形状変化と境界移動を確認し、固定色範囲0..0.00312 mm・固定カメラ・倍率0→200の視覚変形と区別しました。元2.01秒補間表示/入力/ケース/比較設定は完全一致。別GUI動画はネイティブ再生終了2.125秒を確認（GUI bytesの独立decodeとは別）。前回のexpiry/timeout記録は保持します。公開HTTPS・一般形状・滑らかな24fps/枚数保証・物理載荷応答・GUIダウンロード完了は引き続き未確認です。

受理後期限分離の[15秒境界実Chrome検証](evidence/2026-10-17-comparison-deformation-video-15s-real-chrome.json)では開始返信74ms、ジョブ完了15,725ms（元15秒を超過）で成功しました。92,321 bytes/SHA-256 35ff9912…のVP9/1280x640を外部デコードし17フレーム・画像17種、ラベルを除く形状変化と元4状態一致を確認。開始コマンド期限自体は延長していません。この録画中の実機切断は未試験で、失効/取消/ケース変更は別の自動テストを根拠とします。

## 比較の回転GIF



2026-10-17 localhost実Chromeの[比較GIF証跡](evidence/2026-10-17-comparison-gif-real-chrome.json): API成果物5,574,849 bytesをSHA-256 e171333e…で照合。外部デコードで640×320・24枚/画像24種、Pillowでdelay80/90ms・合計2,000ms・loop0を確認しました。GUIの画像プレビュー・中止・再作成は成功し、各後の元2.01秒補間表示/入力/ケース/比較設定は完全一致。最初の接続reset/timeoutは履歴に保持し原因を断定しません。公開HTTPS・一般形状・他プレーヤーの滑らかさ・GUIダウンロード完了は未確認です。

## 比較GIFの時間・表示倍率（2026-10-19）

`startCompareExport`は`format:"gif"`で`animation:"orbit"|"time"|"deformation"`を受理します。新toolは増やさず、MCPは35 default/37 paired、live91操作、minimal connector3のまま。実登録schemaと`exportCapabilities().comparisonGifExport`を先に確認してください。単一ビューの`formats.gif`とMP4は非対応です。

固定24枚、640×320、RGB332の256色（非可逆）。`seconds`は整数1〜15（API既定5、GUI既定2）で、整数centisecondのdelay合計は`seconds*100`。orbitは既存`i/24`、time/deformationは`i/23`で両端を含みます。無限loop指定であり、プレーヤーの再生精度や滑らかな24fpsを保証しません。

時間は両ケースに保存温度または瞬時音圧が必要で、両時間軸内の明示`startTimeSeconds < endTimeSeconds`を指定します。`timeSeconds`や最終熱流束との併用は拒否。固定カメラ・全区間で選択可能な保存フレームの共通色範囲を使い、近傍保存フレームだけを表示し、実時刻と符号付きoffsetを描きます。補間や追加の物理解法は行いません。任意`toleranceSeconds`は全区間で点検します。

変形は2つの線形弾性結果の変位/応力に限り、非零の保存変位と明示した正の`deformScale`が必要。時間引数と非線形結果は拒否。カメラ・結果値・色範囲を固定し、表示倍率だけ0→指定倍率へ線形に変えます。manifestの`visualizationOnly:true`/`loadHistory:false`と画像ラベルを維持し、載荷履歴として解釈しません。

GUIの動画種類はGIF選択後も維持し、時間範囲/表示倍率は同じ共有queue・revision/lease・取消・SHA付きartifact取得・解放経路を通します。成功/取消/失敗後に元表示へ復元し、部分成果物は受け渡しません。[localhost正式MCP＋実Chrome証拠](evidence/2026-10-19-comparison-time-deformation-gif-real-chrome.json)は小規模な熱11保存フレームと線形弾性3N/6Nに限定し、API成果物・外部decode24枚・総delay・GUIプレビュー/取消/再作成・入力/ケース/表示/比較設定の一致を確認。公開HTTPS、一般形状、OSダウンロード完了は未確認です。

2026-10-19 実solveAcousticTransient（単位四面体空気キャビティ、c=343 m/s・rho=1.2 kg/m³、4 kHz、0.1 msパルス、1.2 ms、明示source振幅1/2 Pa、25保存フレーム）の2ケースを、[音響time GIF検証fixture/test](evidence/2026-10-19-opencode-viewcompare.json)でproduction adapter＋timePlan＋実GIF encoderに通しました。24枚・640×320・RGB332・delay合計200 centiseconds（2000 ms）、phase i/23の両端、共通色範囲=保存瞬時音圧の範囲（Pa、−0.984…〜2.003…）、近傍保存フレーム選択と符号付きoffset、tolerance 0・stale revision・静的音響・start>=endの拒否、取消時に成果物なし・入力/ケース/結果/比較設定の一致を確認。外部Pillow decodeは24枚/640×320/合計2000 msを確認（canvas stubのため24枚は同一画像）。実Chrome実機・GUIプレビュー/取消/再作成・公開HTTPS・波動精度は未確認です。
