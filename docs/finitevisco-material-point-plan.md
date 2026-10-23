# FINITEVISCO1 材料点参照モデルの実装準備案

[English](en/finitevisco-material-point-plan.md)

状態は **設計案・未実装**。校正なしの `synthetic:true / provisional:true / calibrated:false` 材料点参照に限定する。FINITEVISCO1の製品受入、実験適合、構造要素、くびれ、塑性、損傷の実証ではない。P1/P3/MOD1/RESULTCURVE1が未完のためsolver/UI/API/MCP/保存projectへ接続しない。実装開始はrootレビュー後の別候補とする。

## 現行コードと一次資料

現行 `src/plasticity-core.js:j2Return` はengineering shearの微小ひずみJ2、塑性状態と硬化/散逸を持つが物理時間dtを持たない。構造経路は主ひずみ絶対値0.02上限で、rate/thermal/hyperelasticとの組合せを拒否する。`src/hyperelastic-core.js:neoHookean` はF/J/P/Cauchyを扱うが内部粘性状態がない。loadStepsは物理時間ではない。既存2モデルを足したり、そのJ2状態を有限ひずみ内部状態へ読み替えたりしない。

[Liu/Zhao/Guan, arXiv:2501.11947v1 (2025-01-21)](https://arxiv.org/html/2501.11947v1) の§2/4は、一般化ひずみと二次の構成自由エネルギーから線形内部状態進展を構成する一次研究で、Green–Lagrange等の非coercive性も論じる。[FrontISTR公式理論](https://source-docs.frontistr.com/en/theory/constitutive/04_viscoelastic.html)はMaxwellの緩和ODEとProny指数を説明するが、微小ひずみ式をそのまま有限変形へ流用する根拠にはしない。[COMSOL公式理論](https://doc.comsol.com/6.4/doc/com.comsol.help.sme/sme_ug_theory.06.011.html)は有限変形の乗法分解と順序を区別する。[FEBio公式資料](https://febiosoftware.github.io/febio-docs/features/features/solid_material_viscoelastic/)の応力畳込み実装は別モデルの例であり、本案と同一ではない。外部CAEは実行/取得しない。

以下はこれらを参考に**本プロジェクト用に明示設計する限定reference**。論文式の完全再現、Simo/PRF/FEBio互換や一般有限粘弾塑性を主張しない。特に本案の`dev(E)`は`E(J^(-2/3)C)`と同一ではなく、厳密な等容/体積分離ではない。

## 提案する最小構成則

有限3×3のF、J=detF>0、C=FᵀF、E=(C−I)/2、H=dev(E)、対称trace-free内部状態Zを参照配置で保持する。3×3テンソルを使い、engineering shearのVoigt係数の混入を避ける。F/E/H/Zは無次元。

```text
ψ(F,Z) = K/2 (tr E)^2 + μ∞ H:H + μ1 (H−Z):(H−Z)   [J/m³ initial volume]
Zdot = (H−Z)/τ                                        [1/s]
S = K tr(E) I + 2 μ∞ H + 2 μ1 (H−Z)                  [Pa, second Piola]
P = F S                                              [Pa, first Piola]
σ = F S Fᵀ/J                                         [Pa, Cauchy]
D = 2 μ1/τ (H−Z):(H−Z) >= 0                          [W/m³ initial volume]
P:Fdot = S:Edot = ψdot + D
```

K,μ∞,μ1はPaで正、τはsで正。η=μ1τをPa·sとする（進展式には2μ1が含まれるため係数規約を固定）。最初は1branchのみ。Zは粘性memoryであり、塑性ひずみや幾何学的な有限弾性ひずみと呼ばない。μ∞>0なので応力自由で十分長時間待てば回復するモデルで、永久残留塑性を表さない。所定FをIへ戻しても一時的な応力は残り得るが、それを塑性残留と呼ばない。

客観性: 任意のproper spatial rotation Q(t)でF*=QFとするとC/E/Z/ψ/Dは不変、P*=QP、σ*=QσQᵀ。時間依存Qの下でも純回転は仕事を生まない。参照基底変更RではF*=FRᵀ、Z*=RZRᵀを同時変換する。stateだけ回転し忘れるケースは拒否/検証対象とする。

## 明示的な実装範囲と拒否

初期の合成fixtureはK=2e6Pa、μ∞=1e6Pa、μ1=0.5e6Pa、τ=2s。実材料の値として採用しない。暫定数値envelopeは各主伸長0.95〜1.05（端を含む）、Jは0.85〜1.16、2/3≤K/μ∞≤3、0<μ1/μ∞≤1。これらは**未校正referenceの仕事量/数値範囲方針で、物理的適用範囲や安定性の保証ではない**。圧縮限界をこの下限まで検証済みとも呼ばない。

- Fの要素は有限、Cの固有値は正、反転/特異/非有限Jを拒否。負detの反射をrotation扱いしない。安定な対称固有値計算で主伸長を検査し、単なる対角要素検査で代用しない。端の両側と重複固有値を検証する。
- 全パラメータ、dt、時間、ψ/S/P/σ/D/状態を有限検査。dt>0で時間は厳密増加。0dtのjumpを黙って時間stepにしない。瞬時step解析解は指定状態の静的evaluate用oracleだけに使う。
- stateはschema/model/parameter revision、時刻、直前F/E、Z、累積Dを持つ。Z対称/trace-free、由来版、有限範囲を検査。任意の巨大Z・別材料state・時刻不整合・古版・異単位は拒否。初期stateはstress-free F=I,Z=0だけ、再開は検証済みchainだけ。各段階はcopy-on-writeで、拒否/失敗時は最後のcommitと入力を不変にする。
- 初回は最大4096段階、総入出力1MiB、全値/深さ/保持量に既存boundedパターンを使う。上限は実装時回帰で固定し、途中失敗から完成historyを捏造しない。表・raw stateのhash/パラメータ版・単位・履歴連鎖を保存し、project schemaは拡張しない。
- K/μや時間比のoverflow/underflowを安全に扱えない場合はコード付き拒否。小xにはexpm1/級数、大xでは指数の飽和を使い、全て0へ丸めて成功させない。負散逸をclampで隠さず、独立oracleと整合しない段階は未収束としてstateをcommitしない。

## StVK型の圧縮・安定性制約

Green–Lagrangeの二次平衡energyはStVK型であり、有限Fでの客観性やD≥0だけではrank-one convexity/強楕円性、圧縮下安定性を保証しない。J→0でenergyが無限大になる障壁もない。反転拒否だけで十分とはしない。

独立の1D反例: ψ=E_mod(λ²−1)²/8ならdP/dλ=E_mod(3λ²−1)/2でλ<1/√3に負。これは**1D反例で、3D圧縮の普遍的許容下限ではない**。3D平衡状態F=λI,Z=0では横rank-one変動の係数はμ_inst λ²+(3K/2)(λ²−1)、μ_inst=μ∞+μ1。長期relaxed tangentの対応にはμ∞を使う。例えば本fixtureの平衡shear条件はλ>√(3/4)だが、これも一様圧縮の一モードのみで一般履歴の証明ではない。初期envelopeの外側は実行前拒否し、内側でも全構造安定性を主張しない。将来広げる際はcoercive energy・選択した有限粘性理論・acoustic tensorとmesh/time依存の独立検証を先行する。

## 時間更新の定義と独立oracle

F端点間を線形補間するのではなく、**E(t)が各区間で線形**の履歴と明記する。C(t)=I+2E(t)のSPDと、区間内の主伸長/J envelopeも確認する。端点のみのdet検査では済ませない。回転はproper Qとして別に扱い、stress/energyに架空のspin散逸を追加しない。

Δt、v=(H1−H0)/Δt、r0=H0−Z0、a=τv、b=r0−aとおけばr(t)=a+b exp(−t/τ)、Z1=H1−r(Δt)。この正確更新を予定する。累積散逸の区間積分は

```text
ΔD = (2μ1/τ)[ (a:a)Δt + 2(a:b)τ(1−e^(−x))
                              + (b:b)(τ/2)(1−e^(−2x)) ], x=Δt/τ.
```

小xの相殺に対する安定評価を別途設計し、式をそのまま倍精度に写して負値を0へclampしない。独立Gauss積分/高精度oracleで検証する。仕事は`Δψ+ΔD`と定義して同じ等式だけを試すのではなく、独立にS:Edotを積分して比較する。

1. 保持: E12=E21=0.005、他0、Z0=0。C主伸長は0.9949874371,1,1.0049875621、J=0.99994999875。S12初期15000Pa、2sで11839.39720585721Pa、長期10000Pa。初期branch energy25J/m³、2s散逸21.616617919084682J/m³。これは**将来試験の解析期待値**で実装実測ではない。
2. 1s線形E ramp: 同じ端点へ到達したS12=13934.693402873665Pa。保持・除荷・再載荷の区間ごとにexp畳込みを別実装で接続する。降伏点/永久塑性を発明しない。
3. 応力自由回復の純dev scalar参照: e=μ1 z/(μ∞+μ1)、z(t)=z0 exp[−t μ∞/(τ(μ∞+μ1))]。回復時定数はτと異なる。これはcoaxial reduced-material oracleであり、3D traction-free試験片の変形や断面を解いた証拠ではない。
4. 仕事/散逸: 保持で仕事0、Δψ=−ΔD、全historyでD非減少。zero/符号反転/往復/非共軸連続履歴と大回転90°/180°、Q(t)重畳、参照基底変更を含める。S:Edot/P:Fdot一致とCauchy変換を独立に確認。ゼロ分母の相対誤差を成功にしない。
5. 時間刻み: 同じ線形E pathを1/2/4/8等分してendpoint state/energy/散逸が丸め誤差内で一致。滑らかな非線形F(t)はΔt/2/4でE線形近似の解収束を測り、同じ補間を維持する。初期許容案はstress `1e-6Pa+1e-10*scale`、energy `1e-10J/m³+1e-10*scale`、state `1e-12+1e-10*scale`、全て実装時に桁/長履歴を検証し根拠なく緩和しない。
6. 失敗/保存: 版違い/改ざん/過大/非有限/0dt/同時刻/反転/上限外/巨大state、入力不変・中断resumeと通し実行同値・履歴hash不整合を検証。有限更新でも拒否された試行でstateを変えない。

実装後の受入はこの限定材料点の式/客観性/時間/energy/保存契約に限る。一般有限粘塑性、FDM異方性、温度・WLF、有限塑性乗法分解、損傷、necking、荷重低下、mesh要素、構造反力/変形後断面、実験精度、校正、製品結果schema、LLM履歴連携はまだ実装しない。材料点計画の成功でFINITEVISCO1や依存親を昇格しない。
