# 独立増分曲線の静止比較

[English](en/increment-curve-comparison.md)

`createIncrementCurveComparison({bundles})` は2〜4件の専用 `{spec,steps}` bundleから、検証済みの比較表・CSV・JSON・静止SVGを作るpure service。戻り値は `{comparison,csv,json,svg}` で、後ろ3項目は文字列。通常のStudio projectや自己申告のcurve表・画像は入力にならない。

全bundleを最初のawaitより前に厳密なJSON snapshotにし、それぞれ[単曲線service](increment-curve-export.md)で再検証する。同じcurveIdは拒否する。異なる材料・形状・標点・軸は比較目的で許可し、各curveのcase/row identity、初期断面積・標点長・軸、input/mesh/calculation/result revisionをそのまま保持する。比較可能な物理試験であると自動認定する機能ではない。

SVGは縦2段。上は標点伸びmm対反力由来の引張力N、下はengineering strain（無次元）対engineering stress（Pa）。各パネル内で全curveが共通の軸尺度を使い、同じ色・線種・番号付き凡例で同定する。engineering値は各検証済みcurveの既存fieldだけを使い、真応力や塑性ひずみは生成しない。完全なIDはtitleとmetadataに保持し、長い表示名が同じ省略形でも番号で区別する。

曲線間を線で連結せず、失敗stepは各curve内でも線を切る。失敗値はnull/CSV空欄、暫定点は白抜きで残す。0点しか成功していないcurveも消さず保持する。CSVは単曲線と同じ単位付きheaderを1回だけ出力し、curveId・状態・revisionを持つ全curveの行を続ける。JSONは `schemaVersion:1`、`kind:increment-curve-comparison`、`curves` 配列の検証済み表であり、再入力用bundleではない。

入力の合計はwrapper込みUTF-8 JSON2MiB、各bundleは既存の1MiB・128step制限、出力は各2MiBまで。余分なwrapperキー、accessor、sparse/decorated配列、不正XML文字、非有限数などを拒否する。SVGラベルのescapeとCSV式注入対策は単曲線と同様。入力やブラウザ、ファイルは変更しない。

試験は実solver由来の10×10×40mm barと、異なる材料・形状を個別に実solveしたTet参照を組み合わせる。単曲線との全数値・CSV・JSON一致、両パネルのfield/単位・共通尺度、失敗点とcurve境界、4件比較、全snapshotの不変性、サイズ展開、式・XML対策を確認する。全成果の `independent-linear-solves` / `plasticHistory:false` は独立線形計算の比較範囲を示し、RESULTCURVE1全体や塑性載荷・除荷履歴の完成を意味しない。
