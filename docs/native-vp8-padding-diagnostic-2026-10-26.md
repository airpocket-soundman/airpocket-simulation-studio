# 孤立VP8寸法診断（2026-10-26）

[English](en/native-vp8-padding-diagnostic-2026-10-26.md)

rootが通常製品のexportとは別に実行した、1frameのnative VideoEncoder/VideoDecoder診断を固定する。[集約JSON](evidence/2026-10-26-native-vp8-padding-diagnostic.json)と[原観測](evidence/2026-10-26-native-vp8-padding-diagnostic/native.json)、[画像](evidence/2026-10-26-native-vp8-padding-diagnostic/native.jpg)を保持する。HTMLは診断のsource保存であり、この追補では開いて再実行していない。raw3ファイルをbyteコピーし、SHA256とGit blob SHA1を照合する。

requested/inputは440×637、inputのcoded/display/visibleRectも440×637。1回encode/1回decode後、decodedはcoded440×638、display440×637、visibleRect x0/y0/440×637、rotation0/flip false、timestamp0だった。reported UAはChrome156系で、完全版や別engineを保証しない。製品export回数は0。画素全体や任意codec対応の精度試験ではない。

この孤立結果はcoded高さのpaddingとvisible/displayの保持を観測したもので、[失敗200](evidence/2026-10-26-thermal-time-webm-failed/README.md)の元frameのexact native propertiesを直接記録したものではない。元失敗の根本原因がこの観測だけで確定したと主張しない。元のfailed/settled状態・artifactなし・予算消費・GUI復元/cleanup記録はそのまま保持する。

元driverのSHA256 `1d458e83c8e11af96fc3ac52d69d6970f50168a330fdbcce273813fc64dc1e88` は不変を再確認した。保存作業で追加の製品export・solver・codec・GUI実行は0。修正後の製品成功や新予算の許可を先取りしない。
