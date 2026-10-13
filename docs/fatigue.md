# 単軸比例荷重のS–N疲労評価

[English](en/fatigue.md)

線形弾性の単軸応力結果に最小・最大荷重倍率を掛け、一定振幅の比例載荷を評価する限定モデルです。材料のS–N試験データ、引張強さ、降伏応力、試験条件と出典が必要です。材料名や引張強さだけから疲労寿命を生成しません。データがない場合は寿命数値を表示しません。

`fatigueData`は次の形式です。以下は検証専用の架空データであり、実材料の設計値として使用しないでください。

```js
{
  model: 'stress-life',
  stressRatio: -1,
  snCurve: [
    {stressAmplitudePa: 200e6, cycles: 1e4},
    {stressAmplitudePa: 100e6, cycles: 1e6}
  ],
  ultimateStrengthPa: 600e6,
  yieldStressPa: 300e6,
  source: 'Synthetic verification fixture; not a material grade',
  testConditions: 'Synthetic fully reversed R=-1 stress-amplitude data; tensile-mean Goodman permitted for this reference only'
}
```

応力はPa、寿命はサイクル数です。基準曲線は完全両振り`stressRatio:-1`が必須です。曲線は2〜100点、応力振幅が厳密に減少し、サイクル数が厳密に増加する順で登録します。応力範囲は振幅の2倍なので混同しないでください。引張強さは正の降伏応力より大きく、試験条件・出典は空でない文字列が必須です。温度、表面状態、応力比、試験片形状、統計的扱いと平均応力補正の適用根拠を記録してください。

単軸の符号付き最大・最小応力から、振幅`σa=(σmax−σmin)/2`、平均`σm=(σmax+σmin)/2`を求めます。引張平均応力にだけGoodman補正`σa,eq=σa/(1−max(σm,0)/σu)`を使います。圧縮平均応力による寿命改善は加算しません。最大絶対応力が降伏応力を超える場合は弾性S–N評価を拒否します。

補正振幅とサイクル数の対数を使い、登録曲線の区間内だけで補間します。範囲外を外挿せず、低応力域を無限寿命と断定しません。指定した繰返し数nに対する使用率は`D=n/N`です。これは単一一定振幅のMiner評価で、荷重順序や亀裂成長を追跡しません。

多軸・非比例荷重、塑性疲労、変動振幅のrainflow計数、き裂進展、表面・寸法補正の自動推定、疲労寿命の保証は対象外です。応力特異点や粗いメッシュの最大応力だけで実部品の寿命を決めないでください。

原理の一次資料: [Altair公式の単軸S–N法・実験曲線と対数区間](https://www.help.altair.com/2021/hwsolvers/os/topics/solvers/os/analysis_fatigue_uniaxial_r.htm)、[COMSOL公式の平均応力補正](https://doc.comsol.com/6.3/doc/com.comsol.help.fatigue/fatigue_ug_sme.4.28.html)、[COMSOL公式の累積損傷](https://doc.comsol.com/6.4/doc/com.comsol.help.fatigue/fatigue_ug_sme.4.09.html)。これらの製品のソルバーを移植したものではありません。
