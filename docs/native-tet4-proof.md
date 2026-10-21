# 準備済みTet4入力のhost/WASM検証

[English](en/native-tet4-proof.md)

2026-10-21。既存v1固定棒CLIを保持し、P6へ限定v2入力を追加した。静的等方線形Tet4の準備済みrecordであり、製品backendや任意保存プロジェクト実行の完成ではない。

`scripts/native-tet4-contract.mjs` の `createNativeTet4Record({input,mesh,fixedNodes,forces})` は引数をsnapshotし、正規の `createStudioApi.loadProject/exportProject` で保存入力を検証してから入力/メッシュをhashする。nodesはmmのflat XYZ、tetsは正向きTet4の4節点index。fixedNodesは各節点3並進を完全固定し、非共線3点以上を必要とする。forcesは節点ごと3成分N。メッシュと境界は呼出側が明示し、保存CADの条件選択から自動変換・認証しない。

recordは入力/メッシュのcanonical SHA-256と材料を含む。serializeもawait前にsnapshotしwireとrecordRevisionを返す。C++の識別値はechoなので、呼出側が期待recordとverifyNativeTet4Outputで照合する。任意wireの出所を認証する仕組みではない。子process実行中は期待recordを保持する。使用例は英語版にある。

上限は512節点/1024要素/入力262144bytes、座標絶対値1e6mm、力成分1e12N、E1e15Pa。nuは-1より大きく0.49未満。不正index、重複/反転/退化要素、未使用/非連結節点、不足/重複/共線支持、非有限値を拒否する。重力・熱応力・モード・直交異方性・塑性・超弾性、非零強制変位、局所枠、面荷重積分、CAD再メッシュと一般的なメッシュ重なり検査は未対応。

C++はmm→mを境界で1回だけ行い既存solve_elasticを使用。独立剛性作用で支持反力を確認し、全変位m/反力N/合力/収支/反復/自由DOF残差を版付きJSONへ返す。識別/runtime/有限性/支持変位0/収支を照合して受理する。ブラウザbackendやcase保存は変更しない。

`node scripts/check-native-proof.mjs --build` は固定MFEM/SDK cacheとhost C++17環境を使い、native実行ファイルを取得しない。Linux native-proof CIは実行ファイルheader、既存v1/v2、host/WASM一致、不正recordを必須確認する。`.native-cache/native-proof-report.json` にsource/実行物hashとv2原結果を保存。localのskipをhost成功と数えない。既存子process30秒期限と出力buffer上限を維持する。

合成参照は平行移動した20×15×60mm棒、E2e9Pa、nu0、+75/-75/0N。75Nの理論伸び7.5e-6m。許容値は変位1e-10m＋相対1e-7、収支1e-8N＋相対1e-7、残差2e-8未満。追加nu0.3のWASM例は収束のみ確認する。[local証拠](evidence/2026-10-21-native-tet4-prepared-record.json)でWASM実行とlocal実host未検証を分離する。

P6全体は未完。任意保存入力準備、CAD条件転送、広い物理/材料、メッシュ品質/物理妥当性、製品backendは残る。runtime一致だけで一般的な物理精度を保証しない。

材料の許可keyはyoungModulus、poissonRatio、source、grade、notesだけ。dependence、有効温度、density、破壊、将来の相モデルを含む他keyは全て拒否する。studyもkind、無効なmodalAnalysis/thermalStress、無効なgravityと任意の零gravityベクトルだけを許可し、温度評価や未知keyを黙って落とさない。
