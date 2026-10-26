# 平面P1温度のL2投影

[English](en/planar-temperature-operator.md) · [熱流束P1演算子](planar-p1-heat-operator.md)

`planar-temperature-operator.js`は、完全被覆の平面境界間で節点温度をconsistent L2投影する限定pure APIである。`solverConnected:false`を維持し、GUI、熱接触、反復連成、実測/校正へ接続しない。

既存P1演算子の `T_ji=∫N_Bj N_Ai dA` と同じ幾何検証を再利用し、target consistent mass `M_B,jk=∫N_Bj N_Bk dA`を三角形ごとに `A/12 [[2,1,1],[1,2,1],[1,1,2]]` から組み立てる。mm²からm²へ1e-6を掛け、両行列を被覆面積で正規化する。Choleskyで `R=M_B^-1 T` を求め、適用時 `θ_B=R θ_A` と行列残差を確認する。温度はscalarなので逆向き法線でも符号反転しない。旧flux API、4096節点/512面、完全被覆/対向法線/同側重複拒否は変更しない。

新APIだけsource/target各active128節点、dense係数16384、1MiB JSON、graph200000値/depth20とする。κ∞(M_B)は逆行列の三角解法から計算し1e10超を拒否する。非正定値/非有限/overflowは拒否し、対角正則化やfallbackは行わない。build係数残差は正規化行列上1e-12×max(1,|Tij|)、適用残差は1e-10×max(1,|θ|)、面積積分差は同尺度×被覆面積を上限とする。

fieldは `{units:'degC'|'K',values:[{nodeId,value}]}`。source active全節点へ一つずつ、単位はfield全体で一つ、行単位混在/暗黙変換/重複/未所属を拒否する。絶対零度未満の入力を拒否し、演算余裕として温度絶対値を `Number.MAX_VALUE/(128*1e10)` 以下に制限する。L2はsource最小最大やpositivityを保証しない。投影後の絶対零度は1e-10の丸め誤差だけ許容し、小さい負Kを物理的に正しいと扱わずclampしない。それ以上の逸脱は拒否する。

返すsource/target integralの単位はdegC*m2またはK*m2。これは**面積×温度の積分保存**であり、熱容量/密度/体積/時間を含むエネルギー保存ではない。定数保存、global affine再現、C→Kの定数offset整合を検証する。非一致meshの往復投影は一般に逆演算ではない。

build/apply/loadは最初のawait前にplainrecord/dense arrayを複製し、accessorを実行しない。operatorはprivate WeakSet発行済みだけ適用/保存できる。loadはgeometryからT/M/Cholesky/R/版を全再導出し、受領record全体をcanonical比較する。係数を改変しhashを再計算しても拒否する。rawIdentityは入力JSON文字列UTF8のSHAで認証ではない。

[証拠](evidence/2026-10-26-planar-temperature-operator.json)。独立固定式はcrossing-diagonal corner hat→[0,.25,1,.25]、center fan hat→[.5,0,.5,0]を使う。後者はpoint interpolationの全0やlumped [.375,.25,.375,.25]と異なる。solver、GUI、codec、SDKは起動していない。COUPLE3全体完了や製品精度の主張はしない。

PR199の対象head5b2fd229のCIは2188件中2180成功/失敗0/skip8、local28項目成功。[対象CI証拠](evidence/2026-10-26-pr199-ci/summary.json)は公開配布やCOUPLE3全体完了を意味しない。

[明示複数平面グループ](grouped-temperature-operator.md)は、共有global nodeのM/Tを組み立てる別APIとして追加され、単一平面APIを変更しない。
