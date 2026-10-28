# 04 VIEWCOMPARE — 過渡音響time GIFの再現検証資産

対象: OpenCode / DeepSeek v4.1 Flash。まず[00-COMMON.md](00-COMMON.md)を読む。
新しいGIF方式を実装する依頼ではない。既存time GIFの音響側の受入を埋める。

## 到達点

実solveAcousticTransient由来の小さな2ケースでtime GIFを検証する。
再利用可能なfixture/targeted testと実Chrome手順/証拠を残す。
現在の正式Chrome証拠は熱timeと線形弾性deformationが中心で、音響実機は未確認。
調査メモだけでこの受入を完了にしない。

## 読む順序

1. docs/view-compare-design.mdのtime GIF契約。
2. src/acoustic-transient.js、tests/acoustic-transient.test.mjs。
3. src/comparison-time-plan.js、tests/comparison-time-plan.test.mjs。
4. src/comparison-export-adapter.js、src/ui/comparison-gif.js。
5. tests/comparison-export-adapter.test.mjs、tests/comparison-gif.test.mjs。
6. docs/evidence/2026-10-19-comparison-time-deformation-gif-real-chrome.json。

開始時rgで確認する。すべて指示作成時に実在したパス。

## 変更可能

- 新規tests/comparison-acoustic-time-gif.test.mjs。
- 必要最小の新規tests/fixtures内fixtureまたは生成helper。
- docs/evidence/配下のsanitized JSON/必要画像。
- docs/view-compare-design.md、docs/en/view-compare-design.mdの限定証拠追記。
- runtime修正は新テストで実症が再現した箇所だけ。変更前にrootへ差を報告。

## 禁止

- 音速/密度/dt/安定性/解像度/solver反復上限の緩和。
- 保存pressure配列を人工的な解析成功結果として捏造すること。
- orbit/GIF encoder/既存熱経路の再実装、新tool、MP4。
- 実Chromeの代わりにNode-hostedだけを使って実機合格とすること。

## 実装・検証手順

1. 既存過渡音響の最小有効mesh/境界fixtureを再利用する。
2. c=343 m/s、rho=1.2 kg/m³等の値はfixtureの明示値として記録し、既定を推測しない。
3. 周波数/mesh/dtは既存fixtureの安定条件をそのまま守る。
4. 同じ時間軸で2ケースを実solverから生成し、異なる明示source振幅を使う。
5. 比較の物理範囲は両保存軸の共通範囲内とし、start/end秒を証拠へ記す。
6. pressureの単位はPa、fieldはinstantPressureを使う。
7. timePlanとencoderを結合したtargeted testを作る。
8. i/23の24要求時刻を計算し、各panelのnearest frame/time/offsetを照合する。
9. カメラと全選択可能frameの共通rangeが全24枚で不変か確認する。
10. 実Chromeへ実結果ケースを登録し、正式MCPのexport→artifact全bytes/SHAを検証する。
11. 外部decoderで24枚/640×320/総delayを確認する。
12. 成功/取消/再作成後の入力・ケース・結果・比較設定を前後比較する。

## 受入

- format=gif、animation=time、seconds=2。
- 24枚、640×320、RGB332、delay合計200 centiseconds=2000 ms。
- first phase=0、last phase=1。物理時間と2秒の表示時間を混同しない。
- 全frameの物理時刻は保存frameから選ぶ。新しいpressure値を補間しない。
- offsetはactualTime-requestedTime秒で符号を保持する。
- toleranceSeconds=0で非保存時刻を含む範囲は既存規則どおり拒否する。
- stale case revision、静的音響field、start>=endを拒否する。
- 取消成果物は取得不可、元4状態は完全一致。
- source振幅が異なることと、solver値を保存後書換えていないことを証明する。

## 対象テスト

```text
node --test tests/comparison-acoustic-time-gif.test.mjs tests/acoustic-transient.test.mjs tests/comparison-time-plan.test.mjs tests/comparison-gif.test.mjs
```

既存assetを丸ごと複製せず小さな参照を使う。実solver出力と合成表示fixtureを区別する。

## 実Chrome境界

source凍結/no-HMR、owned tabと正式MCPを使う。秘密は出さない。
実機不可ならfixture/testを納品し、実Chrome受入は未完と明記する。
24枚の違いだけでは波動精度や時間積分精度の証明にならない。

## 停止・最終成果

不安定/解像度拒否なら範囲を広げず、元fixtureとの差を報告して停止する。
接続resetなら失敗を保持し、無制限再試験しない。
新test/helper、全bytes SHA、decoder集計、24frame選択照合、4状態復元を提出。
VIEWCOMPAREはbuilding、一般精度/公開HTTPS/MP4は未完。171/133/残38を維持。
