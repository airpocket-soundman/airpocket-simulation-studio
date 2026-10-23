# 固定frame WebMの独立容器監査（2026-10-24）

[English](en/fixed-webm-independent-audit-2026-10-24.md)

owner最終commit `56f7a25f6ff9b08e24fc6183552a4c5703717c2e` を基点に、production数値/EBML helperを再利用しない独立回帰3件と外部ffmpeg/ffprobeの証拠を追加した。[集約JSON](evidence/2026-10-24-fixed-webm-independent-audit.json)にraw bytes/SHAを保持する。実browser exportは0、solverは0。root担当の実画面検証を先取りしない。

既存ffmpeg libvpxで16×16・24fps・全keyframeを生成し、前半12枚をred、後半12枚をblueとした。IVFの独立読み取りからpayloadを取り出し、対象muxで[1888bytesのWebM](evidence/fixed-webm-independent-20261024/red-blue-own-mux.webm)を生成。外部ffprobeは24packet・全key・PTS=round(i×1,000,000/24)μs・全体1.000000秒を確認。外部ffmpegは24画像へdecodeし、最初と最後のMD5が異なり最終blueを保持した。これは容器/codecの限定参照であり、物理解析・実browser再生の証明ではない。

`tests/fixed-webm-independent.test.mjs` は全15秒設定のBigInt有理丸め、両物理phase端、presentation総時間を検算する。外部生成IVFのkeyframe header/寸法/payload保持と既知容器SHAを照合し、全1888prefix切断を拒否。独立EBML walkによるunknown size・NaN Duration・TimestampScale・track・relative time・lacing・zero幅の改ざんも拒否した。

## 発見と修正確認

修正前は、SharedArrayBuffer上の通常Uint8Arrayへown `buffer` をordinary ArrayBufferに偽装するとdemuxが24packetを受理した。ownerはTypedArray intrinsic buffer/byteLength getter、ArrayBuffer実brand検査、intrinsic copyへ変更。修正後は偽SABを拒否し、own buffer/byteLength accessor実行0を確認した。修正前の全source hashは取得していないため捏造せず、反例と脆弱fragmentを記録する。own iteratorは実際には未実行で、その欠陥は主張しない。

修正後監査時のowner working CRLF SHAは `0e6ef2640315477a81a03915924d8e5b620a883de095de2b5d9ef961f90d952b`。CRLF→LFだけを正規化したSHAと最終Git blob SHAは `6e44da80bdc5c8387601868c2233e5c623df95641bf9a8a635acdcf7488b6119` で一致した。対象sourceは変更していない。

## 仕様と限界

[EBML RFC8794](https://www.rfc-editor.org/rfc/rfc8794.html)、[Matroska RFC9559](https://www.rfc-editor.org/rfc/rfc9559.html)、[WebM profile](https://www.webmproject.org/docs/container/)、[W3C WebCodecs draft](https://www.w3.org/TR/2026/WD-webcodecs-20261019/)を一次参照とした。VINT/finite親子境界、timestamp単位、key/lacing flagsとcodec検証の責務を区別した。

DefaultDurationは最初のframeのnominal値。量子化PTSの隣接差41666/41667μsとSegment全体durationを区別し、外部packet durationが41667μsでも各frameの実間隔を完全に示すとは呼ばない。pure demuxはこのproducerの限定容器profileを検査し、VP8 payload実有効性とdecoded寸法/時刻集合は全体decoder境界で検証する。一般WebM parser・実時間の滑らかな24fps・旧MediaRecorder partialの解消は主張しない。

再生成コマンドは `ffmpeg -f lavfi -i color=red:size=16x16:rate=24:duration=1 -vf "drawbox=x=0:y=0:w=iw:h=ih:color=blue:t=fill:enable='gte(n,12)'" -frames:v 24 -pix_fmt yuv420p -c:v libvpx -g 1 -deadline good -an -f ivf output.ivf`。追加ソフトは導入していない。進捗と親受入は変更していない。
