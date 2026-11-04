# COUPLE5 接線せん断壁の独立監査

[English](en/fsi-channel-shear-plate-audit-2026-11-04.md)

base d8214adの指示102実装を監査し、連成層だけを修正した。[新証拠](evidence/2026-11-04-couple5-independent-audit.json)は合成・暫定・未校正。流体本体、既存76/85、worker/MCP/UI、progressは変更していない。一般FSIの完了ではない。

散逸台形の左端は、前ステップの壁速度ではなく**当該ステップで保持したV**を使う。旧コードは初段ではV=0、以降ではVprevで評価していた。独立した2段階の面ジャンプ積分で訂正を確認した。ゼロ初期エネルギーの静止平衡は相対・絶対欠損を0とし、NaN/JSONnullを返さない。絶対診断energyDefectJPerM2を追加した。正エネルギーが0へunderflowする入力は拒否する。未認識optionsのstate/structureによる内部Newmark状態上書きも拒否する。

単位はSI。高さ・変位m、速度m/s、密度kg/m³、動粘性m²/s、板質量kg/m²、ばねN/m³、界面力Pa、機械エネルギー/累積散逸J/m²、散逸率W/m²。独立した有限体積6状態行列の指数（scaled Taylor）をRK4と照合し、非ゼロ初期流速を含む参照とh半減を確認した。運動量は外壁せん断とばね力、エネルギーは面ジャンプ散逸に一致する。

構造側は[Newmark beta1/4・gamma1/2](https://mooseframework.inl.gov/source/timeintegrators/NewmarkBeta.html)。Newmarkの平均速度は(dNew−dOld)/dt=(vNew+vOld)/2なので、線形壁せん断の平均forceと構造仕事は整合する。これは分離流体連成全体の無条件安定性証明ではない。**旧102の『不可避の一次energy欠損』説明には左端評価bugが含まれていた。** 同じdt.004/.002/.001の最大相対energy欠損は旧.072886/.030157/.014644から.023608/.005605/.000738へ変化した。変位軌道・反復は不変。有限の刻み幅での誤差相殺があるため、観測比を一般次数や厳密エネルギー保存へ読み替えない。旧[102証拠](evidence/2026-10-29-opencode-102-couple5.json)は歴史として変更していない。

converged:trueは界面固定点の収束だけを表す。時間精度、メッシュ収束、物理精度の合格ではない。失敗時は途中historyとfailedStepを返し、完了profileは出さない。参照は同じ初期profileを受け取るよう拡張し、負/非有限hや時刻・過大計算量を拒否する。参照のactualDt*(4ν/hy²+4μ/(m*hy)+sqrt(k/m))<=.1は保守的な局所前提で、一般安定性の定理ではない。

資源はcellsX4..256の2冪、cellsY4..512、連成steps<=20000、反復<=200、流体substeps<=20000。さらにsteps*(maxIterations+1)*substeps*cellsX*cellsY<=20000000を実行前に要求する。RK4はsteps<=500000かつsteps*(cellsY+2)<=10000000。派生spacing/粘性/刻み、初期状態、出力が非有限なら拒否する。

保存するのはfluid.parametersとplate/初期profile配列/dt/steps等の入力で、ロード後にchannelShearFluid(parameters)を呼び直す。factoryのsnapshotは凍結される。関数をJSON化したfluidや途中stateの復元は受け付けない。入力JSON再計算一致と失敗時の入力不変を回帰した。追加型は成功/失敗profileを区別する。

関連40試験・型36declarations成功。法線壁/ALE・圧力連成・曲面仕事保存写像・IQN-ILS・非線形・実測校正・製品接続は未完。新SU2実行なし。
