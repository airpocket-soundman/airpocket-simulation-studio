# 81 FAIL1 — 脆性破壊のWeibull最弱リンク破壊確率を解析解で検証する

## 開始条件

共通指示 `docs/opencode-work-orders-2026-10-23/00-COMMON.md`（primary checkout、読み取り専用）を先に読む。基準main `066de3e`。この1作業だけを実行し、親FAIL1「破壊・疲労・接触・非線形を扱う」の完成とは区別する。並行するCONTACT1/FINITEVISCO1/COUPLE系の領域（接触ソルバー、粘弾性、流体）は変更しない。UI・MCP・worker・保存形式も変更せず、domain層の純関数に留める。

## 前提と読む順

FAIL2（`src/fracture-core.js`）はモードI LEFMの決定論的上下限のみで、`lastUpdate` に「Weibull確率は未対応」と明記されている。FAIL3/FATIGUE1/PLAST1-2は単軸J2・S-N・Miner、CONTACT1は収束契約まで。FAIL1の受入「材料モデルと試験データに基づき個別に検証。材料名や最大応力だけから破断を保証しない」に対し、最大応力でなく体積分布応力と登録試験パラメータから破壊確率を出す統計モデルが欠けている。

1. `src/progress.json` の `FAIL1`, `FAIL2`
2. `src/fracture-core.js`, `tests/fracture.test.mjs`（応力6成分順序 xx,yy,zz,xy,yz,xz と出典必須の契約）
3. `src/module-layers.json`（domain層登録）

## 実装・検証手順

1. `src/weibull-fracture.js`: 2母数Weibull体積最弱リンク、多軸はPIA（引張主応力ごとの独立作用）。`P_f = 1 − exp(−Σ_e V_e/V_0 Σ_i ⟨σ_i⟩^m / σ_0^m)`。パラメータ m・σ_0・V_0 と出典・試験条件・表面状態は必須、既定値なし。線形弾性結果以外は拒否。
2. 解析解: (a) 一様単軸引張の閉形式 P_f、(b) 要素分割不変性と寸法効果 σ_2 = σ_1 (V_1/V_2)^{1/m}、(c) 線形応力勾配の有効体積 V/(m+1) へのmidpoint収束（次数2）、(d) 等二軸でリスク2倍・圧縮無寄与・回転不変、(e) 不正入力拒否。
3. 入力は合成値（物性主張なし）と明記する。

## 受け入れ条件

(a)(b) 相対誤差<1e-12、(c) n=200で相対誤差<1e-3かつ観測次数 2±0.05、(d) リスク相対差<1e-10、重根での主応力誤差<1e-7×応力尺度、圧縮のみで P_f=0。

## 対象試験

```text
node --test tests/weibull-fracture.test.mjs
node --test tests/module-boundaries.test.mjs
npm run check:contracts
git diff --check
```

## 境界と納品

証拠 `docs/evidence/2026-10-28-opencode-81-fail1.json`。`src/progress.json` は編集しない（更新案を納品へ添える）。残る親受入: 解析結果（WASM要素体積）との結合・保存/UI、表面欠陥Weibull、3母数・信頼区間（m・σ_0の推定不確実性）、き裂進展・応力腐食・混合モード、塑性疲労・多軸疲労、接触の摩擦/ボルト、実測試験データでの照合。
