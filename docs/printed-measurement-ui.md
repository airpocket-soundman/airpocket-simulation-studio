# 印刷材料測定の読取検査UI

[English](en/printed-measurement-ui.md)

基点 `2a5fab3`。mainの材料物性入力detailsの直後へ「印刷材料の測定JSONを検査」という折畳み入口を実際にmountした。JSON入力、検査button、明示した合成例、試験片select、応力–ひずみグラフ、数値表、原文/正規化JSON保存を提供する。project/case/solverへの登録や材料自動同定・適用は行わない。

`src/ui/printed-measurement-ui.js` は既存 `importPrintedMeasurementDataset` を直接使う。単位換算・原文SHA-256・合成/実測申告・機器版・校正報告・非有限/件数/2,000,000 UTF-8 byte検査を別実装しない。source/batch/方向/試験温度/速度/寸法/標点長と件数を表示し、原文hashや機器/校正の詳細は折り畳む。「入力検査済み」は物理精度や校正証明書の検証成功を意味しない。校正status/根拠はデータ内の報告値であり、装置も証明書も検証していない。measuredも実測と申告されたデータとして区別する。実測データは今回提供されていない。

工学応力はMPa、工学ひずみは無次元1で表示する。合成Z片は初期断面1 mm²、標点10 mm、1 N/0.1 mmの点が1 MPa/0.01になる。別方向のX片も合成で、材料定数や校正係数を発明しない。グラフは選択1片の取得順を最大201点へ間引き、表示数を明示。表は50行ずつ前後ページ、総数/表示範囲/ページ外件数を示す。全10,000点までの正規化結果は保存JSONに保持する。

入力変更時点で前の検証表示とURLを破棄する。世代番号で入力A→B→A、古いSHA完了、差替え、破棄後完了を拒否する。処理中の同一入力に検査を重ねない。raw変更をprogrammaticに行ってinput eventが無い場合も、完了時に文字列を照合して旧結果を採用しない。保存URLはこのUIが作ったものだけをrevokeし、破棄時は本文/DOM/listenerも解放する。pagehideがbfcache保存ならinvalidateだけ、恒久離脱ならdestroy。本文/ID/校正根拠はtextContentで描き、HTMLとして挿入しない。

標準summary/button/select/textareaに加えCtrl/⌘+Enterで検査できる。日英切替はdraft、hash、試験片、ページを保持してラベルを再描画する。SVGは100%幅、表は要素内スクロールで、390px確認用の[合成fixture](fixtures/printed-measurement-ui.html)と[JSON例](fixtures/printed-measurement-synthetic.json)を用意した。fixtureは単独UIの補助でありmain実配線の代わりではない。

rootでの実IAB確認: dev serverのmainを390px幅で開く→「03 解析条件」→材料物性detailsの直後の検査入口を開く→「合成例を検査」→Z/Xを切替し1 MPa/0.01と方向を確認→JSONを`{`へ変更して旧曲線/保存リンクが即消えることを確認→ENへ切替。検査前後の正式exportProject/case状態が変わらないことも確認する。単独fixtureは `/docs/fixtures/printed-measurement-ui.html?lang=en`。本提出のDOM回帰は実IAB/390px観測を代替しない。

保存リンクはJSONを作るだけで自動downloadしない。検査器の上限2 MB/100片/全10,000点を保持。対応していない単位、crosshead変位、不完全な校正根拠、不正試験片等は既存parserで拒否する。全連成、同定、実機校正、実測精度、製品物性の自動変更は未完。
