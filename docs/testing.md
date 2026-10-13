# APIと高速な検証

[English](en/testing.md)

`npm test` で、ブラウザを起動せず共通APIのライフサイクルを検証する。CIも同じテストを実行する。`npm run check:project -- project.json` で保存データの整合性と選択面積を確認できる。

Nodeからは src/studio-api.js の createStudioApi をimportする。ブラウザでは `window.studioApi` を使う。HTTPサーバーや認証キーは不要で、操作は開いたアプリ内のローカル状態に限定される。

```js
const api = window.studioApi;
api.getSummary();
api.selectTriangles(0, [0, 1]);
api.addCondition({type: 'fixed'});
api.selectTriangles(0, [20, 21]);
api.addCondition({type: 'force', value: 100, direction: [0, -1, 0]});
const project = api.exportProject();
api.loadProject(project);
```

番号は現在の表示メッシュの番号。getSummary / exportProject / loadProject / selectTriangles / clearSelection / addCondition / removeCondition / selectCondition / setMaterial を公開する。返却データはコピーとし、失敗した命令は状態を変更しない。APIはバージョン1。

UIの条件登録・削除・再選択・保存復元はこのAPIを経由する。マウスからのブラシ領域算出には別途、可視性と投影を含むブラウザ確認が必要。APIテストだけで3D操作・WASM・GPU・解析精度を検証したとはしない。ソルバー追加時は同じ設計で入力・実行・結果取得と参照解テストを増やす。

材料API: setMaterialPropertiesでSIの物性（E・強度はPa）を登録。UIはMPaで表示。カテゴリ変更時は物性をクリアします。

進捗更新: `npm run task:status -- ID STATUS "記録" [証跡]` を実行し、src/progress.jsonをcommit・pushします。開発管理ボードは表示中に20秒ごとに取得します。更新は実際の作業の区切りで行い、バックグラウンドで自動開発する仕組みではありません。

計算APIと検証例は[解析ガイド](analysis-guide.md)を参照。体積メッシュ・構造・熱・適応ループもNodeから直接検証する。

v0.33の[J2微小ひずみ塑性](plasticity.md)は、正の線形等方硬化と単調載荷を対象にします。`tests/plasticity.test.mjs`は材料応答、整合接線の数値微分、静水圧で降伏しないこと、材料点の除荷、柱の参照解を検証します。`node --test tests/plasticity-integration.test.mjs`は画面と同じWorkerから実Gmsh/WASMを使い、10×10×40 mm柱の参照応力251.7412935 MPa、相当塑性ひずみ0.0017412935、上端反力25174.12935 N、収束履歴・保存復元・点測定・不正な塑性状態の原子的拒否を確認します。MFEM/WebGPU、適応解析、固有振動、熱応力との組み合わせも拒否します。材料点の除荷テストはFE繰返し載荷や疲労への対応を意味しません。Nodeテストは公開UIの操作確認やTet4のロッキングに対する精度保証とは別です。

v0.35の[閉鎖STL体積メッシュ](stl-meshing.md)は、最大2000三角形の外向き・単一閉鎖凸殻を対象にします。`tests/stl-source.test.mjs`は元形状の検査、`tests/stl-mesh.test.mjs`は体積メッシュと元殻の体積・境界の整合を検証します。`node --test tests/stl-integration.test.mjs`は実Gmsh/WASM Workerで10 mm立方体、E=1 GPa・ν=0・100 N引張の参照変位0.01 mmと反力−100 N、三角形条件の転送、プロジェクトとケースの保存復元、点測定、不正入力を拒否した後の状態保持、適応解析・CAD領域分割の拒否を確認します。STLの条件転送は近似であり、一般の凹形状・複数殻・自己交差の修復や任意形状の精度を保証するものではありません。ソーステストと公開ブラウザ操作の確認は別です。

v0.36の[S–N疲労評価](fatigue.md)は、単軸比例線形弾性・一定振幅に限定します。完全両振り`stressRatio:-1`の実測振幅曲線、降伏応力、引張強さ、試験条件・出典が必須で、データ欠如時に寿命数値を生成しません。`tests/fatigue-material.test.mjs`は曲線の順序・出典・不正入力の原子的拒否、`tests/fatigue.test.mjs`は曲線区間内の対数補間、Goodman補正、降伏と曲線範囲外の拒否を検証します。`node --test tests/fatigue-integration.test.mjs`は実WASM Workerの架空単軸例で寿命100万サイクル・10万サイクル負荷時の単一振幅Miner使用率0.1、独立Goodman式、保存復元と改変結果の拒否を照合します。塑性疲労、多軸・非比例疲労、変動振幅のrainflow計数、亀裂進展は未対応です。登録曲線の外挿や無限寿命の推定を行わず、架空例の一致を実部品の寿命保証とは扱いません。

v0.37の[外部3D Stokes流](stokes-flow.md)は、外部直方体領域の定常粘性流、Re≤0.1、CPU GMRES、最大2000節点・8000四面体を対象にします。粘度μ・密度ρ・外側速度が必須です。`tests/stokes.test.mjs`は解析速度を外境界に与えた球の試験、比例・反転や適用範囲を検証し、`tests/stokes-study.test.mjs`は設定の原子的拒否と実Gmshの自動境界・代表長さを確認します。`node --test tests/stokes-integration.test.mjs`は一様外箱速度の実WASM Worker、測定、保存復元、境界速度・圧力基準・物理場・元CAD寸法の改変拒否を検証します。解析外境界の球では細分化後も反力抗力誤差約6.25%、表面積分抗力約28.3%、節点圧力約27.7%の誤差が残ります。これは有限外箱の一様速度UIが無限領域の抗力と一致する証明ではありません。慣性・乱流・適応解析・MFEM/WebGPUは未対応で、最終公開確認は別途行います。

音響のスイープもsrc/acoustic-sweep.jsをNodeから直接実行できる。測定はsrc/probe.jsのsampleResult(mesh,result,[x,y,z])。ブラウザではwindow.analysisApi.probe([x,y,z])で直前の結果を測定。適応解析の出力adaptive.iterationsには全反復のメッシュ・境界・結果を保持する。

計算の管理テスト: 中止→再実行、旧Worker応答の無視、入力スナップショット、時間上限、未収束・メモリ失敗後の解放を短時間で確認する。実際のメモリ枯渇は発生させず、Worker失敗を注入して処理を確認。実画面では中止と再実行、局所メッシュの生成を確認する。

### 2096-10-13 ケース回帰検証
自動テスト48件成功。追加したテストは、不正な解析分野・計算操作・結果範囲を拒否して既存ケースを保持すること、保存できない設定でWorkerを残さないこと、入れ子の実行設定を計算開始時に固定することを確認します。実際のGmshメッシュと構造ソルバーで、100 Nの軸引張に対してE=1 GPaで0.04 mm、E=2 GPaで0.02 mm、どちらも反力−100 Nを確認。JSONケース集の復元後に再計算し、変位配列・反力が元の結果と一致します。この時点では、公開UI/CAD/3D操作の一括検証は未完了でした。

`node --test tests/worker-pipeline.test.mjs` は画面と同じanalysis.worker.jsの処理を直接実行し、実Gmsh/WASM・領域転送・ソルバーまで構造適応/放射/接触/流体を約2.4秒で検証します。Node用のself/fetchアダプターで、ブラウザのWorkerスレッド・COI・3D操作そのものは検証しません。それらは公開画面で別途確認します。


### 公開された実行ファイルを直接検証する（v0.23）

`npm run test:published` はGitHub Pagesの実行ファイルをダウンロードし、実際のNode Workerで公開済みの解析WorkerとWASMを実行します。ソース側だけのテストとは別に、配信されたバンドルを検証できます。公開コミットが手元のHEADと異なる場合は失敗するので、Pagesのデプロイ完了後に実行してください。

構造のAirpocket/MFEM、熱放射、有限ひずみゴム、層流流路、拘束不足と再実行、プロジェクト/ケース集の復元、公開CAD WorkerによるSTEP読込みと体積メッシュをチェックします。初回は約60 MB（展開後）の実行ファイルを取得し、以降は内容ハッシュごとにキャッシュします。WASMが変わらなければコミットが変わっても再取得しません。キャッシュ後の検証は今回の環境で約6秒でした。

`runtime-manifest.json` にバージョン、コミット、各ファイルの長さとSHA-256を記録します。検証結果は `.qa/published-report.json`、ブラウザ用の参照形状は `.qa/published-reference.step`。失敗した実行は成功レポートを上書きして失敗を記録します。ソースと比較するためのプロジェクト/ケース検証ヘルパーは手元のコードです。公開Workerの実行ファイルは配信版そのものです。

`npm run build` の後に `npm run test:published -- --local` で生成済みの配信物を確認できます。CIは通常の209テスト、ビルド、この配信物チェックを行い、それらが成功したときにPagesへ公開します。Node用のself/fetch/CADスクリプトアダプターを使用するため、ブラウザのCOI・描画・実GPUの証明には使いません。

### ブラウザの回帰レシピ

`scripts/qa-browser.cua.js` は文書化されたCUA操作だけで、MFEM参照解、ゴム解析、ケース集のテキスト書き出し/再読込/保存結果表示、JP/EN、STEPのCAD面選択、回転後の再選択、プロジェクト復元を検証します。専用の作業用タブを使ってください。開始時にリロードし、そのタブのモデルとケースを置き換えます。通常のダウンロードイベントが取得できない環境でも、画面のJSONテキストを使って復元経路を確認できます。

CUAのJavaScriptセッションで、取得済みのタブとローカル参照ファイルを渡します。`next()`は検証1段階を実行するので、各結果を確認しながら進められます。以下のパスはローカルのリポジトリに合わせます。

```js
const fs = await import('node:fs/promises');
const qa = await import('file:///D:/github/airpocket-soundman/airpocket-simulation-studio/scripts/qa-browser.cua.js');
const run = qa.runStudioBrowserQa(
  testTab,
  'D:/github/airpocket-soundman/airpocket-simulation-studio/.qa/published-reference.step',
  'https://airpocket-soundman.github.io/airpocket-simulation-studio/',
  {writeText: (path, text) => fs.writeFile(path, text)}
);
await run.next(); // 1段階ずつ実行。done=trueのvalueが全体レポート。
```

このレシピは現在の組み込みブラウザで検証します。複数ブラウザの性能や全てのUI組み合わせを保証するものではなく、PERF1の測定は別に行います。通常のNode CLIからブラウザ操作を行うスクリプトではありません。

過渡音響の公開チェックでは、実配信Workerの到達時刻・音圧振幅とケース保存を検査します。WAVの帯域制限と時間の保持は単体テストで検証。

画面回帰レシピは11項目。過渡波形・時刻切替・WAV操作欄、固有振動、保存モードからの外部音響、4ケースの大きいJSON集の再読込も含む。大きいテキストを開いたまま画面全体のアクセシビリティ情報を取得せず、DOMの必要箇所を読む。
