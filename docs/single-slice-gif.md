# 単一ビューの温度断面GIF

[English](en/single-slice-gif.md) · [回転](single-orbit-gif.md) · [保存時刻](single-stored-time-gif.md) · [表示用変形](single-deformation-gif.md)

保存済み過渡熱結果のtemperatureを表示し、断面overlayと結果表面を有効にして、種類「断面を移動」で「GIFで保存」を選びます。選んだ時刻・色・カメラを固定し、既存viewerの軸平面clipping/断面表示だけを24位置へ移動します。解析、材料値、時刻の再計算はしません。熱流束・静的温度・構造・音響・P2流体はこの新しい経路の対象外です。

軸X/Y/Zと残す側flipは開始時のsetupを使います。体積Tet4に属する節点座標の軸最小→最大mmへ位相i/23で走査し、両端は厳密に含みます。flip=falseはcoordinate>=position、trueは<=positionを保持する表示契約です。台帳はaxis、positionMm、flip/retainedSide、clipEnabled=true、coordinateBasis=mesh-mm、境界端の印、delayを全24件保存します。表示座標が秘密に変形されないよう、熱結果の定義済みdisplacement/modesはgetterを実行せず拒否します。

現在のthermal表示時刻を固定し、stored frameかviewer補間かを明記します。補間時刻を保存済みframe indexと偽りません。履歴は2〜61枚・64MiBの節点scalar上限を再利用し、有限・厳密昇順の時刻と全温度の有限値/節点数を確認します。sourceの全scalarを毎画像copyしません。modeはnullのみで、非対応モードを借用できません。

境界端は元の外表面と一致し、既存section処理はその面を重複capにしません。断面overlayが0枚、保持体積0、薄い境界面だけ、または画像のモデルが空になる場合を設計上許容します。内部の隙間・分離形状でも空はあり得ます。台帳は『空かもしれない』と記録するだけで、未観察の空pixelや全24画像の可視性を保証しません。実受入は既知の凸箱で内部22画像の非背景と変化、先頭/中央/最後の保持側・captionを確認し、空境界と全画像が空の失敗を区別します。

新出力profileは65536節点・131072Tet4・524288surface三角形まで。通常のown dataを番号順に読み、有限Float32座標・Tet4の4つの異なる有効indexを確認した所有geometryに既存analyzeMeshValidityを適用します。既存のabs volume1e-15mm³下限/有限勾配/pivot契約を使い、異常要素を落とさず全体を拒否します。負orientationは既存契約どおり許容し、修正しません。surface indexとretained fluxの有限寸法も確認します。境界の閉鎖性、自己交差や一般的な断面数値精度は証明しません。

GIFは24枚・640×320・RGB332256色、整数1〜15秒、総delay100×秒centisecond、無限loop、最大32MiB。計画metadata12KiB/発行proof16KiBの上限を持ち、読み取り可能canvasとSHA-256だけを必要とします。native codecは不要です。`singleSliceGifExport`で対応を確認し、既存`startExport(format:'gif',animation:'slice')`とstatus/artifact/cancel/releaseを使います。新しいmethod/権限はありません。

private issued Blob proofはprepared setup全体（axis/flip/opacity/開始position/clipEnabled/hiddenParts/meshCount）、temperature・元result revision・固定時刻・mode null・surface/section true・camera・24台帳と厳密なbytes SHAを照合します。別経路/設定/時刻や同bytesの別Blobは借用できません。bytesはintrinsic brand/発行サイズ/32MiBをcopy前に検査し、hash前に所有copyへ切り離します。

UIはplaneだけを自前更新し、残るsetup/field/time/camera/source差し替えを拒否します。finallyで元setupと補間時刻、camera/up/fov、controls/入力を復元し、結果が交代した場合は新しい結果へ旧設定を書き戻しません。120秒watchdogは取消要求だけです。所有yield/Blob/SHAが未settleならleaseとlock/executionSettled falseを保持し、実際の後始末後に解放します。

[検証記録](evidence/2026-10-27-single-slice-gif.json)。独立simplex平面/保持側とaffine温度のP1表示を限定条件で検算し、GIF/LZWの24画像・delay・設定/時刻/bytes取り違え拒否、日英UI復元、待機中取消をfakeで確認します。実GUI書出しや一般空間精度、物理校正はここでは未実行です。207/208/回転/WebM各encoder sourceは変更しません。
