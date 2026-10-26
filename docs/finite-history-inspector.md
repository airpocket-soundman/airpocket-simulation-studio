# 有限材料点の保存入力履歴を確認

[English](en/finite-history-inspector.md) · [入力形式](finite-visco-input-history.md)

材料欄の下にある「有限材料点の入力履歴を確認」を開く。既存の保存JSONを貼り付けるか「合成例を入力」を押し、「履歴を確認」を実行する。例は既存のpublic/examples/finite-visco-input-history.jsonと同じ入力値（LFの明示テキスト）であり、実測データではない。Ctrl/Command+Enterでも実行できる。

常に「合成・暫定・未校正」と表示する。既存referenceのI/Z0から明示F/dtを再計算し、最終時刻、F、Green–Lagrange E、second Piola–Kirchhoff S・first Piola–Kirchhoff P・Cauchy sigma（Pa）、自由エネルギー・累積仕事・累積散逸（J/m³-reference）、散逸率（W/m³-reference）、raw/canonical入力SHAを表示する。途中で拒否された場合は0始まり失敗段階と完了段階数を表示し、成功summaryは表示しない。履歴全段階の曲線や状態の再開は提供しない。

入力は既存strict parserのみを使う。1MiB/4096段階・単位・合成flags・重複key・unknown key・数値範囲の拒否を維持する。textarea文字数とUTF8 byte数をworker作成前に確認する。1回につき専用moduleWorkerを1つ所有し、10秒の監視時間で拒否する（JavaScript停止中の実時間上限ではない）。成功/失敗/worker error/messageerror/取消/入力変更/破棄で所有workerをterminateし、待機Promiseをsettleする。旧世代の応答は表示しない。pagehideはBFcache保存時に取消のみ、通常破棄時は画面をdestroyする。

Workerは内部のissued finalStateを送信せず、固定サイズの最終観測または失敗情報だけを返す。UIは表示する行列・有限値・単位・flags/hashを確認し、全てtextContentで描画する。5つの3×3行列と固定の数値欄だけであり、4096段階でも表示行数は増えない。object URL、ダウンロード、外部送信、project/case/materialの変更、MCP method/scope追加はない。

これは材料点の合成参照を調べる入口であり、実測・材料同定・構造解析・塑性・損傷・破断予測・材料校正・FINITEVISCO1の完了を意味しない。既存のsolverや表示倍率アニメーションとは別である。UIの実画面確認はこの実装時点では未実施。

回帰は独立hydrostatic解析解、線形E ramp/holdのMaxwell応力・散逸解析解、厳密parser拒否、raw入力hash、最大4096段階、実moduleWorkerメッセージ、取消/入力ABA/直接入力変更/破棄/timeout/errorと不正応答を検証する。[証拠](evidence/2026-10-27-finite-history-inspector.json)。
