# 折面P1熱流転送の独立監査

[English](en/grouped-p1-heat-independent-audit.md) · [API契約](grouped-p1-heat-operator.md)

固定owner `ec46a7b439367ec250ccf1f47959686d084570b0` を読み取り監査した。追加4回帰だけを専用branchへ追加し、production sourceは変更していない。旧201の共通幾何抽出と保存goldenの互換を含む関連試験を実施した。[機械可読記録](evidence/2026-10-27-grouped-p1-heat-independent.json)。

独立例題は折れ目ABを共有する2つの単位正方形XY/XZ。sourceは各面の中心fan4三角形、targetは各面の対角線2三角形で、source/target節点IDを分離する。XYの中心hatをhとしてq=6h、XZはq=-2 W/m²を指定し、共有source節点でも値を平均しない。単位正方形で ∫Ntarget h=[1/8,1/24,1/8,1/24]、別面の定数積分重みは[1/3,1/6,1/3,1/6]。共有target節点へ加算した6節点荷重は[1/12,-1/12,3/4,1/4,-2/3,-1/3] microWで、総量0でも全ての局所情報は消えない。

独立なaffine試験関数θ=1+2x+3y+4zを使うとXY積分は7、XZは-8 microW·Kで、target節点荷重との内積は-1 microW·K。これは熱流の弱形式重み付き汎関数であり、物理的な仕事Jや連成solver/熱容量の実証ではない。積分係数のmm²→m²を1e-6で明示する。点補間や共有値平均ではこの非matching例を満たせない。

追加境界検査はsource/target双方の重複座標・別ID共有辺と非適合の中点T-junctionを拒否する。係数の2×2ブロックへ±δを加えて行/列和と定数・総熱流を保持し、局所と全体hashを再計算してもreloadは再導出で拒否する。q0=1,q1=3なら2節点へ±2δ Wの誤配分が出るため、総量保存だけでは十分でない。reload呼出後のcaller幾何変更が最初のawait前のsnapshotへ混ざらず、保持係数がfreezeされることも確認する。

solver/GUI/codec/実測/校正は追加実行0。親COUPLE3、連成solver、一般曲面、物理精度や公開成功は主張しない。production既存係数を独立数値oracleへ流用せず、幾何/shape関数の手計算値を使う。検証commandは `node --test tests/grouped-p1-heat-independent.test.mjs tests/grouped-p1-heat-operator.test.mjs tests/grouped-temperature-operator.test.mjs tests/grouped-temperature-operator-independent.test.mjs tests/grouped-temperature-boundary-audit.test.mjs tests/planar-p1-heat-operator.test.mjs tests/contracts-types.test.mjs tests/module-boundaries.test.mjs tests/docs.test.mjs`。
