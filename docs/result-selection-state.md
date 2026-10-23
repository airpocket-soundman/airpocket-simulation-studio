# 結果選択の世代と非同期取消（MOD1 / 指示69）

[English](en/result-selection-state.md)

結果表示APIのhash検査中にA→B→同じAへ切り替えると、最後のobject同一性と内容だけでは旧要求を識別できない。`src/result-selection-state.js` はDOMを持たず、選択期間のguard、無効化、破棄だけを保持する。節点・結果配列・case ID・認証情報は保持しない。数値カウンターではなく私有identityを使い、同じ結果の再選択でも以前のguardが復活しない。

mainはこの境界を `resultViewApi` の内部adapterへ注入し、`clearAnalysis()`（保存ケースの復元を含む）、GUIの計算取消、pagehideで旧要求を無効化する。hash待ち後と設定commit前にguardを検査し、古いget/probe/setを拒否する。色範囲操作はget→setを跨いで元のguardを使い、旧要求のエラーで新しい画面の状態を戻さない。pagehideでは永久破棄せず無効化するため、bfcache復帰後は新しいguardで操作できる。

`dispose()` はこの境界を所有するhostの永久破棄用で、既存・将来のguardをすべて無効化する。`invalidate()` は非同期結果の採用を取り消す処理であり、solverの終了そのものは既存の解析job取消に任せる。既存のAPI応答、result/physical revision、保存schema、公開ツール、表示文言は変更しない。adapterがguardを供給しない既存の利用先も従来動作を維持する。

合成入力の回帰でA→B→A、旧編集/測定の到着、取消直後の再選択、破棄後応答、get/setを跨ぐ切替を確認した。修正前は新6試験中4件が失敗し、修正後は拒否と正常再選択が成功した。通常値・revisionと旧adapterの応答完全一致、元入力不変、既存の保存view/ケース復元も関連試験で確認する。module層・公開runtime importの正例/負例型fixtureを登録した。

実Chromeの日英ケース切替は未確認。NodeのDOMなし回帰や既存UI fixtureを、その実機確認やMOD1全体・公開ゲートの完了へ読み替えない。この単位は結果選択と表示設定の1経路に限り、大規模main分割や一般の非同期処理変更は行っていない。
