# 明示グループ付きP1熱流転送

[English](en/grouped-p1-heat-operator.md) · [折面温度L2](grouped-temperature-operator.md) · [単一平面P1熱流](planar-p1-heat-operator.md)

明示した平面グループを持つ折面で、P1熱流を節点熱流量へ転送する純粋APIです。入力は `{units:'W/m2',groups:[{groupId,values:[{nodeId,value}]}]}`。グループ内は連続P1ですが、折れ目の共有source節点でも面法線方向の熱流値はグループごとに指定できます。平均せず、既存平面APIの整合交差積分 `Tji=∫NBj NAi dA` を用い、targetの共有global節点IDへWを加算します。

座標mm、面積・係数m²。source外向き正の熱流はtargetへの正の印加熱流量W、target外向きはその負です。符号混在で総量ゼロの場合も、絶対積和を尺度として外向き総和ゼロを検査します。熱流量の保存であり、エネルギー保存、温度投影、物性同定、連成solverの実証ではありません。`solverConnected:false` を保持します。

幾何契約は既存折面温度APIと共通です。最大8平面グループ、各source/target面はちょうど1グループ、各組は完全被覆・対向法線を要求します。共有global IDを保持し、異なるIDの重複座標を勝手に結合しません。既存のグループ間接触検査は共有IDの頂点・辺を許し、交差・重複を拒否します。滑らかな曲面、部分被覆、一般的な非多様体交差へ拡張しません。

上限はmesh4096節点、片側512面・global active128節点、8グループ、保持係数16384項、group-local source値1024個、JSON1MiBです。group IDは英数字・underscore・hyphen1〜64文字。密な通常配列・plain data recordのみを受理し、accessor・非有限・演算overflowを拒否します。温度逆行列のconditioning制限を熱流積分へ転用しません。局所演算子の容量と、次グループ保持前の全体係数数を検査します。await前に幾何・熱流をsnapshotします。

保存は発行済み演算子に限定し、再読込は全係数・面割当・面積・重み・identityを再構築します。改竄後にhashだけ更新しても拒否します。原文identityは空白を含むJSON文字列の既存hash契約で、認証ではありません。未使用座標もgeometry identityへ含みます。旧平面APIを変更せず、共通幾何抽出前の温度2goldenと保存文字列・結果の完全一致を検査します。

独立oracleは単位折面の内部hat6W/m²の1microWと別面-2W/m²の-1microWを使い、総量ゼロでも非ゼロ節点荷重を保持することを確認します。面積不等、3D affine閉形式、符号・尺度・回転、改竄、容量境界も検査します。実solver・実測・校正・GUI・codecの実行は含みません。[検証記録](evidence/2026-10-27-grouped-p1-flux.json)。

