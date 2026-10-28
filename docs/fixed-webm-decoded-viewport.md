# 固定WebMの復号表示領域検証

[English](en/fixed-webm-decoded-viewport.md)

初回熱WebMは復号寸法の検査で拒否され、成功artifactはない。rootの別の1frame native診断では、要求440×637に対してcoded440×638、visible/display440×637、原点0・rotation0・flipfalseを観測した。[WebCodecs仕様](https://www.w3.org/TR/2026/WD-webcodecs-20261019/#videoframe-interface)ではcoded寸法が非表示paddingを含み得るため、要求画素と内部記憶寸法を分けて検証する。

共有decoderはvisibleRectの全値を整数、原点0、幅高さを要求と完全一致、coded内包含とする。display寸法も完全一致、rotation=0/flip=falseを必須とする。coded寸法は正の整数で、要求以上かつ各軸+16px以内という製品固有のstorage profileに制限する。16pxはcodecの一般保証ではない。PTS集合・未submit・重複・終端・flush・private byte SHA条件は変更しない。captureを偶数化せず、任意crop/aspect変換を許可しない。

fake20回帰はnative観測のodd padding、+16境界、誤visible/display・小数・範囲外・+17・変換・PTS違いを検査する。既存fake codecにも現実のviewport metadataを追加した。関連183成功・失敗/skip0、型25宣言。広い初回200件では198成功、2失敗（fresh worktreeの既存WASM欠如で実solve未到達、旧thermal blanket拒否assert）を記録し、後者はtemperature未選択拒否へ更新した。WASM取得や実solver再実行はせず、該当fileはrootの既存build環境で確認する。

[原診断bytes/SHAと結果](evidence/2026-10-26-decoded-viewport/summary.json)。この修正後の実熱動画成功は未確認で、自動再exportはしていない。owner側の新realcodec/GUI/solver/exportは0。
