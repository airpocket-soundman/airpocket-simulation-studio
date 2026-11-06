# 保存済み測定JSONのバッチ同定

独立した測定データセットを最大8件、順番に同定して1個の新規JSONへ保存します。別データセットを平均せず、材料適用・solver・校正は実行しません。`calibrated:false` と `accuracyVerified:false` を保持します。各データセット内の集約は既存の同定APIと同じです。

`node scripts/identify-printed-batch.mjs --manifest <絶対JSONパス> --output <新規絶対JSONパス>`

manifestは `{"schemaVersion":1,"entries":[{"id":"A","dataset":{"path":"D:/data/a.json","expectedSHA256":"64文字の小文字SHA256"},"options":{"path":"D:/data/options.json","expectedSHA256":"64文字の小文字SHA256"}}]}` です。未知フィールド、重複キー・ID・同一dataset/options SHA組、相対パスを拒否します。SHAはraw UTF-8 bytesの版指定で、認証や校正の証明ではありません。

上限はmanifest 131072 bytes、dataset 2000000 bytes、options 16384 bytes、入力参照の合計8388608 bytes、出力4194304 bytesです。再利用ファイルも参照ごとに合計へ加算します。同じ役割・同じ物理パス・同じSHAの再利用は許可し、異なるoptions版との比較に使えます。別名hardlink、役割間alias、manifestとのaliasは拒否します。symlink/junctionを含むパスは拒否し、通常ファイルだけを読みます。固定容量FD読み取りと前後の同一性検査で増大・差替えを拒否します。ただしOS全体の敵対的な親ディレクトリ差替えを防ぐsandboxではありません。

全入力の容量・版を確認してから逐次計算します。後段のSHA不一致でも全件を未実行として保存します。個別のモデル拒否や不正optionsは順序を保持し、他の正常結果を消しません。未同定specimenに推定パラメータを補いません。出力にはraw入力・パス・stackを埋めず、ID、SHA、有限の結果、安定した拒否codeを残します。

新規出力は既存のexclusive publisherを使い、既存ファイル・directory・linkを上書きしません。並行起動では1件だけが出版します。終了codeは全件同定0、拒否artifact保存2、CLI/path/出版エラー1です。不正manifest・内容・版の拒否は安全な出力先が確定した場合にartifactを残し、unsafe path/既存出力などはartifactを作りません。stdoutは小さいJSON summaryと出力bytes/SHAです。

検証は実CLIの8件・合計容量境界、独立した線形期待値、部分拒否、全版事前確認、リンク/変更拒否、同時出版、型、および既存単一CLIの成功/拒否artifactとのbyte完全一致です。新規実測、GUI、材料校正、一般的な精度保証は含みません。

[English](en/printed-identification-batch-cli.md) / [単一ファイルCLI](printed-identification-file-cli.md)
