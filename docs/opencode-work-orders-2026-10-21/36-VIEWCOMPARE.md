# 36 VIEWCOMPARE — 実Chromeで音響time GIFをdecodeして照合する

## 前提・読む順
1. [00-COMMON.md](00-COMMON.md)。専用treeは最新origin/mainから作る。
2. #136 head `c7ef1e5625ce3ce4266ca7a8a12c3448558e6a21`のorigin/main入りを確認。
3. `tests/comparison-acoustic-time-gif.test.mjs`、同`fixtures/comparison-acoustic-time-gif.mjs`。
4. `src/comparison-time-plan.js`、`src/comparison-export-adapter.js`、`src/ui/comparison-gif.js`。
5. `skills/airpocket-studio/SKILL.md`と正式比較/出力手順。
既存testのcanvasはstub。実solverの数値成功と実画素decode成功は別と理解する。

## 今回の単位
2つの過渡音響caseから実Chromeの比較time GIFを出力し、取得byte/SHA/decode/取消復元を確認する。
thermal GIFやorbit GIFの実績を、音響time GIFの実証に流用しない。
音響数値の一般精度保証や、全出力/公開HTTPSの保証は含めない。

## 変更してよい場所
- `docs/evidence/<実日付>-opencode-viewcompare-acoustic-chrome.json`、実decodeのPNG。
- `tests/comparison-acoustic-time-gif.test.mjs`とfixture：発見した不整合の最小回帰。
- バグが出た場合のみ上記比較time/export/GIF moduleの最小修正。
- GUIの全面再設計、encoder置換、新物理、progress/共有Skill変更は禁止。

## 実行順
1. Chrome操作と正式MCPを確認。HMRなしlocalhost合成sourceを固定し、最小scopeでpairing。
2. 空気343m/s・1.2kg/m3、4kHz、pulseWidth0.0001s、duration0.0012sを明示する。
3. 同じモデル/mesh/境界のsource振幅1Paと2Paで実solverの2caseを保存する。
4. 正式APIとGUIから同じ2case・instantPressure・time animationを選ぶ。
5. 2秒/24frame/640×320、共通固定色range、固定cameraでexportする。
6. 正式artifact取得経路で全byteを取得し、manifestのbyte長/SHA-256と一致確認する。
7. 実decode手段を確認し、全24frameのdimensions/delayと先頭/中間/末尾画素を読む。
8. decode不可ならheaderだけで実decode成功とせず、この受入は未完と記録する。
9. 出力成功前後、実行中取消前後でinput/result/cases/comparisonの4状態を比較する。
10. stale revision/単一時刻/範囲逆転の拒否を確認し、正常artifactを捏造しない。
11. 自分のtab/server/MCP接続/秘密だけcleanupする。

## 数値入り受入
- 出力24frames、各640×320、delay合計200centiseconds＝2000ms、loop設定がmanifestと一致。
- time phaseはi/23で先頭0・末尾1。各panelはnearest保存frame、interpolated:false。
- 元の物理時刻は0〜0.0012s。表示動画2秒を物理解時間と混同しない。
- 共通色rangeは両caseの対象保存場のmin/max。カメラとrangeが全frameで固定。
- 同一linear fixtureなら2Pa/1Paの圧力比2を許容差1e-9で確認する。
- 別meshを使う場合、対比条件と実誤差を記録し、unit-tet参照値を流用しない。
- GIF全byte/SHA一致、実decodeした先頭/中間/末尾のPNGまたはpixel hashを保存。
- 全24frameがdistinctとは要求しない。nearest保存時刻で同画素になる場合を正直に記録。
- 取消はartifactなし、busy/lock解除、4状態deepEqual。入力版とcase版は変化0。
- stale/不正rangeは描画開始前拒否。tolerance0の未保存中間時刻も拒否する。

## 対象試験・停止
- `node --test tests/comparison-acoustic-time-gif.test.mjs`と修正箇所の既存targetのみ。
- `npm run check:contracts`、`git diff --check`。
- 実Chrome/正式tool/decoder不在ならできない範囲を明記して停止。stubへ置換しない。
- 数値非finite、保存時刻不一致、取消後状態差、版違いは失敗として保持する。

## 証拠・完了
source/runtime/Chrome版、入力条件、case/result版、manifest、全byte/SHA、decode実測を記録。
GUI/API/正式MCP/decoderのどの経路が実行されたか分け、秘密・全環境変数は残さない。
正常2経路とdecode、3拒否、取消復元、cleanupが確認できればこの単位は完了。
VIEWCOMPARE親は未完維持。実測不足のままreleasedへ変更せず通常PRで渡す。
