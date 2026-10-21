# 再実行手順（合成入力のみ）

1. source56576af6を専用worktreeで用意し、既存依存と配信キャッシュを使用してlocalhostを起動する。
2. Chromeで390×844 CSS pxへ設定し、GUI「プロジェクトを開く」からvalid-warning.jsonを読み込む。
3. 現在の入力をチェック。3つのUNIT_MAGNITUDE_SUSPECTとindex0/1/2を読む。
4. GUI「プロジェクトテキストを表示」のJSONを保存する。各案内ボタンをEnterで実行し、activeElement=material-status、親detailsが開くことを読む。
5. 再書出しJSONと前をbyte比較する。英語へ切替え再checkし、案内とfocusを確認する。
6. mesh-sizeを変更して旧リンク0、再checkで3を確認する。
7. valid-inrange.jsonをGUIで読み込み、単位警告0を確認する。
8. invalid-requested.jsonは正規validatorが拒否する。隠れた状態へ注入せず、警告表示受入には使わない。
9. viewportを戻し、所有tab/serverを終了する。Node検証は既存43focused試験を実行する。

原本browser-readbacks.jsonはGUI書出し前後と3focus読取を含む。Chrome実版は取得していない。
