# 段階データの静止グラフ

2〜4曲線を色分けし、荷重–標点伸び/工学SSを比較する操作は[複数曲線UI](increment-comparison-ui.md)を参照。

[English](en/increment-curve-ui.md) / [共通CSV/JSON/SVGサービス](increment-curve-export.md) / [結果ビューア仕様](result-viewer-direction.md) / [段階データ契約](../src/increment-curve-data.js)

結果・ケース欄の「段階データの静止グラフ」を開き、`spec` と `steps` だけを持つJSON bundleを貼り付けるか、JSONファイルを読み込んで「検証して静止グラフを表示」を押す。ファイル選択だけでは描画しない。現在のproject・ケース・解析結果を適用/変更する機能ではない。

最初は画面の「サンプルJSONを保存」を使い、保存したファイルを読み込む。[同梱サンプル](../public/examples/increment-curve-reference.json)は単一Tet4の実 `solveElastic` 結果を使う合成参照で、0/10N・失敗段階・20Nを含む。実測ではなく、一般的な棒の解析解や塑性履歴の保証でもない。生成元は `tests/fixtures/increment-ui-reference.mjs`。

共通の `createIncrementCurveArtifacts` が元の節点変位・支持反力・実入力/mesh/計算/resultから標点伸びと引張力を再計算し、同じCSV/JSON/SVGを生成する。自己申告の `curve`、SVG、CSVなどを加えたbundleや不正な単位/支持/標点/結果識別は拒否する。JSON出力は再計算済みの段階表であり、そのまま入力bundleとして再読込する形式ではない。明示した合成荷重列から再入力bundleを作る場合は[限定CLI](increment-curve-export.md#明示荷重列から再入力bundleを作る2026-10-23)を使い、この表JSONとは別に保存する。

静止図の横軸は標点伸びmm、縦軸は反力由来の引張力N。CSV/JSONは工学応力Paと工学ひずみ1も持つ。独立した線形弾性解の並びであり、塑性や粘弾性の載荷・除荷履歴ではない。失敗段階は空白として線を切り、画面にも件数を示す。最大変位や最大von Misesを標点/SSとして代用しない。

検証成功後にCSV・JSON・SVGの3つの保存リンクを出す。SVGは生成したBlobを画像として表示し、入力HTML/SVGをDOMへ挿入しない。入力の変更、ファイル再選択、検証失敗時には古い表示とダウンロードURLを破棄する。遅い読込/検証が後で終わっても新しい入力を上書きしない。

入力はUTF-8で最大1MiB。共通サービスの段階数・節点数・深さ等の上限も適用する。テキスト/ファイル欄にはlabelとエラー先を設定し、標準のdetails・button・リンクでキーボード操作できる。狭い幅では画像を縮小し、保存リンクを折り返す。日本語/英語切替は再計算や入力変更を行わない。

このUIはRESULTCURVE1の限定成果。保存projectや解析結果の選択からの段階自動生成、塑性の状態履歴、非線形ヒステリシス、実測校正や親タスク全体の受入を完了したとは扱わない。明示した合成荷重列からの限定CLI生成は別成果で、このUIへ暗黙適用しない。
