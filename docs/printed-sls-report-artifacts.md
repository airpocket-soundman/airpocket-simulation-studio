# 保存SLS/Pronyレポートの読取専用ページ出力

[English](en/printed-sls-report-artifacts.md) · [保存CLI](printed-sls-prony-cli.md) · [物性変換の限界](printed-sls-prony-roundtrip.md)

`createPrintedSlsReportArtifact({rawReport,expectedSHA256,query})` は既存の保存JSONからnative CSV/JSON/SVGを作ります。再同定、Prony駆動、元datasetの再読込、solver、UI操作はしません。入力SHAは利用者が指定する内容identityであり、物理的正しさ・真正性・元データとの再照合を保証しません。

queryはpairIndex（0〜7）、role（training/validation）、format（csv/json/svg）、offset（0以上）、limit（1〜50）を明示します。1片ペアの1role・1ページだけです。source全行数、返却数、未表示数、nextOffsetを必ず示し、full curve出力と呼びません。系列はobserved、idealStep、PronyNominalの3種類で、公称応力Pa・保持開始からの経過秒・工学保持ひずみ1を区別します。CSV/JSONには元時刻も残します。

原文は4MiB以下、UTF-8/BOMなし。専用parserがdecoded重複key、深さ16、400000値、4096配列要素、4096文字列上限と非有限数を拒否します。全体とモデルの成功/拒否schema、版、synthetic/未校正flags、source SHAの内部一致、全行の尺度・時刻・応力変換、保存済み係数の代数関係、残差集計の整合を検査します。物性の再解析・実測精度の保証ではありません。初期のstdio隔離前schema1レポートも既知のlegacy execution欄として読みますが、stdio隔離の証明を補いません。

未同定片/timeout等は理由と空の曲線を返します。SVGにpolylineを作らず、CSVのrefused行はmetadataのみで数値を捏造しません。JSONはrows:[]です。XML文字列はescapeし、内部C0（TAB/LF/CR以外）、FFFE/FFFF、lone surrogateは取込境界で全format拒否。通常の日本語・正当な絵文字pairは維持します。CSVは文字列セルをquoteし、先頭の= + - @等はapostropheで数式解釈を抑止します（数値の負値は数値のまま）。TAB/LF/CRはXML上合法な文字として保持しCSVではquoteします。

返却全体はUTF-8 64KiB以下。ページ本体は32KiBの余裕枠で組み立て、長いlabel等で必要なら返却行を50以下へ減らしresponseLimited/nextOffsetで明示します。nativeartifactのbytes/SHA、元reportのbytes/SHA、ページ情報を付けます。出力は同じ原文・queryで決定的です。有限仮想ramp、微小振幅/時間刻み極限、未校正・精度未検証の注意をnative出力にも残します。

`readPrintedSlsReportArtifact({reportPath,expectedSHA256,query,outputPath?})` は共通path/noLinks/regular-file gateを再利用します。4MiB専用readerはFDの前後stat（dev/ino/size/mtime/ctime）とpath再stat、limit+1読取、fatal UTF-8/BOM検査を行います。元の2MB用shared helperは変更しません。optional outputPathは新しいnative CSV/JSON/SVGだけを同一directoryの一時ファイル→exclusive hardlinkで原子的公開し、既存ファイルを上書きしません。JSON wrapperへCSV/SVGをquoteして保存するものではありません。原子的完成bytes公開であってfsync/停電耐久保証ではありません。返却publication SHAはnativebytesと一致します。

今回MCP/GUI/進捗/共有mainは変更していません。[証拠](evidence/2026-11-07-printed-sls-report-artifacts.json)

## 正式MCP

`studio_read_printed_sls_report({reportPath,expectedSHA256,query,outputPath?})` は同じページ出力を使います。queryのpairIndex/role/format/offset/limitは必須です。optional outputPathはCSV/JSON/SVGのnative bytesを新規保存し、artifactとpublicationのSHAを保持します。応答の64KiBはserialized tool data valueで、RPCの重複表現・envelopeは別です。
