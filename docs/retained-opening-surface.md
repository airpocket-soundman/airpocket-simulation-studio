# 明示indexed開口surfaceの保持境界

[English](en/retained-opening-surface.md) / [既存候補確認と供給元の不足](fluid-domains.md)

`createRetainedOpeningSurfaceProvider()` はcallerが明示するopen indexed triangle surfaceだけを保持する。元node ID・node配列順・triangle順・巻き順を変えず、独自のprivate snapshotと内容SHA-256、caller sourceIdentity、単調generationを持つ。mainのnonindexed表示から復元せず、同座標nodeのweld、法線推定、port面除去、OCC局所蓋・mesh生成は行わない。solver/UI/API/MCP/project保存へ接続しない。

```js
const provider=createRetainedOpeningSurfaceProvider();
const lease=await provider.replace({
  units:'mm', topologyIntent:'open-indexed-surface',
  sourceIdentity:'caller-owned-source-v1',
  mesh:{nodes,triangles,toleranceMm:1e-6}
});
const cap=provider.confirm(lease,{
  confirmed:true, capId:'outlet',candidate:lease.analysis.candidates[0],
  outwardNormal:[0,0,1],interiorPointMm:[0,0,5],enclosure:[-2,-2,-1,4,4,12]
});
provider.release(lease);
provider.dispose();
```

replaceは通常object/通常dense Arrayのenumerable data fieldsだけを受理する。unknown fields、accessor、疎/装飾/派生/typed配列、非有限座標を拒否し、getterを呼ばずコピーする。hashのawait前に全入力を所有するため、その後のcaller変更は計算/identityへ混ざらない。sourceIdentityは空でない256文字以内のcaller同一性文字列で、署名・CAD由来の真正性証明ではない。

**provider固有の事前上限**は512nodes、1024triangles、座標±1e6mm、tolerance 1e-9〜1e3mm、canonical入力1MiB、graph20000値/深さ8/文字列256。既存detector本体には容量上限がないため、component/loop処理前にこの小範囲を固定した。1MiBは他の個数制限と同時に適用する天井で、1MiBまで使える入力を保証しない。candidateの正準化に伴うloop計算も最大512nodesへ抑える。一般形状の精度/peak RAM保証ではない。

contentRevisionは `{units,topologyIntent,sourceIdentity,mesh}` 全体のcanonical JSON UTF8 SHA-256。辞書key順だけを正規化し、全node/triangle ID・順序・未使用node・toleranceを保持する。sourceHashやprojectRevision、CAD mesh版との互換を主張しない。leaseはmesh本体を公開せず、凍結した検出reportを持つ。candidateは既存detectorの結果で、閉殻は候補0件、seam/不健全componentは理由付き拒否のまま保持する。openというcaller意図を閉殻/健全性の証明に読み替えない。

同時replaceは最大2件。slotはsnapshot前に予約し、3件目は入力getter/配列を読む前に `OPENING_SURFACE_PENDING_LIMIT` で拒否する。この拒否はcurrent/generationを変更しない。不正snapshot・hash成功/失敗・古要求の全経路でfinally解放する。clear/dispose後も未解決hashのslotを0へ戻さず、実際のpromise終了まで数える。これは並行保持の上限であり、callerが保持したreportや全JS heapのbyte上限ではない。

検証可能なreplaceが始まると旧leaseを直ちに失効し、pending中はcurrentがnullになる。最新generationのhash完了だけがcommitできる。後着・ABA・clear後は `OPENING_SURFACE_REPLACED`。不正入力のreplaceは既存lease/pendingを変更しない。hash失敗は `OPENING_SURFACE_HASH_FAILED` で、旧leaseへ戻さない。clearはpendingも失効し、releaseは現在leaseだけを解放、disposeはpending/currentを失効する冪等な終端操作。dispose後の新操作は `OPENING_SURFACE_DISPOSED`。失効時に内部WeakMapから旧geometryの対応を削除し、providerが全履歴を保持しない。

leaseは同一provider/moduleの発行objectだけが有効。clone/JSON復元/他provider/古leaseは `OPENING_SURFACE_STALE_LEASE`。confirmはcallerのcandidateをprivate meshのnode/triangle/toleranceで再検出・全項目照合する既存 `confirmOpeningCandidate` へ渡す。generationをmeshVersionとして使い、cap ID、明示unit outward、現在の内点/enclosureを既存validatorで確認する。同期処理の前後でcurrentを確認し、出力もfreezeする。候補normalの符号から外向きを推定しない。

[検証記録](evidence/2026-10-26-retained-opening-surface.json)は独立hash、入力変更、競合、ABA、release/dispose、同一座標別ID、閉殻/不健全、上限/不正/型を含む。画面へのindexed入力取得・保存schema・確認後のatomic appendはまだ製品契約がなく別途必要。これをCFDPORT1全体や任意CAD開口対応の完了としない。
