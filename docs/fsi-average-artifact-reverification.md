# 保存FSI平均力成果物の再計算照合

[English](en/fsi-average-artifact-reverification.md)

`node scripts/verify-fsi-average.mjs --request <絶対JSON> [--output <新規絶対report.json>]` は [保存worker成果物](fsi-average-file-cli.md) をraw SHAで固定し、同じ明示初期設定を所有Node workerで1回再計算して照合します。元artifact/入力には書き込みません。校正・真正性・物理精度・一般の平衡やFSI成立を保証する入口ではありません。

要求は `schemaVersion:1,artifact:{path,expectedSHA256},tolerances:{relative,absolute:{displacementM,velocityMPerS,arealEnergyJPerM2,tractionPa,tractionImpulsePaS,arealMomentumKgPerMS,dimensionless}}` を全て明示します。relativeは有限の0..1e-6、この上限は同一method再計算サービスの適用境界であり精度保証値ではありません。7つのabsolute値は各単位の有限非負値です。既定許容差はなく、全0の完全数値一致も指定できます。各数値を `|saved-recomputed| <= absolute[quantity]+relative*max(|saved|,|recomputed|)` で比べます。PaとJ/m²などを同じabsolute値へ暗黙に混ぜません。差・閾値・診断が非有限になる場合は拒否し、Infinityをnullへ変換した成功reportは作りません。

要求64KiB、元artifact4MiB、report64KiBの有界strict UTF-8/JSON境界です。復号後重複キー、未知field、非有限値、過深・過多構造、欠損/不正profile/historyを拒否します。通常ファイル・リンクなし・FD前後版一致は既存の読取方針を維持します。元artifactのexpected raw SHAを確認後、methodVersion1、synthetic/calibrated、終了確認、source形、canonical設定hash、正規化設定、全時刻とwork上限を検査します。solverを進めない共通admissionで初期設定と2000000 cell-step上限を再導出してからworkerを起動します。

全history/profile/初期energy/最大x spreadと、最終historyから導いたsummaryを照合します。設定・版・metadata・時刻・整数workは完全一致で補間しません。reportは単位別の件数/最大絶対差/最大閾値と最初の最大8個の不一致pointerを返します。`matched` は指定許容差内という意味だけです。許容差内の差があれば `exactNumericMatch:false` を残します。数値不一致は `mismatch`・終了2で任意の診断reportを保存できます。構造/hash/計算/取消/timeout拒否は終了1で完成reportを保存しません。matchは終了0です。

旧methodVersion1 artifactには元raw要求本文とNode/V8/runtime identityがありません。従って `originalSourceRecomputed:false,originalRuntime:'not-recorded'` を必ず記録します。source bytes/SHAは形の検査とexpected artifact SHAによる固定までで、元要求の再導出や署名検証ではありません。現在のNode/V8/platform/archを別に記録し、異なる実行環境の一致を勝手に保証しません。

実行は既存のimmutable文字列→strict private設定→owned worker境界を共用し、exit0とprivate stdout/stderr終了を待ちます。取消/timeoutではterminateと実exitの両方を待ち、意図しないworker出力は転送せず拒否します。timeoutはworker実行に対して最大120s、OSファイルI/O全体の期限ではありません。任意reportはexclusive atomic出版で、publication metadataとcleanupcodeの余白を含む返却全体も保存前に64KiBを検査します。保存開始以後の取消は完成reportを取り消しません。

回帰は実CLI旧artifact照合、単位別許容差内外、raw/hash/config/time/work改変の起動前拒否、非有限比較拒否、最大4097history、4MiB/64KiB境界、FD変更、worker取消、同時report出版、既存保存CLIのgolden bytes完全互換です。元の合成・接線・線形laminarという [物理限界](fsi-channel-average-force.md) は変わりません。

[2026-11-07実行証拠](evidence/2026-11-07-fsi-average-reverification.json)

## 正式MCP

`studio_reverify_fsi_average({request,output?})` は同じ保存再計算サービスを呼びます。任意outputは新規reportへの排他的保存であり非冪等です。matchedは明示許容差内の数値一致だけです。既存browser入力・権限は変更しません。
