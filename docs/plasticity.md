# 微小ひずみJ2塑性

[English](en/plasticity.md)

材料物性でJ2塑性を有効にし、ヤング率E、ポアソン比ν、初期降伏応力σY、線形等方硬化係数Hを指定します。画面の応力・弾性率はMPa、APIはPaです。Hは必ず正で、完全塑性（H=0）は対象外です。材料の試験条件は`testConditions`に記録できます。参照値は架空材料であり、鋼種の材料保証値ではありません。

Hは降伏後の全ひずみに対する接線係数Etとは異なります。単軸試験では`Et = E H / (E + H)`、逆に`H = E Et / (E - Et)`です。E、σY、Hは対象温度・速度の試験から選びます。試験曲線の自動同定は行いません。

## モデルと計算

3D微小ひずみ、等方線形弾性、関連流れ則を使うvon Mises塑性です。降伏関数は`f = sqrt(3/2 s:s) - (σY + H κ)`、sは偏差応力、κは累積相当塑性ひずみです。静水圧応力だけでは降伏しません。弾性試行状態が降伏面を超えるとradial returnを行い、`Δκ = max(f_trial, 0) / (3G + H)`で更新します。

荷重と指定変位を増分に分け、整合接線を用いたNewton反復で釣り合いを解きます。塑性状態は各増分の収束後にだけ確定します。反復の試行状態を履歴として蓄積してはいけません。未収束は成功結果として扱いません。画面の「弾塑性の荷重倍率履歴」で載荷と除荷を指定できます。弾性除荷中も累積相当塑性ひずみは残ります。繰返し載荷の状態更新は行いますが、疲労損傷や疲労寿命は計算しません。

## 参照柱と結果

10×10×40 mmの柱にE=200 GPa、ν=0.3、σY=250 MPa、H=1 GPaを設定し、上端にz変位0.12 mmを指定します。x=0面でux=0、y=0面でuy=0、z=0面でuz=0とし、横方向の収縮を許します。全ひずみεz=0.003に対し、独立単軸解は次です。

- `κ = (E × 0.003 - σY) / (E + H) ≈ 0.00174129353`
- `σz = σY + H κ ≈ 251.74129353 MPa`
- 上端反力の大きさは`σz × 100 mm² ≈ 25174.129353 N`。下端反力とは逆符号です。

変位はmm、応力はPa、ひずみは無次元です。6成分のひずみは法線ひずみと工学せん断ひずみ（γij=2εij）を使います。相当塑性ひずみはTet4要素ごとの値です。色表示は節点平均なので降伏域の境界が平滑化されます。点測定は含有要素の値であり、色の補間値とは一致しない場合があります。

## APIと制限

「塑性引張サンプル」は`window.analysisApi.loadPlasticExample()`で設定できます。モデルと境界条件を用意した後、材料を次のように登録できます。

```js
window.studioApi.setMaterialProperties({
  youngModulus: 200e9,
  poissonRatio: 0.3,
  plasticity: {
    model: 'j2-isotropic',
    yieldStress: 250e6,
    hardeningModulus: 1e9,
    testConditions: 'Synthetic uniaxial reference; not a steel grade'
  }
});
await window.analysisApi.analyze({size: 5, method: 'wasm-pcg', adaptive: false});
```

要素値は`result.plasticity.equivalentPlasticStrain`、最大値は`maxEquivalentPlasticStrain`です。`plasticStrain`は要素ごとの塑性ひずみ6成分です。画面の相当塑性ひずみは%表示です。

CPUのAirpocket JS/WASM、最大2000四面体・2000節点が対象です。各収束増分の全ひずみの主値の絶対値が0.02を超える場合は拒否します。この上限は精度保証ではありません。MFEM、WebGPU、適応再メッシュ、固有振動、熱応力、温度依存物性、機械的接触、疲労、破壊、有限ひずみ塑性は未対応です。

Tet4は体積一定の塑性変形でロッキングし、過度に硬い応答を出す可能性があります。均一柱の一致だけでは任意形状の精度を保証できません。独立した参照解と複数メッシュで、反力・変位・塑性域を比較してください。

実装の参照は[FEniCSxの著者によるradial return・整合接線とロッキングの説明](https://bleyerj.github.io/comet-fenicsx/tours/nonlinear_problems/plasticity/plasticity.html)と[MOOSE公式の等方塑性更新](https://mooseframework.inl.gov/source/materials/IsotropicPlasticityStressUpdate.html)です。これらのソルバーの移植や精度認証ではありません。回帰検証の対象ファイルは`tests/plasticity.test.mjs`と`tests/plasticity-integration.test.mjs`です。実行結果は個別の検証記録を確認してください。

## 載荷・除荷の履歴

「弾塑性の載荷・除荷サンプル」は`window.analysisApi.loadPlasticUnloadExample()`で設定できます。同じ柱を倍率0.1から1まで載荷し、0.9、0.8、0.7、0.6へ除荷する14増分です。指定変位は最終0.072 mm、軸ひずみは0.0018、塑性ひずみκは約0.00174129353のまま、弾性除荷後の応力は約11.74129353 MPa、可動面反力は約1174.129353 Nになります。除荷はゼロ荷重までではありません。

倍率は外力と指定変位の両方に適用します。倍率履歴は弾塑性の構造解析だけに使用できます。空欄では従来の均等な単調載荷です。登録値は1～30個の有限値で0以上1以下、最初と最後は正、最大値は1にしてください。途中の0は使用できます。増分数は配列の長さと一致させます。画面では履歴を入力すると増分数を自動設定します。

```js
const study = window.studioApi.exportProject().study;
const plasticLoadFractions = [.1,.2,.3,.4,.5,.6,.7,.8,.9,1,.9,.8,.7,.6];
window.studioApi.setStudy({...study, plasticLoadFractions,
  nonlinearLoadSteps: plasticLoadFractions.length});
```

結果の`plasticity.history[].loadFraction`は載荷時も除荷時もその増分の倍率です。`plasticDissipationJ`と累積相当塑性ひずみは弾性除荷で減少しません。残留塑性ひずみ、硬化状態、最終エネルギーと履歴はケース保存されます。自由に外力をゼロへ戻した形状と、ゼロ指定変位へ拘束して戻した形状では残留応力が異なります。疲労寿命、移動硬化、バウシンガー効果、き裂成長、破断の予測は含みません。
