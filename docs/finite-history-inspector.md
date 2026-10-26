# 有限材料点の保存入力履歴を確認

[English](en/finite-history-inspector.md) · [入力形式](finite-visco-input-history.md)

材料欄の下にある「有限材料点の入力履歴を確認」を開く。既存の保存JSONを貼り付けるか「合成例を入力」を押し、「履歴を確認」を実行する。例は既存のpublic/examples/finite-visco-input-history.jsonと同じ入力値（LFの明示テキスト）であり、実測データではない。Ctrl/Command+Enterでも実行できる。

常に「合成・暫定・未校正」と表示する。既存referenceのI/Z0から明示F/dtを再計算し、最終時刻、F、Green–Lagrange E、second Piola–Kirchhoff S・first Piola–Kirchhoff P・Cauchy sigma（Pa）、自由エネルギー・累積仕事・累積散逸（J/m³-reference）、散逸率（W/m³-reference）、raw/canonical入力SHAを表示する。途中で拒否された場合は0始まり失敗段階と完了段階数を表示し、成功summaryは表示しない。履歴全段階の曲線や状態の再開は提供しない。

入力は既存strict parserのみを使う。1MiB/4096段階・単位・合成flags・重複key・unknown key・数値範囲の拒否を維持する。textarea文字数とUTF8 byte数をworker作成前に確認する。1回につき専用moduleWorkerを1つ所有し、10秒の監視時間で拒否する（JavaScript停止中の実時間上限ではない）。成功/失敗/worker error/messageerror/取消/入力変更/破棄で所有workerをterminateし、待機Promiseをsettleする。旧世代の応答は表示しない。pagehideはBFcache保存時に取消のみ、通常破棄時は画面をdestroyする。

Workerは内部のissued finalStateを送信せず、固定サイズの最終観測または失敗情報だけを返す。UIは表示する行列・有限値・単位・flags/hashを確認し、全てtextContentで描画する。5つの3×3行列と固定の数値欄だけであり、4096段階でも表示行数は増えない。object URL、ダウンロード、外部送信、project/case/materialの変更、MCP method/scope追加はない。

これは材料点の合成参照を調べる入口であり、実測・材料同定・構造解析・塑性・損傷・破断予測・材料校正・FINITEVISCO1の完了を意味しない。既存のsolverや表示倍率アニメーションとは別である。UIの実画面確認はこの実装時点では未実施。

回帰は独立hydrostatic解析解、線形E ramp/holdのMaxwell応力・散逸解析解、厳密parser拒否、raw入力hash、最大4096段階、実moduleWorkerメッセージ、取消/入力ABA/直接入力変更/破棄/timeout/errorと不正応答を検証する。[証拠](evidence/2026-10-27-finite-history-inspector.json)。


## 実画面確認（2026-10-27、限定例）

[通常main/IABのGUI証拠](evidence/2026-10-27-finite-history-inspector-gui/README.md)で、既存public合成例のボタン入力・実Worker再計算・日英切替を確認した。4段階/最終4.7秒、仕事72.7319228・自由エネルギー39.9520031・散逸32.7799197 J/m³-reference、5行列45cellがdomain出力の9有効数字と一致した。raw SHAは `6366950b1f9b41a412fa8f22f28ed6eab12f2937411588ecebd6e85188fc0d86`、canonical SHAは `8daace3d459a7e6d5288744c3fe6f3d2ff6a33c8136b0c3b21c791aa0adb5e71`。入力編集で旧結果が直ちに消え、`{` は実Workerで拒否され、クリア後は入力/結果空・idleへ戻った。

数値・動作確認はe972ce8、後続4c02210は表幅/余白のみの修正であり、実GUIの全45cellは同一、captionは1行だった。e972ce8でfocused56・型28・build・local28（46816.716 ms）、4c02210で関連16（独立4を含む）成功。後者のsourceでfull build/localを再実行したとはしない。272個の保護対象DOM controls・条件表示・case数のEN baseline/final一致を確認したが、正式in-memory APIのproject/case/analysis同一性や実取消の受入は主張しない。上の未実施記述は実装時点の履歴である。一般物理・材料校正・構造解析・親タスク完了・公開成功は未証明。


## 狭いサイド欄の表示追補（2026-10-27、7d1e657）

後続のstyle-only修正7d1e657は、説明/hash行のoverflow-wrapと結果欄のmax-width・横スクロールだけを変更した。[表示幅の証拠](evidence/2026-10-27-finite-history-inspector-responsive/README.md)。実1280×900 desktopで幅269pxのasideのscroll幅は495→269px、幅233pxの結果欄は477→233pxとなった。全45cellは変更前と一致し、関連16試験が成功（1438.3942 ms）。e972ce8と4c02210の前段証拠は保持する。これは当該desktop配置の表示確認であり、一般的な全画面サイズや新たな物理検証を意味しない。


## 任意の最終合成観測比較（2026-10-27追補）

履歴確認とは別に、同じ画面の折り畳み欄から[最終合成観測1点との比較](finite-observation-inspector.md)を実行できる。履歴確認は独立して使用でき、比較は別の明示ボタンでのみ実行する。両入力の版・時刻・単位・由来が一致しなければ拒否し、応力/エネルギー/散逸の差を合否や校正へ読み替えない。この新しい比較UIの実画面確認は未実施であり、上記203履歴確認のGUI成功とは区別する。
