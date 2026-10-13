# 過渡音響 / Transient acoustics

[English](en/transient-acoustics.md)

「音の伝播サンプル」で均一媒質中の音圧を時間積分します。受音点の音圧波形、時間スライダーによる3D音圧表示、ピーク正規化したWAVを生成します。記録時間を引き伸ばさないため、4 msの参照例は短い音です。Paで示す物理音圧と、再生音量を区別してください。

## 計算モデル

SI単位の弱形式は `M p¨ + D p˙ + K p = 0`。Tet4の集中質量は各節点に `V/(4ρc²)`、剛性は `V/ρ ∇Ni·∇Nj`。未指定の壁は剛壁です。実数の一定インピーダンスZには面積の集中積分 `A/(3Z)` を減衰行列に加えます。球形外部領域では `∂p/∂n = -p/R - p˙/c` の1次球面放射条件を使い、面の剛性・減衰も集中積分します。一般場に対する有限境界の誤差は残ります。

時間積分は中心差分、減衰項は時刻nを挟む中心差分です。`M⁻¹K` の行ごとの絶対値和から固有値の上限を求め、`Δt ≤ 0.9 × 2/√上限` を課します。自動刻みは記録終了時刻に合うよう小さく調整。上限を超えるユーザー指定は拒否します。集中質量による分散誤差があるので、安定性は精度の保証ではありません。

圧力境界は指定値を振幅とする `cos(2πf(t−6σ)) exp(−(t−6σ)²/(2σ²))`。時刻0以前と12σ以降は0。初期圧力・速度はUIでは0です。帯域検査には `f + 3/(2πσ)` を使い、その波長の1/6以内に全四面体の辺を収めます。3σの帯域目安は厳密な帯域限界ではありません。

受音点は四面体内で補間し、各ステップを記録。RMSは記録全体の台形積分で計算し、瞬時音圧からSPLへ変換しません。最大約61フレームを保存します。WAVは窓付きsincで低域通過して44.1 kHzに再標本化、ピーク正規化したmono PCM16。媒体の異なる周波数応答やスピーカーの校正は含みません。

## 入力・限界

共通APIの `study.kind: 'acoustic'` に `acousticTransient: true`、`acousticDuration`（秒）、`pulseWidth`（秒）、`acousticTimeStep`（秒、0で自動）、`dampingRate`（1/s）、`frequency`、`soundSpeed`、`airDensity`、`receiverPoint`（mm）を設定。結果種別は `acousticTransient`。ケース集から波形と3Dフレームを復元できます。

周波数領域の `lossFactor` は0にし、周波数スイープと遠方界を無効にします。体積減衰は別の `2 × dampingRate × M` です。周波数依存・複素インピーダンス、振動連成、非均一媒質、PML、GPU、MFEM、適応細分化は未対応。3,000節点、10,000四面体、60,000ステップ、節点数×ステップ数60,000,000まで。途中キャンセルは共通Worker終了を使います。

## 検証

空洞の解析固有振動 `c/(2L)` とメッシュ収束、整合インピーダンス出口での `距離/c` の伝播時間・振幅、球音源の `a/r` と外部放射、入力振幅に対する線形性、JS/WASM一致、不安定刻みの拒否、保存結果の破損拒否、WAVの時間・周波数・無音・高周波除去を自動検査。詳細は `tests/acoustic-transient.test.mjs`、`tests/acoustic-audio.test.mjs`、`tests/worker-pipeline.test.mjs`。

中心差分と集中質量の背景: [Noh & Bathe, Computers & Structures 129 (2013)](https://web.mit.edu/kjb/Desktop/kjb/OldFiles/www/Principal_Publications/An_explicit_time_integration_scheme_for_the_analysis_of_wave_propagations.pdf)。本実装は一般の中心差分で、この論文が提案する新しい積分法を移植したものではありません。
