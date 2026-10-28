# 06 BROWSEREXPORT1 — slice PNG連番3枚の実機再現資産

対象: OpenCode / DeepSeek v4.1 Flash。先に[00-COMMON.md](00-COMMON.md)を読む。
既存固定フレームexportを再実装せず、未実機のslice経路を小さく検証する。

## 到達点

小さな実解析結果でsliceの3枚ZIPを生成・検証し、再現test/手順/証拠を残す。
同時に取消後の元表示復元を実機で確認する。
120枚/容量上限/一般形状の受入は今回閉じない。

## 読む順序

1. src/visual-export-fixed-frame.jsのfixedFrameScheduleと上限。
2. src/visual-export.jsのslice/preflight/render/finally。
3. tests/visual-export-fixed-frame.test.mjsのfixture/独立ZIP reader。
4. tests/visual-export-adapter.test.mjs、tests/browser-export-session.test.mjs。
5. src/visual-export-jobs.jsのmanifest/artifact/cancel。
6. docs/visual-export.mdとdocs/evidence/2026-10-16-fixed-frame-export-real-chrome.json。

実在確認済みのパス。開始時rgで名前と現sourceを再確認する。

## 変更可能

- 新規tests/visual-export-slice-reference.test.mjs。
- 必要ならtests/fixtures内の小さな実解析参照生成helper。
- docs/evidenceのsanitized JSON/必要画像。
- docs/visual-export.mdとdocs/en/visual-export.mdの証拠追記。
- runtimeの変更は具体的な再現不具合が見つかった最小箇所のみ、先にrootへ共有。

## 禁止

- ZIP/CRC/物理revision方式の再実装、固定frame上限の増加。
- 4 MiB/frame、24 MiB/archive、2〜120framesの許容緩和。
- PNGを架空の成功solver結果へ貼り付けること。
- 新tool/MP4/新GIF機能、installed Skill、巨大meshの反復実行。

## 実装・検証手順

1. 既存小構造fixtureを使い、物理入力と解法を明示して実結果を作る。
2. 断面軸/可動範囲は既存animationState/scene側の意味を確認する。
3. 参照geometryの軸範囲を0〜10 mmにできる既存fixtureを選ぶ。
4. 3framesのslice要求を共通export経路へ送る。
5. 純scheduleのpositionが0/5/10 mm、phaseが0/0.5/1になることを確認する。
6. renderに渡った位置とmanifest.slicePositionを照合する。
7. ZIPを独立readerで読み、manifestと3PNGのCRC/SHAを検証する。
8. 同じ凍結表示/locale/resultで再実行し、決定性の条件を記録する。
9. 実Chromeで正式MCP startExport→artifactページ全取得→SHA照合を行う。
10. 元入力/ケース/結果時刻・倍率/断面設定を記録し、完了後に比較する。
11. 次の出力を1枚以上処理した段階でcancelし、artifact不可と復元を確認する。
12. 新しい出力を再作成できることまで確認する。

## 受入

- format=png-sequence、animation=slice、frames=3。secondsを渡さない。
- ZIPはSTORE、manifest.json+frame3件。画像の大きさは実canvas値を記録する。
- phase両端を含み、slicePositionの単位はmm。
- geometryの可動範囲が違う場合、実際のmin/mid/maxへ置き換えて明示する。
- 3枚が同一画像になった場合、原因を調べず成功にしない。
- 画像SHAが異なるだけを断面物理精度の証明としない。
- cancel後は部分ZIPを取得不可、controls/カメラ/時刻/断面を元へ戻す。
- 単一ビューgif/mp4は非対応のまま。
- 120枚成功や最大RAMはこの3枚検証から推定しない。

## テスト

```text
node --test tests/visual-export-slice-reference.test.mjs tests/visual-export-fixed-frame.test.mjs tests/browser-export-session.test.mjs
```

独立ZIP readerは既存試験の方式を参考にし、writer自身で自己検証しない。
CRC/画像hash/manifest位置のどれを検証したかを分ける。

## 実Chrome条件

no-HMR/source凍結、前面表示、owned sessionを使う。
既存resultRevisionとphysicalRevisionの役割を変えない。
同じ結果でもlocale/captionが変わればbytesが変わり得ることを記録する。
実機不可ならtargeted test/helper納品までとし、実Chromeは未完にする。

## 失敗・成果

空画像/ZIP不正/timeoutは失敗として残す。上限を増やして通さない。
不具合修正は新testで実症を固定してから最小範囲で行う。
最終報告はtest/helper、3PNG/ZIPの照合、schedule/復元/取消の証拠、残条件。
BROWSEREXPORT1はchecking。171/133/残38と親の未完条件を維持する。
