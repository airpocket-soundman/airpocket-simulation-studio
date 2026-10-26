# 保存時刻GIFの独立所有権監査

[English](en/single-stored-time-gif-independent-audit.md) · [機能契約](single-stored-time-gif.md)

固定owner `1e365866f3ab3017b3b971d54da304644dbf801f` を読み取り監査し、4回帰を追加した。production sourceは変更していない。[記録](evidence/2026-10-27-single-stored-time-gif-independent.json)。

初期324dd7eではsnapshots.length=2の検査後にfor-ofで走査し、独自iteratorが62frameを返すとstoredTimes62・最後index61・scalarBytes16の不整合を受理した。最終版はown-data/indexed走査へ修正済みで、同じ反例をhook実行0で拒否する。frame/time/scalar/coordinate getterも実行しない。名前付きmap hookを持つ通常配列もそのhookを呼ばず、実際のindexed dataだけを扱う。

所有権回帰はproduction job→結果準備handoff→表示adapterの3層を通す。補間表示2秒から最初の保存0秒をcaptureした後、量子化中のyieldを停止する。取消またはwatchdog要求後も、job tokenをreleaseしても、executionSettledはfalse、3層の予約・controls lock・0秒の表示を保持し、次job/準備とartifact取得を拒否する。実yieldを解決して初めて2秒へ復元し、lockとcanvasを解放する。実Threeカメラの行列も有限のまま確認する。

別回帰は全24capture・終端10秒の後、SHA promiseを停止する。取消後も3層は未終了で、digestが実際にsettleしてから復元し、成果物を公開しない。これはPromisechain/renderer予約の単体検査であり、OS/native codec資源解放や停止JavaScriptでの実時間上限の証明ではない。

物理範囲2〜48秒をphase i/23へ独立に割り付け、保存時刻[2,6,48]の最寄り選択数[2,11,11]・下側tie・両端exact/終端offset0を両result kindで検査する。表示時間1/15秒が物理選択を変えない。初版の内点を整数完全一致とするtest仮定は27.999999999999996との差で失敗したため、内点だけ16EPS×scaleのIEEE丸め境界へ修正し、端点は完全一致を維持した。製品コードや既存閾値を緩めていない。

新4件と関連計110件が成功（失敗/skip0、12.0989619秒）。型29/層/日英docを含み、実solve依存のfixed-frame fileは実行していない。ownerの既存WASM欠如による準備失敗記録は維持する。追加GUI/native codec/solver/実product exportは0。実GIF画素・可視モデル・公開・親完了は未証明である。
