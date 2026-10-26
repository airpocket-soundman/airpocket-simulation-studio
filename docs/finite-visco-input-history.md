# 有限材料点の入力履歴保存と再計算

[English](en/finite-visco-input-history.md) / [元の材料点境界](finite-visco-reference.md)

2026-10-27追補: 初版の「製品非接続」は当時の実装境界の記録。既存pure API/入力契約を変えず、[保存入力履歴の検査画面](finite-history-inspector.md)が専用Workerで再計算した最終観測のみを表示する。構造solver・project/case・MCPへの接続や校正保証は追加しない。

`src/finite-visco-history.js` は製品非接続のpure境界。保存対象は**明示F/dtの入力列のみ**で、JSON状態のrestoreや最後の状態からresumeする機能ではない。ロード時は必ず既存referenceのI/Z0から全件再計算する。元reference APIは変更していない。合成/暫定/未校正を固定し、塑性・校正・構造反力やFINITEVISCO1全体の完了を意味しない。

`encodeFiniteViscoInputHistory(history)` はexact schemaをsnapshotしてcanonical JSON（末尾newline付き）へ変換する。`constitutiveVerified:false`であり、保存可能な構造と構成則の受入を区別する。`replayFiniteViscoInputHistory(raw)` はprimitive stringまたは通常のUint8Arrayを受ける。Node Bufferは`new Uint8Array(buffer)`で所有copyへ変換する。Array/Uint8Array subclass、SharedArrayBuffer、Proxyや不正UTF8は受理しない。元bytesはhashの最初のawait前にintrinsic copyし、呼出後のtypedarray変更を結果の入力同一性へ混ぜない。

## v1入力

```json
{
  "schemaVersion":1,
  "model":"synthetic-green-lagrange-maxwell-reference-v1",
  "kind":"finite-visco-input-history",
  "synthetic":true,"provisional":true,"calibrated":false,
  "units":{"time":"s","deformationGradient":"dimensionless"},
  "parameters":{"bulkModulusPa":2000000,"equilibriumShearModulusPa":1000000,
    "branchShearModulusPa":500000,"relaxationTimeSeconds":2},
  "steps":[{"F":[[1.005,0,0],[0,1,0],[0,0,1]],"dtSeconds":1}]
}
```

[合成履歴例](../public/examples/finite-visco-input-history.json)も利用できる。時刻はdtの累積で、外部のtime/state/Z/stress/cumulative/claimed結果はschemaにないため拒否する。unknown fields、異version/model/units/flagsは拒否。Fはdense3×3の有限数値。JSONの1e999、abs値がMAX_SAFE_INTEGER超の数、重複decoded key、BOM、trailing dataを拒否する。JSON.parseのlast-key-winsやInfinity化で通さない。

上限はraw/canonical出力それぞれ1MiB、1〜4096step、深さ16、値100000、文字列1024。1MiBぴったりの空白付き入力を受理し、+1byteは拒否する。構造エラーは安定code付き例外。dt≤0や元referenceの材料/F/x/time範囲違反はreplay時の明示失敗となる。文字列以外のobject/array入力はencodeだけの契約であり、accessor・非通常Array・疎配列・装飾配列・非有限・循環/深さ超過をsnapshot時に拒否する。

## 成功と失敗

成功は`completed:true,status:"completed"`、入力段階数、summaryと`finalState`だけ。全observations列やraw入力は保持しない。summaryは最終観測と時刻、累積仕事/散逸densityを含み、Pa/s/J/m³-referenceを明示する。replayから返るstateは新しく実計算して発行されたin-process stateで、保存済みstateを信用して復元したものではない。

材料parameter拒否は`completed:false,status:"failed"`、`FINITE_VISCO_HISTORY_PARAMETERS_REJECTED`、`stepIndex:null,completedSteps:0`。途中step拒否は`FINITE_VISCO_HISTORY_STEP_REJECTED`、0始まりstepIndexとその直前までのcompletedStepsを返す。失敗時にfinalState/summary/観測列を返さず、後続を実行/補間しない。入力bytes/objectと既存stateは成功/失敗とも不変。

rawIdentityは保存元UTF8 bytes、canonicalIdentityはキー順を正規化したJSON（newlineなし）のSHA256。表現が異なる同じ入力はrawだけが異なり、F/dt/列順が変わればcanonicalも変わる。これらは**入力同一性のhashであり、署名・由来認証・校正・物理精度保証ではない**。この境界はファイル書込、製品solver/UI/MCP/progress、project schemaへ接続しない。

[検証証拠](evidence/2026-10-23-finite-visco-input-history.json): 元APIの直接実行との全finalState一致、raw/canonical hash、非同期snapshot、失敗step、strict parse、容量/時間、型fixtureを検証。独立した元材料点Gauss/energy/rotation検証と合わせても、実験校正・serialized状態restore・構造解析・公開を証明しない。
