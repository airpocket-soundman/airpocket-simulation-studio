# 保存温度フレームのWebM

[English](en/single-view-thermal-fixed-webm.md)

非定常熱の保存温度フレームを、結果表示の「画像・アニメーションを保存」→「保存時刻（音響・温度）」→「WebM動画で保存」から出力する。先に表示量を温度にする。熱流束を選んだ場合は拒否し、温度へ自動変更しない。熱の「再生」プレビューは従来どおり未対応。回転・変形・断面の録画は変更しない。

`singleThermalTimeWebmExport` が独立能力を示す。旧`singleTimeWebmExport`とAcoustic名APIは音響専用のまま。既存`startExport`のtime/WebM経路も利用し、method・scopeは増やさない。熱proofはkind=`thermal`、field=`temperature`、unit=`degC`、result revision、動画bytes SHAへprivateに結合し、音響getter/manifestへ流用できない。

`framesOf`と同じ保存shape、すなわち`result.kind='thermal'`、`transient=true`、`snapshots[{time,temperature}]`のみを扱う。温度はmesh node数と一致する有限値配列で、全frameを検査する。既存保存予算の最大61frame・64MiB（node×frame×8bytes）を再利用し、温度配列を追加コピーしない。温度履歴の再計算、熱流束の推測、補間はしない。

動画は1～15秒、N=min(seconds×24,120)、固定カメラ、phase=i/(N−1)。最初と最後を含む物理時刻に最寄りの保存frameを選び、requested/actual/signed offsetを記録する。VP8全keyframe、strict WebM検査と全timestampの復号確認、原Blob bytes SHA結合を保つ。captureは1280×640以下、動画32MiB以下。非対応codecや不完全な終端は拒否し、実時間録画へfallbackしない。

取消・結果交代・途中の表示量変更はartifactを出さず、カメラ・操作lock・保存前の補間表示時刻をfinallyで復元する。fake codec/UI回帰は日英のSave実配線、first/last、field拒否、proof隔離・改ざん、復元・取消・既存音響互換を検証する。初期source/fake検証時点では実ブラウザ・実codecの熱動画は未実行、同時点のsolver/GUI/realcodec追加0だった。以下の後続実証と区別し、既存音響動画の証拠を熱へ転用しない。

最終job境界でも、prepared field=`temperature`は熱proof、`instantPressure`は音響proofを要求し、それ以外は拒否する。Blob proofだけからmanifest種別を選ばない。同revisionでも両方向のproof取り違えを拒否するfake integration回帰を追加した。その初期source検証時点では関連113件成功・失敗/skip0だった。

公開encode APIは両方asyncを維持し、不正入力・null・undefinedも同期throwではなくPromise拒否を返す。valid入力のawait前snapshotは維持する。その後の互換回帰追加時点で関連114件成功だった。113/114は各source時点のfake回帰件数で、現在の全体件数や実熱exportの成功件数ではない。

後続の固定source `7fee9593ba37c5a933489daadbc1fe628b1b6ea9` では、[200b通常main/IAB・正式stdioの実証](evidence/2026-10-26-single-thermal-webm-main/README.md)を別の1export予算で完了した。英語・前景、既存熱履歴1case/94nodes/保存時刻0,5,10秒、追加solve0。796383bytes/SHA付き全13ページ、VP8全keyframe48枚、440×637、表示長さ2秒、最終物理10秒/offset0を照合した。独立ffprobe/ffmpeg各1回も48枚・全PTS・表示寸法・2秒と終端画像を確認した。

APIの5状態は所有export数0→1だけを分けて一致し、GUI/APIとも出力前の補間2秒へ復元した。settled release・所有job0・sessions空・GUI資格情報欄clear・child exit/close・PID不存在・token削除を確認。[集約記録](evidence/2026-10-26-single-thermal-webm-main/report.json)には、同sourceの関連fake185成功（独立3件を含む）・型25宣言・full build・local配布物28/28成功41906.5168msも限定記録した。これらは当該sourceの記録で、公開成功ではない。

[初回200の失敗](evidence/2026-10-26-thermal-time-webm-failed/README.md)と孤立native寸法診断、前段stale manifestによるlocal検査失敗は保持する。raw driver summaryの外部decode未実施という文はdecode前の歴史記録で、後取得した独立証拠と分ける。実証は英語foregroundの温度1case/2秒だけ。GUIのダウンロード完了、日英×hidden等の実取消行列、他engine、heatFlux時間動画、一般物理精度・校正、公開HTTPS、親タスク完了は未証明。

PR200最終head4027bdcdのCIは2222件中2214成功/失敗0/skip8、local28項目全成功（37.796秒）。[最終CI証拠](evidence/2026-10-27-pr200-final-ci/summary.json)は旧aa06失敗と1ed取消も区別して保持する。公開配布の証明ではない。
