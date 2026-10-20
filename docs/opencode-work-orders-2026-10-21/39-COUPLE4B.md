# COUPLE4B: PR #144 の複素曲面転送overflow修正

## 共通条件と修正先

- 最初に [00-COMMON.md](00-COMMON.md) を読む。対象はOpenCode / DeepSeek v4.1 Flash。
- 元PR #144、元branch `codex/opencode-couple4b` を修正する。重複PRは作らない。
- review固定HEAD: `7f3be4bcec0bef9f79066c0d59c461034e97515e`。
- 元worktree例: `D:/github/airpocket-soundman/studio-opencode-couple4b`。未知のdirty treeでは作業しない。
- 自分専用repair worktreeを元PRの最新HEADから作り、branch/HEAD/statusを記録する。
- 固定HEADから更新があれば元PR差分と反例を再照合し、修正済みなら重複実装しない。
- 元branch ownerと調整し、cleanな状態でだけ作業する。既存変更のreset/stash/破棄は禁止。
- 完了後は元branchへ通常のFF pushを行う。remote更新で非FFなら停止し、force pushしない。
- merge・別PR作成・親進捗の昇格・指定外source編集は行わない。

## 読む順と許可範囲

1. src/curved-pressure-transfer.js: 圧力Pa、座標mm、変位m、力N、虚仕事Jの契約。
2. tests/curved-pressure-transfer.test.mjs: 現在9件の解析参照・位相・共役・不正形状テスト。
3. docs/evidence/2026-10-19-opencode-couple4b.json: 離散曲面だけ、実solver未接続の証拠範囲。
4. tests/vibration-source.test.mjs: 既存一方向連成の拒否境界。
- 変更可: curved-pressure-transfer.js、対応tests、必要最小の日付入り修正証拠JSON。
- module層・worker・solver・MCP・GUI・既存source purity・child-process境界・数/容量上限は変更しない。

## 実測した反例

- 開三角形(0,0,0),(1e6,0,0),(0,1e6,0) mm、p=1e308+0i Paは全入力有限。
- pressureNodalForcesがresultantReal=[0,0,-Infinity]、momentReal=[NaN,NaN,0]を成功returnする。
- 10 mm直角三角形、p=1000+500i Pa、各節点uz=1e308 m、他成分0も全入力有限。
- faceNormalDisplacementIntegralはvolumeReal=Infinity。数学的期待値は50e-6*1e308=5e303 m³で有限。
- 同条件のvirtualWorkIdentityはnodalWork.real≈-5e306 J、pressureWork.real=-Infinity、relativeErrorJ=NaN。
- これはguard用の極端な合成値であり、現実の材料/測定/変形を表す参照とは主張しない。

## 番号付き実装

1. 上記2反例を追加し、有限入力検査だけで非有限結果を成功させる経路を固定する。
2. 幾何difference/cross/norm/area、面積換算、複素圧力積、節点力累積を有限性検査する。
3. 変位積分はarea/3重みを各寄与へ先適用する等、最終値が有限な例の中間overflowを避ける。
4. 変更した演算順でもnormal符号、mm²→m²一度だけの換算、転置の積分重みを保持する。
5. 合力/モーメント/面積合計/体積合計の中間と出力も検査し、0*InfinityによるNaNを通さない。
6. 虚仕事のreal/imag積・累積・誤差・scale/relativeErrorまで検査する。
7. 安定演算で扱えない入力はtypedな数値限界拒否にする。Infinity/NaNの成功returnは禁止。
8. clamp、NaN→0、圧力/変位の自動縮小、tolerance緩和で成功させない。
9. 入力非変更と既存正常9testsを保持し、新反例は独立期待値で照合する。

## 受入とtargeted実行

- 10 mm三角の圧力合力-0.05-0.025i N、各頂点-1/60-i/120 Nを維持する。
- 位相0/90度、向き反転、閉八面体の合力/モーメント、共役虚仕事の既存参照を維持する。
- volume期待値5e303 m³は安定計算で一致、または明示typed拒否。非有限値を返さない。
- 表現不能な積・多数寄与の累積overflow・虚仕事overflowも同じ拒否契約へ揃える。
- `node --test tests/curved-pressure-transfer.test.mjs`
- `node --test tests/vibration-source.test.mjs`（実solver準備が必要なら他heavy実行と直列化）。
- review時は前者9pass。後者・本番solver・実Chromeを実行済みと読み替えない。

## 停止と納品

- source競合、remote HEAD更新、前提不足、範囲外連成が必要なら停止してownerへ報告する。
- 固定/修正HEAD、再現入力、有限期待値/拒否code、実測値、targeted commandを小さい証拠JSONに残す。
- 秘密・巨大traceを追加しない。未実行と残課題を明記する。
- 親COUPLE4Bは未完。曲面projection/強制応答/減衰/双方向連成の完成とは扱わない。
