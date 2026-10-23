# 明示した準備済みTet4境界選択

[English](en/native-tet4-boundary-selection.md)

指示62、基点 `3dd4281`。`scripts/native-tet4-boundary-selection.mjs` の `createNativeTet4RecordFromBoundarySelections` は、既に用意したTet4 meshに対して呼出側が明示した境界節点集合と節点荷重を既存prepared recordへ変換する。CADからの条件転送や製品backendの実装ではない。

入力は厳密に `input`（既存保存入力）、`mesh`（mm節点とTet4）、`fixedNodeSets`、`nodalLoads`。固定集合は `{id,nodeIds}`、荷重は `{nodeId,forceN:[fx,fy,fz]}`。全並進固定とglobal軸の節点力Nだけを扱う。面圧・traction積分、局所枠、部分拘束、重力や他の材料モデルを推定しない。未対応fieldは拒否する。

固定集合のID/節点重複、集合交差、固定と荷重の交差、荷重節点重複、mesh外ID、内部節点、非有限、過大入力を拒否する。境界節点は正規validatorを通したTet4の外部三角面（incidence1）から決める。incidence3以上も拒否する。正規の `createNativeTet4Record` が材料key、mesh向き/接続、剛体支持不足、力の範囲を検査する。支持・荷重を自動追加しない。

入力は最初のhash awaitより前にsnapshotし、失敗時も変更しない。固定節点は昇順へ正規化する。既存の平行移動済み20×15×60 mm棒で±75/0 Nの変換結果、recordRevision、wireは従来recordと完全一致する。現行ソースのWASM CLIへ同じrecordを渡し、変位/反力/合力/モーメントを正規検査、75 Nの理論先端変位7.5e-6 mと比較する。合力を変えない偽の反力偶力も拒否する。

Windowsにはhost実行物がなく、host試験は未実施。WASM成功はhost成功を意味しない。`scripts/check-native-proof.mjs` の必須試験列へ新しい選択試験を追加した。既存Linux `native-proof.yml` は実host/WASM実行物を作成してこのcheckerを呼ぶため、そこでhostの選択record試験を実行する。今回Linux結果は未取得。SDKは取得せず、前回既存cacheからリンクした現行WASMを利用した。

実行: `node --test tests/native-tet4-boundary-selection.test.mjs tests/native-tet4-contract.test.mjs`（WASMは `AIRPOCKET_NATIVE_PROOF_WASM`、hostは `AIRPOCKET_NATIVE_PROOF` を実行物に指定）。ローカルでは11成功・3 host専用skip・失敗0。型・差分検査成功。実測、CAD条件自動転送、面荷重、製品backend、P6全体は未完。
