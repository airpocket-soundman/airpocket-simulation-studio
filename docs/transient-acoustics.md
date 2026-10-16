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

## 時間履歴の滑らかな表示（設計メモ・VIEWTIME 第1段階）

計算刻み（ソルバーのステップ）、保存刻み（保存フレーム、最大約61）、表示補間（保存フレーム間の線形補間）は別物です。`src/time-interpolation.js` は純粋関数として、保存時刻の厳密な区間検索、2フレーム間の線形補間、物理時刻で一様な再生時刻列、全フレームで固定した色範囲を提供します。保存時刻は狭義単調増加が必須で、保存範囲外への外挿はエラーです。保存時刻ちょうどでは元の値のコピーを返し `interpolated:false` になります。補間値は表示専用で、物理配列や保存結果は変更しません。テストは `tests/time-interpolation.test.mjs`。

実装済み: 音圧スライダー（`#acoustic-time-fine`）と再生（`#acoustic-time-play`）の補間表示（[結果断面](result-sections.md)）。未実装（後続）: `setResultView` の保存時刻以外の時刻指定、固定フレーム出力での補間時刻（現在は保存フレームのみ）、熱の保存フレームを表示する時間スライダー（保存自体は下記の通り実装済み）、音響側のメモリ上限。補間表示は必ず「補間」と明記します。関連: [結果断面](result-sections.md)、[画像・動画出力](visual-export.md)。

## 過渡熱の保存節点温度（VIEWTIME・ソルバー側のみ）

`solveThermal`（`src/thermal-core.js`）の過渡解は、従来のスカラー`history`に加えて節点温度の保存フレーム`snapshots`（`{step,time,temperature}`、初期状態をstep 0として含む）と`snapshotInfo`（要求数、実保存数、保存ステップ番号、バイト数、予算、`warnings`）を返します。これは任意設定（オプトイン）で、`thermalSnapshotCount`を指定しない場合は結果・出力ハッシュ・メモリ・アーカイブ容量は従来と完全に同じです。指定すると新フィールドが加わるため`resultRevision`・出力ハッシュが変わり、保存ケースとアーカイブはフレーム数×節点数×8バイト分だけ大きくなります。既存の結果フィールドと`history`は変わりません。保存数はstudyの任意項目`thermalSnapshotCount`（整数2〜61、未指定=保存しない、上限61）で指定し、初期状態と最終ステップを含む等間隔のステップを選びます。存在する状態数（steps+1）より多い要求、またはメモリ予算（既定64 MiB、フレーム数×節点数×8バイト）を超える場合は黙って切り詰めず、保存数を減らして`snapshotInfo.warnings`に理由を記録します。2フレームも入らない場合と、範囲外の`thermalSnapshotCount`は例外で拒否します。定常解には付きません。表示時刻の補間には`src/time-interpolation.js`をそのまま使えます。未実装: 熱結果のビューア時間スライダー、`setResultView`/ケース比較/固定フレーム出力での熱フレーム。テストは`tests/thermal-snapshots.test.mjs`。関連: [過渡音響の表示設計](#時間履歴の滑らかな表示設計メモviewtime-第1段階)、[結果断面](result-sections.md)。
