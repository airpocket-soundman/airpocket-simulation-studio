# 限定channelの節点速度方針

[English](en/channel-node-velocity-policy.md)

`src/channel-node-velocity-policy.js` は、既存の[面境界manifest](channel-layer-boundary-transfer.md)を正規validatorで再検査してから、元節点IDを保つ速度成分の制約を作るpure adapter。面manifestやproject/solver入力を置換しない。既存の平行平板・軸平行Tet4・流れ+xのみを対象とする。一般形状、斜め法線、流れsolveやy+の対応ではない。

`createChannelNodeVelocityPolicy({input,transfer,policy:CHANNEL_NODE_VELOCITY_POLICY})` を呼ぶ。`input`と`transfer`は既存境界転送の正確な入力/出力。唯一の明示policyは `wall-over-inlet-at-shared-nodes`。省略や自動選択は拒否する。

no-slip壁は速度3成分0、壁以外の入口は明示された正x速度を採用する。入口と壁の共有節点では壁0を選び、採用されなかった入口意図を `overriddenInletNodeIds` に保持する。各節点は全 `boundaryIds` と成分別の採用元を持つ。symmetryはzMin=[0,0,-1]、zMax=[0,0,1]を既存geometryから再生成・再検査した場合に限りz速度0。x/yを固定しない。一般法線への投影機能ではない。

`velocityMps` は `[number|null,number|null,number|null]`。**nullは未拘束であり0ではない**。壁の0と対称面の未拘束成分を混同してはならない。出口圧力は `outletFaceConditions:{faceId,pressurePa}[]` の面参照だけに保持し、節点圧力を新たに作らない。これにより壁との隅角へ暗黙の節点圧力を重ねない。Navier–Stokesへの正しい離散化/BC実適用を証明する出力ではなく、限定方針を明示・監査可能にした意図の受渡しである。

出力はschemaVersion1、meshRevision/transferRevision、policyRevision、m/sとPa、作用範囲を保持する。hash awaitの前後に元manifest/inputを再検査し、正規化したmanifest同士も比較する。`validateChannelNodeVelocityPolicy(options,received)` はJSON再読込後も全内容を再生成比較し、自己hashを付け直した改変も拒否する。節点/成分/所属/採用元/出口面/方針の改変を検証する。入力不変、出力はdetached、節点順は元ID昇順。オブジェクトproperty順には依存しないが、改変された配列順を黙って受理しない。

容量は既存512壁層から最大2056節点、出力1,000,000 UTF-8 bytes、受領値100000個・深さ10。非有限/未知policy/容量超過/accessorは拒否。最大容量で正規出力の再読込検査を確認した。参照7セル/42Tetは32節点、壁8節点、壁×入口共有4節点、固定速度72成分/未拘束24成分、出口14面。座標から作った独立集合oracleで全節点を照合した。

`solverConnected:false` / `projectBoundaryApiConnected:false` を維持する。流体solver接続、一般BC、物理精度、CFDMESH1親受入は未完。実solver・SDK取得・main/progress変更は今回行っていない。
