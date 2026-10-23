# PR191候補の検証まとめ（2026-10-24）

[English](en/pr191-validation-summary-2026-10-24.md)

固定参照は `b5ec169`。PR191向けの統合候補であり、この記録は未merge・未公開として扱う。171件中134 released、37未完の状態と親受入条件は変更していない。過去の固定snapshotは上書きせず、以下の限定成果を追補する。

## 独立Skill一巡

[Full Skill191証拠](evidence/2026-10-24-full-skill191-independent.json)と[実行報告](full-skill191-independent-2026-10-24.md)は、固定source1412075の通常mainと正式stdio MCPによるfresh post-pair合成一巡。rootがIABで4scopesをGUI pairし、その後のproject操作はMCPのみ。IABのChrome系UAを、独立branded Chrome実行とは呼ばない。

study46keys保持、provenance拒否→未確認の合成仮定で修復、5mm/pcg-strictの2mesh＋2solveが成功。両mesh94節点/218Tet、100N/200N先端変位0.04/0.08mm、比2。PNG95,986bytesとarchive241,285bytesの全bytes/SHA、出力後4baseline不変、3拒否checkpoint、全release/sessions空/secret削除を確認。89raw証拠のGit blob bytes/SHAが一致した。中間artifactはmeshのみでfieldなし。

caseArchiveReadへ余分なencoding fieldを要求したdriver assertを1回修正した。既取得pageから継続し、recipeや製品source・成功mutationを変更/再実行していないが、無修正の自動script成功とは呼ばない。

## 既存比較GIFと配布文書

[GIF証拠](evidence/2026-10-24-comparison-gif-timing/README.md)は40ファイル（39データファイルのSHA、残りは属性設定）。保存済み熱/音響ケースから3回exportし、最終的に2成果物を保持・検証。2回のdriver検査停止と補正を保存し、単純な全試行成功とは呼ばない。各GIF24frame/48panel記録を独立照合・decode、solverは0回。両panelの保存時刻軸は同一で、異軸panelの実画面検証・GUI Blob download完了は未確認。fresh Skill再現とは別の既存機能検証である。

[Skill個人配布同期](evidence/2026-10-24-skill-distribution-sync.json)はSKILL.mdとjobs-observations.mdの2文書だけを既存個人installationへ同期し、sourceと同期後hash一致を記録。独立一巡終了後の作業であり、その実行に後から新手順を適用したものではない。plugin/server/model/資格情報/権限設定は変更していない。

## 終了helperの修正

[owner検証](evidence/2026-10-24-stdio-confirmed-close.json)と[独立監査](evidence/2026-10-24-stdio-close-independent-audit.json)。EOF→SIGTERM→SIGKILLを実exit確認まで待ち、不能時はstable error、冪等close、RPC30秒deadlineと自動再送禁止を維持。実metadata-only起動/closeは16ms・exit0/signal null・owned handles0、solver0。独立監査はclose後の遅延EPIPE crashを再現し、stream実closeまでerror guardを保持する修正を追加。関連35試験（文書2件を含む）が成功した。

## 維持する残条件

合成仮定は物理校正ではない。実測/一般形状精度、全物理preflight、実AI認証、GUI準備を含む無人Skill全体、異時刻軸panel、実download、WebM個別frame時刻/MP4、実録画失効行列、候補の最終CI/merge/公開HTTPSは個々の証拠で確認する。旧helperで行ったSkill/GIF終了の歴史記録を、新helperの成功へ書き換えない。このまとめは新solver/ブラウザ再実行を行わず、候補証拠を照合した文書である。
