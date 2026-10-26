# 正式APIによる録画取消の限定実証

[English](en/formal-export-cancel-2026-10-27.md)

[元証拠](evidence/2026-10-27-formal-export-cancel/README.md)は通常main/IAB・日本語foregroundで、既存2熱ケースの比較orbit WebM15秒を1回開始し、正進捗/running/未settledを確認して即座に正式cancelExportを1回実行した記録。cancelledかつexecutionSettled:true、成果物拒否BROWSER_OPERATION_FAILED、bytes0、5状態不変、所有job解放を確認した。GUIcontrols復元と最後の接続欄クリアはrootの別DOM/画像証拠で確認し、driverのGUI未検証という元記述を上書きしない。sessionなし・子process実exit/close・PID不存在・token削除も確認した。

source c2ae100でbuild成功3.93s/local28成功39505.5137ms。新solve/外部decode/retry0、budget1/1消費。GUI取消ボタン/GUI切断取消、背景/英語matrix、公開の証明ではない。過去194/194b取消未達は維持する。P3/BROWSEREXPORT1のlastUpdate,lastUpdateEn,evidenceだけ更新し、全171statusと他の全fieldをdeep比較で維持した。
