# 結果書き出し準備の非同期責務分離（MOD1）

[English](en/result-export-preparation.md)

`main.js` のvisual export準備・renderer引渡しを `src/result-export-preparation.js` に分離した。resultView取得中の表示/取消確認、thermal物理時刻を含むview snapshot、render直前の同一性、取消・破棄後の遅い完了破棄をこのadapterが扱う。描画・結果物byte/hash・job保持・公開APIは既存 `createVisualExportJobs` とrendererに残し、保存形式と画面表示を変えない。

選択世代は既存 `result-selection-state.capture` を借りる。別の世代カウンターや保存IDは作らない。同じ結果objectへA→B→Aと戻っても古いprepare/renderは失効する。prepare完了後も借りたguardと結果参照を引渡しまで保持し、expectedResultRevisionも照合する。view/setupは切り離して返す。

取消は未完prepareの結果を捨て、render中はjob側のsignalとadapter側取消をrenderer専用signalへ接続する。abortを無視するrendererでもsettleまで所有権を保持し、新prepare/renderを拒否する。失敗時もfinallyで自分の所有権だけを解放する。`dispose` は恒久破棄するが、借りた選択stateを破棄しない。

mainはこのadapterのprepare/renderを実際にjob serviceへ渡す。結果clear、解析取消、export cancelAllでadapterを取消。pagehideはbfcache保存時には取消だけ、恒久離脱時にはdisposeし、既存の選択guard無効化も維持する。

合成fixturesで通常snapshotと旧inline経路のartifact/status完全一致、古いAの再選択、prepare中取消、未settled renderer、dispose、例外後解放、実job serviceとの取消連携を確認した。物理solver・ブラウザー実測・公開はこの分離の受入に含まない。
