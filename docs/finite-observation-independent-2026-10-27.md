# 最終合成観測比較UIの独立監査

[English](en/finite-observation-independent-2026-10-27.md)

対象は5906bd04。必須指摘なし。独立4回帰と関連35検査が成功しました。[機械記録](evidence/2026-10-27-finite-observation-independent.json)。

trace-free Green strainのrampと半緩和holdを閉形式で計算し、合成観測へ宣言した9成分差を加えました。非対称の符号付き差行列で転置・絶対値化を区別し、自由エネルギー差+2と散逸差−1を別々に検査しました。観測値自体は非負で、負の差は負の散逸という意味ではありません。

Compare→Inspect→Compareの旧callbackが新しい所有workerを失効させないこと、messageerror後のtimer解放と遅延返答拒否、Unicode説明の240codepoint省略とplain text表示を確認しました。実Node moduleworkerで未知action拒否後のcompare/replay契約も検査しfinallyで終了しました。再計算・参照・比較domainとlockfileのGit bytesは基点c2ae100と同一です。

GUI・solver・exportは追加実行していません。合成参照と宣言差の検査であり、実測精度・物性同定・校正・構造解析の受入を意味しません。
