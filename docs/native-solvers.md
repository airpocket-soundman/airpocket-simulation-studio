# 独立したOSSエンジン: MFEM 4.10

[English](en/native-solvers.md)

MFEMのserial C++ライブラリをEmscripten 6.0.12でWASM化し、線形構造の別エンジンとして選択できます。MFEMのH1一次要素・ElasticityIntegratorが剛性を組み立て、対称Gauss-Seidel前処理とCGで解きます。Airpocketの組立済み行列をMFEMへ渡す方式ではありません。

元のTet4節点・要素をm単位でMFEM形式に変換します。拘束の局所座標基底をMFEM行列に適用し、同じ荷重・重力・熱膨張による節点荷重を入力します。拘束検査、領域転送、反力・応力の後処理と表示は共通です。解を共通の元の倍精度剛性へ代入し、自由度の残差2e-8以下を確認してから返します。MFEM計算の失敗時に他エンジンへ黙って置き換えません。

参照棒の0.04 mm / 100 N、回転した方向別拘束・指定変位、熱膨張と重力を含む条件をAirpocket版と比較しています。画面から同じ条件を両エンジンで計算してケース保存し、結果の比較・保存結果表示ができます。

現在のアダプターは線形・等方・Tet4の構造のみです。MFEMライブラリの他の全機能をこのアプリで使えるとは扱いません。CalculiX、Elmer、Code_Aster、OpenFOAMは依然として未移植です。

`npm test` / `npm run build` は必要なMFEM生成物がない場合、固定したSDKとMFEMソースを取得してビルドします。初回はPython、CMake、Ninjaとネットワークが必要で、SDKは約700 MB（Windows圧縮配布物）を取得します。以降はソース内容のハッシュとキャッシュで再利用します。ツールはリポジトリ内の無視対象.native-cacheに置き、システムへ恒久設定しません。GitHub Actionsも同じ手順を実行します。生成物はpublic/mfemへ出力し、MFEMのBSD-3 LICENSEとNOTICEを公開配布に含めます。

固定ソース: MFEM v4.10（16b0b814a3ba15a56c7a04e02d047188800cc0bf）、emsdk 35ff8a6d150541276abbc6bae512ca90bcfbe220 / Emscripten 6.0.12。

参考: [MFEMのビルド手順](https://mfem.org/building/)、[EmscriptenのSDK](https://emscripten.org/docs/tools_reference/emsdk.html)。
