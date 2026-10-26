# 保存温度フレームのWebM

[English](en/single-view-thermal-fixed-webm.md)

非定常熱の保存温度フレームを、結果表示の「画像・アニメーションを保存」→「保存時刻（音響・温度）」→「WebM動画で保存」から出力する。先に表示量を温度にする。熱流束を選んだ場合は拒否し、温度へ自動変更しない。熱の「再生」プレビューは従来どおり未対応。回転・変形・断面の録画は変更しない。

`singleThermalTimeWebmExport` が独立能力を示す。旧`singleTimeWebmExport`とAcoustic名APIは音響専用のまま。既存`startExport`のtime/WebM経路も利用し、method・scopeは増やさない。熱proofはkind=`thermal`、field=`temperature`、unit=`degC`、result revision、動画bytes SHAへprivateに結合し、音響getter/manifestへ流用できない。

`framesOf`と同じ保存shape、すなわち`result.kind='thermal'`、`transient=true`、`snapshots[{time,temperature}]`のみを扱う。温度はmesh node数と一致する有限値配列で、全frameを検査する。既存保存予算の最大61frame・64MiB（node×frame×8bytes）を再利用し、温度配列を追加コピーしない。温度履歴の再計算、熱流束の推測、補間はしない。

動画は1～15秒、N=min(seconds×24,120)、固定カメラ、phase=i/(N−1)。最初と最後を含む物理時刻に最寄りの保存frameを選び、requested/actual/signed offsetを記録する。VP8全keyframe、strict WebM検査と全timestampの復号確認、原Blob bytes SHA結合を保つ。captureは1280×640以下、動画32MiB以下。非対応codecや不完全な終端は拒否し、実時間録画へfallbackしない。

取消・結果交代・途中の表示量変更はartifactを出さず、カメラ・操作lock・保存前の補間表示時刻をfinallyで復元する。fake codec/UI回帰は日英のSave実配線、first/last、field拒否、proof隔離・改ざん、復元・取消・既存音響互換を検証する。実ブラウザ・実codecの熱動画は未実行であり、既存音響動画の証拠を熱へ転用しない。solver/GUI/realcodec追加0。
