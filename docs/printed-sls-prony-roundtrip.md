# SLS同定値と一軸Prony参照の限定往復検証

[English](en/printed-sls-prony-roundtrip.md) · [学習のみのholdout評価](printed-parameter-holdout.md) · [条件別集計](printed-identification-groups.md)

`runPrintedSlsPronyRoundtrip` は合成データだけを受け取り、学習片のSLS同定値で既存の有限ひずみProny一軸材料点を駆動します。検証片は同定へ渡さず、既存holdout APIの完全1対1・試験片分離・条件一致・非外挿検査を再利用します。材料適用、実測、校正、構造解析はしません。指示101の次段階の限定検証であり、指示100の損傷モデルやFINITEVISCO全体を検証するものではありません。

## 単純な係数コピーが不適切な理由

同定は工学ひずみεと公称応力F/A0のYoung緩和 `E(t)=E∞+E1 exp(−t/τE)` です。既存driverは一定体積弾性Kとせん断Pronyを使い、側面無拘束のGreen–Lagrangeひずみを区間線形で進めます。KやPoisson比は一軸曲線だけから同定しません。Kは必須の明示合成入力です。

微小ひずみ・側面無拘束の操作弾性係数は `E(s)=9K μ(s)/(3K+μ(s))`、`μ(s)=[μ∞+μ0 sτμ]/[1+sτμ]` です。分母の極から `τE=τμ(3K+μ0)/(3K+μ∞)` が得られます。したがって `E0=E∞+E1`、`μ∞=3K E∞/(9K−E∞)`、`μ0=3K E0/(9K−E0)`、`μ1=μ0−μ∞`、`τμ=τE(3K+μ∞)/(3K+μ0)` を使います。τをそのままコピーしません。E0<9Kと既存driverの係数・比・dt/τ・伸長/J範囲を満たさなければ拒否します。

## 理想ステップと有限ランプの違い

元JSONはゼロひずみ/ゼロ応力のanchor、正で一定の保持ひずみ、等間隔の保持サンプルを明示します。最初の保持時刻を理想step原点とする既存holdoutの前提を維持します。既存driverは瞬間ステップを入力できないため、利用者が指定した有限rampDurationSecondsを最初の保持時刻より前に配置します。anchorより前へは延ばしません。この仮想ランプを観測済みとは呼びません。

工学ひずみは `E11=ε+ε²/2` へ変換します。比較対象はdriverのP11（first Piola、公称応力）で、S11（second Piola）・Cauchy応力も別欄へ残します。有限ひずみ効果・有限ランプ・側面の区間線形時間離散のため、同定した工学SLSを厳密再現するとは主張しません。独立検証は小振幅、短ランプ、入力の時間刻み細分化の3軸です。時間刻みを固定したままrampだけ短縮しても誤差floorは残ります。

保持点だけのPa残差（Prony−観測、Prony−理想step、理想step−観測）をbias/MAE/RMS/maxで報告します。既存holdoutのゼロanchorを含む統計は別名で保持します。元時刻・driver時刻・符号付き時刻差も残し、補間/新しい実測時刻を作りません。等間隔判定は時刻の機械丸め8ε相当だけを許容します。

## 容量・版・取消

各raw2MB、8pairs、全driver合計4096段階、結果4MB。未同定学習片やProny写像の範囲外は理由付きrefusedで、係数を補いません。原文SHA/id/revision/provenance、同定条件、正規化/同定/holdout/写像版とdriver自身のmodel版を保持します。plannedと実行段階数を区別します。全結果はsynthetic/provisional、measured/calibrated/accuracyVerified/physicalIndependenceVerified/bulkModulusIdentifiedはfalseです。

入力はown dataだけをawait前にsnapshotします。AbortSignalはawait後と有界driver呼出し間で確認し、未完了のnative SHAを早期解放したと偽装しません。同期driver1呼出しを途中中断するhard deadlineではありません。GUI/MCP/材料設定/進捗は変更しません。

[証拠](evidence/2026-11-07-printed-sls-prony-roundtrip.json)


同定の条件付き標準誤差は元のscalar係数にだけ保持し、Prony写像へ不確かさを伝播したとはしません（parameterUncertaintyPropagated:false）。Pa差は数値・モデル整合の残差で、校正済み予測区間ではありません。
