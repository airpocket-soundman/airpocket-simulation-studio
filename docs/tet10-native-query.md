[English](en/tet10-native-query.md)

# 保存Tet10専用の点取得（2026-11-07）

`prepareNativeTet10Result(saved)` は保存full Tet10の原文から切り離したplain own-data snapshotを作り、版・native metadata・入力profile・runtime identity・input revision・`nativeResultRevision`を検証します。後者はjob envelopeとrevision自身を除き、既存規約どおりresult.performanceを除外したcanonical内容hashです。プロデューサーの署名、荷重との平衡、校正、収束認証を証明するものではありません。

全10節点接続、共有中間辺、元converterと同じ正確な中点座標、全節点使用、面incidence、6節点境界面、box内座標、box体積、SATによる内部体積重複拒否を確認します。保存Gauss位置/体積/全応力・von Misesと最大値は節点変位から再導出して照合します。数値整合の許容差は応力1e-4Pa+1e-8相対、座標1e-10×max(1,box最大辺)mm、体積1e-8mm³+1e-8相対です。中点座標は丸め直さずconverterの式とexact比較します。これらは機械計算の整合許容差で、工学的合格閾値ではありません。

`sampleNativeTet10Result(handle, pointMm)` はprocess-localの正規発行handleだけを受け取り、実quadratic形状関数Nᵢとその勾配で変位(mm)、engineering strain `[xx,yy,zz,gammaXY,gammaYZ,gammaZX]`（無次元）、等方線形小ひずみ応力 `[xx,yy,zz,xy,yz,zx]`（Pa）を評価します。mmの節点変位と1/mmの勾配により単位は正しく相殺します。せん断応力はμγです。Gauss値の平均やTet4 downsampleは使いません。共有面上は最小の含有element indexを返し、条件数に応じた64EPSκ（最大1e-8）のbarycentric境界許容差を使います。体外は `TET10_NATIVE_OUTSIDE`、不正記録/handleは `TET10_NATIVE_INVALID` です。handleのJSON cloneは使えません。

上限は512要素/4096節点、座標・変位±1e6mm、E≤1e15Pa、ν≥−0.99（元profileのν<0.49も維持）、corner Jacobian条件指標≤1e6です。snapshotは深さ24、20万value、文字列65536文字、array16384要素、object128keys、8MiBの保守的なJSONサイズ見積りを先に検査します。getter・疎配列・特殊prototype・typed storageは拒否します。単一box/全面固定+合計力/重力なし等、既存限定job profileも維持します。

Node `queryNativeTet10File({path, expectedRawSHA256, pointMm})` は8MiB上限のFD snapshotを読み、no-links/regular file/前後dev・ino・size・mtime・ctimeを確認します。raw SHA不一致、UTF8/BOM、decoded重複key、深さ/value過剰を拒否し、compactな1点だけ返します。書込・worker・solverは開始しません。既存job64MB・printed reader2MB上限は変更しません。raw8MiB以下でも構造/snapshot予算を超えれば拒否します。

[証拠](evidence/2026-11-07-tet10-native-query/report.json) には1回だけ実行した10mm cubeの24Tet10/63節点・39,044B保存rawを保持し、以後の回帰はそれを純読取で使います。affine/真のquadratic/剛体並進と無限小回転の解析式、ν=0.25の体積/せん断規約、自己hash再計算後の改竄拒否、体外、入力所有、同時file編集を検査します。構成されたpolynomial記録は形状関数検証用で、実荷重解を装いません。有限回転の客観性、任意CAD、一般case/view/compare、親P5B/98の完了は主張しません。標準sampleResultのnative拒否は維持します。

## 入力密度の追補（2026-11-07）

独立監査で、hash対象外のperformance配列の欠番を非index数値キーで補うと、旧snapshotのownKey数検査を通過する漏れが見つかりました。数値解の誤答ではありませんが、dense own-data契約違反です。配列はlength固定で0..length−1のown enumerable data descriptorを直接読み、欠番を拒否するよう修正しました。同じ形のpointもOUTSIDEではなくINVALIDとなります。正常なdense performanceは維持し、追加FEMは行っていません。[修正証拠](evidence/2026-11-07-tet10-native-query/dense-fix.json)

さらにArray Proxyのlength get trapで容量検査後だけ長さを差替える余地を閉じました。length自身もown data descriptorから1回だけsnapshotし、その検証済み値で容量・key数・走査長を統一します。16385という小さな上限超え値を使った反例でlength get trap呼出0を確認し、巨大割当は試していません。
