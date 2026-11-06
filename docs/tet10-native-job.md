[English](en/tet10-native-job.md)

# Tet10 saved-file job（2026-11-07）

`elementOrder: 2` は限定した静的等方構造解析を保存ファイルjobで実行する明示選択です。`pcg-strict`、`adaptive: false`、重力なし、単一直方体、面全体の固定と合計力だけに対応します。worker-thread と process isolation の両方を対象とします。未指定または1の既存Tet4経路・startup digestは維持し、2だけ次数をdigestへ含めます。

結果kindは `elastic-tet10`、表現は `straight-affine-Tet10-native-v1` です。raw成果物には全節点変位、10節点要素、6節点境界面、各要素4積分点の応力・体積・von Mises値を保持します。座標/変位はmm、力N、応力Pa、体積mm³です。反力は算出しません。一定面荷重の整合節点力は角節点0、辺中点に配分します。品質指標は元の角Tet4に由来し曲面精度保証ではありません。

上限は元512要素、変換後4096節点、PCG20000反復・相対許容値1e-10です。観測meshは生成時の元Tet4で、Tet10解の中間場ではありません。最終meshはnative Tet10のみです。`nativeResultRevision` はjob envelopeとそのrevision欄を加える前の物理成果物全体の既存canonical hashです。最終JSON bytesのSHAは既存出版契約を使います。成果物はprovisionalです。

通常case登録、view、point、compareは `TET10_NATIVE_RESULT_UNSUPPORTED` で拒否します。Tet4として読み替えません。P5B/98の設計比較、任意CAD・非直方体・変位制御・熱/重力/異方性・非線形/モード・適応化は未対応であり親タスク完了を主張しません。

回帰は10mm立方体、E=1GPa、ν=0、100Nで全節点u_z=0.001z、全積分点σzz=1MPaを独立閉式と照合し、thread/process実job、native hash再導出、入力不変、次数衝突、表示拒否を確認します。詳細は [証拠](evidence/2026-11-07-tet10-native-job/report.json)。GUI/ブラウザーpairや大規模12案の再計算は実施しません。

ここでnativeは完全なTet10保存表現を指し、machine-code backendではありません。計算は既存のJavaScript CPU数値moduleです。
