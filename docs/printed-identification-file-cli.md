# 保存ファイルからパラメータを同定するCLI

[English](en/printed-identification-file-cli.md)

既存identifyPrintedParameters(raw,explicitOptions)を保存JSONから呼ぶ入口。材料への適用・solver・project変更は行わず、校正/精度検証を昇格しない。[dataset契約](printed-measurement-dataset.md)と[同定モデルの範囲](printed-identification-audit-20261104.md)を継承する。

実行はリポジトリのNode環境で次の3引数を明示する（例の全pathは利用する実在ファイル/親directoryに置き換える）。

```powershell
node scripts/identify-printed-parameters.mjs --dataset "D:\data\measurement.json" --options "D:\data\options.json" --output "D:\data\new-identification.json"
```

optionsは例えば次のJSON。閾値の既定値は追加しない。二直線モデルはmaxTangentRatio、SLSはholdStrainToleranceを既存純粋契約どおり追加する。未知field/不正modelは同じgateで拒否する。

```json
{"model":"linear-elastic","maxStrain":0.02,"minPoints":3,"maxRelativeStandardError":0.1}
```

引数は--dataset/--options/--outputを1回ずつ、host-native絶対pathで渡す。相対path、未知/重複flag、同一path（Windowsはcaseも照合）、入力同士のhardlink別名、既存出力file/directory/linkを拒否する。出力の親directoryは既存・hardlink対応filesystemが必要。pathのsymlink/junction祖先と入力自体のsymlinkを拒否し、通常fileのみ読む。realpathで親を固定し、可能な環境ではNOFOLLOW/NONBLOCKも使う。悪意あるfilesystem全体の原子的snapshot/timeout保証ではない。

読取前のsize検査に加え、FDから固定bufferでdataset最大2000000bytes、options最大16384bytes（超過検出分を含め各limit+1まで）だけ読む。FD/pathのidentity・size・mtime/ctimeを前後で照合し、観測した差を拒否する。UTF8strict、BOMなし。dataset raw textは再整形せず既存importを通す。optionsはflatJSONのみ、decoded重複key・非有限number・nested値を拒否してから既存options gateを通す。rawSHAはその読取snapshotの同一性であり真正性/校正保証ではない。

結果JSONはschemaVersion1/kind:printed-parameter-identification-file、status:identifiedまたはrefused、inputsのbytes/SHA256、元純粋APIのresult、refusalの安定code/stageを持つ。calibrated:false/accuracyVerified:falseとsynthetic/measured provenanceを維持する。fit拒否specimenにparametersを補わず、成功specimenの値と拒否理由は元APIどおり保持する。fit全体の不成立はrefusedで、部分成功が材料採用を意味しない。

安全な出力pathと通常入力fileの確認後、byte上限・UTF8・JSON/options/dataset検証拒否でも新規refused artifactを発行する。入力raw/stack/私的な本文は拒否artifactへ入れない。fully-read UTF8拒否にもrawSHAを付け、過大/変化等で安定snapshotが取れなければidentity:null。path/引数/入力fileの存在種別・symlink guard失敗や公開自体のI/O失敗ではartifactを作らない。

完成JSONを同directoryの新規tempへ書き終えてから、既存publishJsonのexclusive hardlinkで最終名を公開する。既存pathを上書き・削除しない。通常失敗時は自分のtempだけ削除し、半端な最終fileは出さない。OS異常終了の残tempやcleanupWarningは成功artifactと区別する。成果物上限524288bytes。stdoutはcompactJSONでoutputBytes/outputSha256を返す。終了値0=全specimenidentified、2=refused artifact、1=引数/path/I/O/publication error（codeのみ、artifactなし）。競合時は1つだけが公開できる。

[CLI証拠](evidence/2026-11-04-printed-identification-file-cli.json)は合成入力の実CLI・純粋API一致、独立引張閉式/集約、3model、容量/拒否/別名/junction/競合、型を確認する。実測校正・独立片の精度検証、GUI同一性の実機確認は別の受入である。
