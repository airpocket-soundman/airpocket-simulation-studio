# 02 AGENTINPUT1 — 直交異方性Eの桁警告を既存規則へ接続

対象: OpenCode / DeepSeek v4.1 Flash。まず[00-COMMON.md](00-COMMON.md)を読む。
全物理preflightの完成ではなく、既存のPa桁警告の小さな抜けを埋める。

## 到達点

orthotropic.youngModuliPaの3成分に既存Young率のwarning規則を適用する。
新しい推奨範囲・拒否閾値は作らない。値を自動変換しない。
現在inspectUnitMagnitudeは等方性youngModulusを読むが、この配列を読まない。

## 読む順序

1. src/preflight-unit-magnitude.jsのUNIT_MAGNITUDE_RULESとinspectUnitMagnitude。
2. src/analysis-preflight.jsのinspectUnitMagnitude呼出し。
3. src/orthotropic-input-contract.js。
4. tests/advanced-structural-preflight.test.mjsとtests/analysis-preflight-physics.test.mjs。
5. docs/automation.mdの単位・provenance規則。

上記は指示作成時に実在確認済み。開始時にrgで再確認する。
既存桁警告はwarningであり、solverの可解性や物理精度の判定ではない。

## 変更可能

- src/preflight-unit-magnitude.js。
- 新規tests/preflight-unit-magnitude.test.mjs。
- 必要時のみ既存preflight試験のfixture。
- docs/automation.md、docs/en/automation.md、限定証拠JSON。

## 変更禁止

- orthotropic-core等solver、材料式、正定値検査、単位定義。
- Eの既存範囲1e5〜1e13 Paの緩和/厳格化。
- shearModuli/Poisson比/流体に別範囲を推測して展開すること。
- warningをerrorへ変えること、allowedの強制変更、根拠の自動確認。
- 無関係なAPI、GUI、installed Skill、他ownerファイル。

## 実装手順

1. 既存E規則を名前付きで再利用できる形にする。数値の重複定義を避ける。
2. orthotropicが存在するときだけyoungModuliPa[0..2]を点検する。
3. 出力targetは正確なJSON Pointerを使い、配列indexを末尾へ付ける。
4. 正式targetは/materialProperties/orthotropic/youngModuliPa/0等。
5. codeは既存UNIT_MAGNITUDE_SUSPECT、severityはwarningを維持する。
6. evidenceに元value、Pa、既存range、既存hintを保持する。
7. 配列の長さ/finite等の不正は既存contractへ任せ、warningだけで補修しない。
8. absent/null/0/NaN/Infinityは既存checkの扱いを維持する。
9. 入力オブジェクトを変更しない。順序はindex0→1→2で安定させる。
10. 同じ成分に同じ警告を二重生成しない。

## 受入

- [210,210,210] Paは3成分それぞれwarning。GPaと推測して書換えない。
- [210e9,200e9,190e9] PaはこのE規則ではwarningなし。
- [1e5,1e13,2e11] Paは境界を含めwarningなし。
- 既存等方性youngModulus=210 Paの警告は変わらない。
- shearModuliPaやPoisson比に今回の新警告を出さない。
- 同一の有効fixtureで警告追加前後のallowed/provisionalが同じ。
- project/material配列とprovenanceがdeepEqualで不変。
- 観察結果を「入力値確認の依頼」と扱い、数値解析の精度合格としない。

## テスト

新規試験は実際のinspectUnitMagnitude出力とpreflight経由を確認する。
不正materialのsolver検証を今回作り直さない。

```text
node --test tests/preflight-unit-magnitude.test.mjs tests/analysis-preflight-physics.test.mjs tests/advanced-structural-preflight.test.mjs
```

必要なfixtureは既存直交異方性fixtureを再利用する。
型変更がなければ契約型を不要に変更しない。

## 実Chrome境界

今回の必須実装は純preflight。実Chrome未実施ならそのまま記録する。
実機確認する場合は有効な既存直交異方性入力を使い、値・単位を明記する。
3つのPa pointerがinspect/preflightに出ることと、入力不変を確認する。
表示警告の翻訳だけを全UI検証の代わりにしない。

## 失敗時

既存E規則が変わっていたら数字を本書に合わせて戻さず、現sourceを優先して差を報告する。
有効な直交異方性fixtureが作れない場合、等方性へ置換して成功としない。
新閾値が必要になるならこの受入範囲を超えるため停止しrootへ報告する。

## 最終成果

変更、対象test、warningのpointer/value/unitと入力不変の証拠を提出する。
AGENTINPUT1はcheckingのまま。全物理の桁規則・Skill gate・一般精度は閉じない。
171/133/残38を維持し、共通指示が許可するlatest欄だけ更新する。
