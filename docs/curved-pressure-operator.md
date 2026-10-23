# 保存可能なfacet固定複素圧力演算子

[English](en/curved-pressure-operator.md)

`src/curved-pressure-operator.js` は既存 `curved-pressure-transfer.js` の面一定複素圧力と転置を、有界・版付きの再利用契約にする。旧APIは変更せず、solver/Worker/GUI/MCPへ接続しない。形状は明示された向きの三角facetで、滑らかな曲面への精度保証、非一致meshへの投影、節点P1圧力、反復連成は含まない。`solverConnected:false` / `smoothSurfaceAccuracy:false` を保持する。

入力geometryは `{lengthUnit:'mm',surface:'open'|'closed',nodes:number[],triangles:[i,j,k][]}`。既存public validatorを使い、有限座標、節点index、退化/重複、closedのedge incidenceと向き整合を検査する。法線は宣言された巻き順による。自動反転や物理的外向きの推定はしない。閉殻の自己交差や一般CAD適合を証明しない。未使用節点を含め全座標をnumberとして検査し、幾何identityも全geometryを束縛する。

`buildCurvedPressureTransferOperator(geometry)` は各faceIndex/nodeIds/法線/面積mm²/面積3分の1重みm²を保持する。重みと法線は別factorにして、極小法線成分を先に重みへ掛けてunderflowさせない。圧力は `{units:'Pa',values:[{real,imag},...]}`、valuesの順序はgeometryの三角形順。`applyCurvedPressureTransferOperator(op,geometry,pressure)` が節点力real/imag、合力N、原点モーメントNmを返す。圧力は外向き法線に対して `F=-p n A/3`。momentは座標mmをmへ変換し `r×F` を原点について積算する。

変位は `{units:'m',real:number[],imag:number[]}` の節点xyz順。`applyCurvedPressureTranspose` は同じ重みを用い、各面の `V=∫u·n dA` をm³で返す。力演算子をL=-Bと書けばV=-Lᵀuであり、力の負符号をvolumeへ持ち込まない。`evaluateCurvedPressureVirtualWork` は `Σconj(u)·F = -Σp·conj(V)` の実部/虚部をJで確認する。許容は絶対1e-18J＋全両辺積項の絶対値和scaleJ×1e-12。relativeErrorJはlegacy名だが無次元比absoluteErrorJ/scaleJ（scale0は絶対誤差）で、旧APIの分母とは異なる。ゼロ合力でも節点力や仕事をゼロへ置換しない。

各applyは事前snapshotしたgeometry/fieldのSHA-256を検査する。返すpressureRevision/displacementRevisionは各入力場を束縛する。hash await中の変更は受理済snapshotへ混ぜず、その後の変更geometryへの適用はidentity mismatchで拒否する。出力は入力から独立し、演算子とfactorは深くfreezeして発行済WeakSetへ登録する。

`serializeCurvedPressureTransferOperator(op)` は発行済の演算子だけをJSON化する。`loadCurvedPressureTransferOperator(raw,geometry)` はraw容量/深さ、operatorRevisionを検査した上で全factorを元geometryから再導出する。hashを付け直した係数/法線/節点/単位/範囲改変も拒否する。戻り値は `{operator,source:{bytes,rawIdentity,meaning}}`。rawIdentityは原文UTF-8 bytesのSHA-256で、署名・認証・精度証明ではない。

容量は4096節点/512面、座標絶対値≤1e6mm、1MiB raw JSON、受領graph100000値/深さ12。plain recordと通常のdense Arrayだけを受け付け、accessor・独自prototype・未知field・非有限・範囲外indexを拒否する。geometryとfieldの配列長を先に検査する。正の面積でも重みがdoubleで表現できない場合は拒否し、0への強制変換をしない。中間積和が有限範囲を出る場合も明示拒否する。

[証拠](evidence/2026-10-24-curved-pressure-operator.json)と回帰は、独立担当が提示した2×3mm三角形、p=2+3i Pa、uz=(1,2,4)+i(-1,3,2)mmから、節点Fz=-(2+3i)e-6N、V=(7+4i)e-9m³、W=-(26+13i)e-9Jを照合。非共面skew閉Tetは別実装のSI面積vector/centroid momentと複素剛体並進/回転、原点移動を検証する。既存APIとの力/積分値、巨大だが有限の変位、先行積なら消える極小法線成分、ゼロ合力、保存再読込/自己再hash改ざん拒否、最大同時容量、原文1MiBと+1byte拒否、公開型を確認。これは合成数値referenceで、親COUPLE4B完成や実物/一般物理精度を示さない。
