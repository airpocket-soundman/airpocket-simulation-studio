# 増分曲線の限定出力

[English](en/increment-curve-export.md) / [画面での使い方](increment-curve-ui.md)

`createIncrementCurveArtifacts({spec,steps})` は独立した線形弾性解析の荷重・標点データを再検証し、`{curve,csv,json,svg}` を返す非同期のpure service。後ろ3項目は文字列で、ファイル保存やDOM変更は行わない。呼び出し元が提示した曲線表は受け入れない。

入力は専用の増分bundleで、通常のStudio project JSONではない。`spec.input` は共通の試験片・材料情報としてhashされ、各荷重は `output.calculation` と実結果の適用荷重・支持反力で照合する。変位制御、塑性履歴、材料やmeshの混在、最大変位を標点に代用した入力は拒否する。保存済みの工程履歴を自動で作る機能でもない。

出力CSVは各stepにN/mm/Pa/無次元の単位、状態、暫定フラグ、input/mesh/calculation/result revisionを付ける。engineering stress/strainは既存の正規specが宣言する初期断面積・標点長から検証した値だけで、真応力や塑性ひずみではない。JSONは検証済み表であり、元のspec/stepsを含む再入力bundleではない。

SVGは力–標点伸びの静止図。失敗stepの数値はnull/CSV空欄のまま残し、その前後を線でつながない。暫定点は橙色で示す。すべての成果に `independent-linear-solves` と `plasticHistory:false` を示し、負荷・除荷の並びを塑性応答と称しない。

UTF-8 JSON1MiB、128step、20,000節点、深さ32、graph要素500,000、単一文字列65,536文字、成果各2MiBまで。入力はawait前にJSON snapshotを作り、有限数のみ許し、accessor・cycle・非JSON値・不正XML文字を拒否する。全SVGラベルをescapeし外部参照を生成しない。CSVの文字列が空白後 `= + - @` で始まる場合はapostropheを付けてquoteする。負の数値は変更しない。

[実solver由来のbundle](evidence/2026-10-22-resultcurve-export-bundle.json)と[小さい参照proof](evidence/2026-10-22-resultcurve-export-proof.json)を同梱。10×10×40mm、E=1e9Pa、ν=0、0/25/50/100/50/0Nを実Gmsh/弾性solverで計算した。100Nで伸び0.04mm、engineering stress1MPa、strain0.001と一致する。実測試験片ではない。保存resultは実際の全節点変位・支持反力・適用荷重・残差・kindの正確なsubsetで、未使用tensor/描画/performance配列を省いている。revisionは保存subsetを読み直して計算する。

再生成は `node scripts/create-increment-curve-export-reference.mjs`。試験は参照meshを独立に再計算し、CSV/JSON/SVGの数値・revision一致、失敗点分断、入力不変、改ざん拒否、式注入、XML escape、数値極限、サイズ制限を確認する。今回の機能はRESULTCURVE1の限定単位であり、塑性材料同定や任意結果の正確性を保証しない。

## 明示荷重列から再入力bundleを作る（2026-10-23）

`node scripts/create-increment-curve-bundle.mjs --request <絶対パス/request.json> --output <絶対パス/bundle.json>` は、明示した力制御の荷重列を1段階ずつ実Gmsh meshと独立した `solveElastic` で計算し、共通serviceが再検証できる `{spec,steps}` の再入力bundleを生成する。`scripts/create-increment-curve-export-reference.mjs` も同じbounded serviceを使う。

requestは `synthetic:true`、`curveId`、`caseIdentity`、`rowIdentity`、`boundsMm`、`meshSizeMm`、`youngModulusPa`、`poissonRatio`、正の座標軸 `axis`、`initialGaugeLengthMm`、`initialAreaMm2`、`loadsN` を持つ専用JSONで、通常のStudio projectではない。`initialGaugeLengthMm` と `initialAreaMm2` はboxの軸方向長さ・断面積と一致させる。`loadsN` は1〜128件で、順序・0荷重・除荷・重複荷重をそのまま保持する。各段階の変位・支持反力・適用荷重・残差はその荷重の解から保存し、他段階の倍率コピーや補間をしない。

出力先は絶対パスでrequestと別にし、既存ファイルを上書きしない。requestは64KiB、meshは20,000節点・30,000要素、boundsは±1,000,000mm、bundleは共通serviceの1MiBに制限する。生成・共通serviceの再検証・出版のいずれかが失敗した場合は完成ファイルを残さない。計算が収束しなかった段階は `output` を持たない `failed` 行として保持し、偽の収束行を作らない。このbundleは通常projectでも検証済み表JSONでもなく、現在のGUI状態へ暗黙適用しない。表JSONとCSV/SVGは既存の共通serviceまたは `studio_increment_curve` で別に生成する。

合成10×10×40mm、E=1e9Pa、ν=0、100Nでは標点伸び0.04mm、応力1MPa、ひずみ0.001を実solver結果から再現し、保存した各ベクトルを同じ荷重の独立再計算と照合する。実測試験片、塑性履歴、変位制御、任意形状の保証ではない。
