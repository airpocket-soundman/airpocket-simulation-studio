# 明示グループ付きP1熱流転送

[English](en/grouped-p1-heat-operator.md) · [折面温度L2](grouped-temperature-operator.md) · [単一平面P1熱流](planar-p1-heat-operator.md)

明示した平面グループを持つ折面で、P1熱流を節点熱流量へ転送する純粋APIです。入力は `{units:'W/m2',groups:[{groupId,values:[{nodeId,value}]}]}`。グループ内は連続P1ですが、折れ目の共有source節点でも面法線方向の熱流値はグループごとに指定できます。平均せず、既存平面APIの整合交差積分 `Tji=∫NBj NAi dA` を用い、targetの共有global節点IDへWを加算します。

座標mm、面積・係数m²。source外向き正の熱流はtargetへの正の印加熱流量W、target外向きはその負です。符号混在で総量ゼロの場合も、絶対積和を尺度として外向き総和ゼロを検査します。熱流量の保存であり、エネルギー保存、温度投影、物性同定、連成solverの実証ではありません。`solverConnected:false` を保持します。

幾何契約は既存折面温度APIと共通です。最大8平面グループ、各source/target面はちょうど1グループ、各組は完全被覆・対向法線を要求します。共有global IDを保持し、異なるIDの重複座標を勝手に結合しません。既存のグループ間接触検査は共有IDの頂点・辺を許し、交差・重複を拒否します。滑らかな曲面、部分被覆、一般的な非多様体交差へ拡張しません。

上限はmesh4096節点、片側512面・global active128節点、8グループ、保持係数16384項、group-local source値1024個、JSON1MiBです。group IDは英数字・underscore・hyphen1〜64文字。密な通常配列・plain data recordのみを受理し、accessor・非有限・演算overflowを拒否します。温度逆行列のconditioning制限を熱流積分へ転用しません。局所演算子の容量と、次グループ保持前の全体係数数を検査します。await前に幾何・熱流をsnapshotします。

保存は発行済み演算子に限定し、再読込は全係数・面割当・面積・重み・identityを再構築します。改竄後にhashだけ更新しても拒否します。原文identityは空白を含むJSON文字列の既存hash契約で、認証ではありません。未使用座標もgeometry identityへ含みます。旧平面APIを変更せず、共通幾何抽出前の温度2goldenと保存文字列・結果の完全一致を検査します。

独立oracleは単位折面の内部hat6W/m²の1microWと別面-2W/m²の-1microWを使い、総量ゼロでも非ゼロ節点荷重を保持することを確認します。面積不等、3D affine閉形式、符号・尺度・回転、改竄、容量境界も検査します。実solver・実測・校正・GUI・codecの実行は含みません。[検証記録](evidence/2026-10-27-grouped-p1-flux.json)。



## 統合候補の検証（2026-10-27）

root固定source `1b19f750640dca66644c43a78f869ff399fc83f9` はowner ec46a7bと[独立4回帰](grouped-p1-heat-independent-audit.md)を統合した候補。root focused94件にはこの独立4件が含まれ、別加算しない。型29宣言を検証した。[統合記録](evidence/2026-10-27-grouped-p1-heat-integration.json)でsourceとbuild/localの検証段階を固定する。初期の文書配置の失敗はowner証拠に保持し、上書きしない。

今回の熱流は**group-localの外向きP1 flux**を既存積分係数へ掛け、shared global target節点へWを加算する。旧201の温度L2はglobal consistent mass/crossを組み立てて温度を一回solveする別APIであり、熱流値の平均や温度逆行列で置き換えない。旧201保存goldenのbyte/結果一致と既存平面経路の互換を検証する。

2単位正方形の独立例題では、shared target6節点へ[1/12,-1/12,3/4,1/4,-2/3,-1/3]microWを保持し、合計0でも局所荷重を失わない。source外向きの正はtargetへの印加荷重が正、target外向きは負である。検証した保存量は熱流量Wであり、material energy J・温度依存物性・共役熱伝達solver・一般曲面/部分被覆・GUI・実測校正・親COUPLE3完了・公開の受入ではない。`solverConnected:false`を維持する。


固定sourceのbuildは3.89秒、local公開相当28件は69010.4474 msで成功した。原focused/build/local logsとlocal reportのbytesをcopyFileで保持し、専用-text範囲のstaged Git bytes/SHAを照合した。記録作業による追加solver/GUI/codec/exportは0。
