[English](en/printed-sls-report-independent-audit.md)

# 保存SLS report書出しの独立監査（2026-11-07）

固定owner `b428518` を監査し、追加の必須不具合は見つかりませんでした。新規独立4群を含む関連18件と型44宣言が成功しました。root統合 `21b0e44` と固定ownerのruntime4sourceはGit bytesが一致します。[証拠](evidence/2026-11-07-printed-sls-report-independent/report.json)

独自CSV parserで、quote/CRLF/改行と式に見える試験片IDを含む全81行を全pageから読み直し、Paの3系列が元の保存行と一致することを確認します。50行・64KiB上限とnextOffsetに欠落や重複がないことも検査します。SVGはXML parserでmetadataと日本語/emoji/特殊文字を往復し、全3polylineの各座標を独立のPa→pixel式で検算します。実際のGUI描画や画像の見た目は主張しません。

ファイル読取中の追記では `INPUT_CHANGED` でnative出版前に拒否し、既存出力を上書きせず一時ファイルを残しません。低level publisherはcopy前に文字列/UTF8上限を検査し、arraylike getterを実行しません。schemaのcountは整数かつ行数完全一致です。hashは保存内容の同一性であり、元dataset・物理・校正の再検証ではありません。XML controlは既存strict parserが拒否するため新規製品欠陥とは扱いません。

監査途中に1回、操作対象WTを誤って担当者WTのbranchを一時切替しました。ファイル移動はpath不存在で失敗し、source書込やcommit参照変更はありません。元のowner branch/b428/cleanへ復元し本人とrootへ連絡、上記source一致も確認しました。詳細を証拠に保持します。製品source変更・FEM/新solve・GUI・進捗昇格はありません。
