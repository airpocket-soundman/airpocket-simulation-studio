# 保存ファイル同定CLIの独立監査（2026-11-04）

[English](en/printed-identification-file-independent-audit.md)

固定CLI `449e3d2ec8a8dd3c72a5476284e83f52501fd3ad` と拒否診断修正 `6ba5983741b9b10c45d566a41f4188f9edd6741f` を監査した。CLIの追加必須修正は見つからなかった。独立4群を含む関連44件が成功し、37宣言の型検査も成功した。対象は保存済み合成JSONの読取専用同定で、製品ソースの変更は本監査コミットに含まない。

独立参照は [UI監査](printed-identification-independent-audit.md) と同じ、雑音がひずみと直交する原点通過回帰を使う。原文をm/kNへ変換し、UTF-8の日本語と空白を保持した実CLI出力について、E=7e8 Pa、SE=`100/sqrt(44e-6) Pa`、RMS=100 Pa、raw/options両ファイルの全bytes SHA-256・長さ・不変を照合した。保存成果物全bytesのhashと末尾改行も確認した。

一方の試験片だけが誤差条件を満たさない場合、全体のexit2/status refusedを維持し、その片には係数を発明せず元の拒否理由と有限なRSEを残す。他方の成功片は個別結果として保持し、1成功片だけの試験片間統計を作らない。rootの有限拒否診断修正についても、極小ひずみの未解決誤差とsubnormal時刻のSLSが、CLI成果物内で元の理由を保持し、未定義数値欄を省略することを実CLIで確認した。

3プロセスが同じ新規パスへ拒否結果を同時保存すると、勝者1件はexit2、敗者2件はexit1/OUTPUT_EXISTSになる。成果物は勝者の全bytes/hashと一致し、再起動しても既存内容・入力を上書きしない。終了後にtempファイルを残さない。テストの一時ディレクトリは専用接頭辞と親パスを検証してから削除する。

読み取り監査では、上限+1の固定bufferによるFD読取り、実読取り前後のbigintファイルidentity検査、UTF-8/BOM拒否、オプションJSONの復号後重複キー検査、既存ファイル・link/alias・symlink祖先の拒否、既存の排他的hardlink公開処理の利用を確認した。[JSON記録](evidence/2026-11-04-printed-identification-file-independent-audit.json) に固定source hashと実行範囲を保持する。

同時ファイル書換えや祖先パス差替えの全OSスケジュールを網羅した保証ではない。ブラウザー・実測校正・材料への適用・solver・新しい公開/MCP操作は検証していない。独立データでの材料精度検証と親PRINTMEASURE3の完了は残る。
