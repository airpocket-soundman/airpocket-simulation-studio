# プリインストールした樹脂の公開物性

[English](en/polymer-library.md)

v0.39で91件（メーカー資料87件、特許の試験配合4件）を収録しました。値と出典は`src/polymer-catalog.json`へ同梱し、アプリからの検索・比較・適用には通信を使いません。原資料のリンク、版・確認日、取得PDFのSHA-256と試験規格を記録しています。原資料全体は再配布せず、選択した物性値をまとめています。

|樹脂|収録内容|
|---|---|
|PP|無充填、短ガラス繊維10/15/20/30/40/50%、長ガラス繊維30/40/50%、ガラスビーズ10/20%、タルク10/20/30/40%|
|PE|HDPEの無充填・ガラス繊維5/10/15/20/30/40/50%・タルク10/20/30/40%、LDPEのLupolen 6銘柄|
|ABS|無充填、ガラス繊維10/15/20/30/40%、ガラスビーズ10/20%、メーカーのタルク20%銘柄、特許のタルク10/15/20/30%配合|
|PBT|無充填、短ガラス繊維10/15/20/30/40/50%、長ガラス繊維30/40/50%|
|PET|ガラス繊維30/45%（黒色銘柄）|
|PA6|無充填、短ガラス繊維15/30/35/40/45%（耐熱安定化銘柄）、長ガラス繊維40/50/60%|
|PEEK|無充填、ガラス繊維10/20/30/40%（LF銘柄）|
|PC/ABS|無充填、ガラス繊維10/20/30%|
|その他|PC・PA66・POM・PS・PSU・PPSの無充填／ガラス繊維入りを選択して収録|

主要な一次資料: RTP Companyの[PP](https://www.rtpcompany.com/technical-info/data-sheets/series-100/)、[HDPE](https://www.rtpcompany.com/technical-info/data-sheets/series-700/)、[ABS](https://www.rtpcompany.com/technical-info/data-sheets/series-600/)と各銘柄の公式PDF、[LyondellBasellのPE射出成形選択ガイド](https://www.lyondellbasell.com/link/fee70558de6140c5ac19a15d4b52b2e5.aspx)、[AKAYのABSタルク20%](https://akayplastik.com/en/pdf/abs/A-20TAN01.pdf)、[SABICの特許試験配合・表2～5](https://patents.google.com/patent/US20180009978A1/en)。特許の4件はWebツールで表を確認したもので、原HTMLのハッシュは未取得です。市販銘柄と区別し、初期状態では表示しません。

## 使い方

「樹脂の公開材料ライブラリ」を開き、樹脂・充填材・含有率・銘柄名で絞り込みます。「候補の物性を比較」で樹脂・充填材・強度の単位・資料区分を比較し、行の「選ぶ」から銘柄を選択できます。原資料のリンクから試験条件を確認できます。絞り込んだデータをJSONとして保存できます。

構造解析への適用には、ポアソン比の利用者の仮定値と「等方線形の概算として使う」の選択が必要です。初期表示の0.35は公開データではありません。適用時は材料と物性を一度に切り替え、以前の弾塑性・超弾性・疲労物性を引き継ぎません。以前の塑性荷重倍率履歴も解除します。条件、形状、他の解析設定は維持します。

適用した出典、銘柄、充填材、公開値のスナップショット、ポアソン比が利用者の仮定であることをプロジェクト・ケースへ保存します。数値を手修正した場合は元の公開値と修正値を別に記録します。

## 値の扱いと不足項目

- ヤング率へ適用するのは掲載された**引張弾性率**です。曲げ弾性率を読み替えません。引張強度の降伏／破断／未指定の意味を区別し、塑性モデルや疲労曲線は自動生成しません。
- 比重しか掲載されていない資料は、比重×1000でkg/m³へ換算したことを明示します。
- RTPの「Primary Additive」の%は基準が資料に書かれていないため、質量%・体積%と断定しません。特許配合は明示された質量%です。
- AKAYのABSタルク20%は引張弾性率が未掲載です。密度・強度を収録し、構造計算には弾性率を別途入力します。強度や伸びから弾性率を推定しません。
- 特許配合は密度と強度が未掲載です。流動方向の線膨張係数は参考値として保持し、等方の熱膨張係数には適用しません。
- 熱伝導率・比熱・使用温度範囲・方向別弾性・クリープ・S-N曲線がない銘柄は未入力のままです。HDT・Vicat・成形温度から使用温度範囲を作りません。

v0.39で追加した一次資料: RTP Companyの[PBT](https://www.rtpcompany.com/technical-info/data-sheets/series-1000/)、[PET](https://www.rtpcompany.com/technical-info/data-sheets/series-1100/)、[PA6](https://www.rtpcompany.com/technical-info/data-sheets/series-200-a/)、[PEEK](https://www.rtpcompany.com/technical-info/data-sheets/series-2200/)、[PC/ABS](https://www.rtpcompany.com/technical-info/data-sheets/series-2500/)。VLF 81009の原資料はメーカーが暫定版と明記しているため、画面・比較表・保存した出典にもその区別を保持します。PA6の密度はISO 1183のg/cm³からkg/m³へ換算し、成形前の乾燥条件を機械試験の調湿条件へ読み替えていません。

代表値は射出成形試験片などの条件に依存します。実成形品の繊維配向、ウェルドライン、温度、ひずみ速度、調湿、クリープを再現する校正済みモデルではありません。各原資料の古い版も版情報付きで保存し、確認日を最新版の発行日と混同しません。銘柄の現在の供給状況は確認対象外です。

MCPの`studio_material_catalog`でも同じデータを検索できます。`family`、`filler`、`contentPercent`、`search`、`includeExperimental`で検索し、`id`で1件を取得します。例: `{"family":"PP","filler":"glassFiber","contentPercent":30}`。
