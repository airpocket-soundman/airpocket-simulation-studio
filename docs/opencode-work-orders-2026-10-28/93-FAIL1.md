# 93 FAIL1 — Tet4曲げロッキングを定量し、最小Tet10で純曲げWeibull破壊確率の要素収束を示す

## 開始条件

共通指示 `docs/opencode-work-orders-2026-10-23/00-COMMON.md`（primary checkout、読み取り専用）を先に読む。基準main `f16853a`（#237 マージ済み）。この1作業だけを実行し、親FAIL1「破壊・疲労・接触・非線形を扱う」の完成とは区別する。UI・MCP・worker・保存形式・既存Tet4ソルバーは変更せず、domain層の新規純関数モジュール `src/tet10-elastic.js` の追加に留める。

## 前提と読む順

指示書90で、実 `solveElastic`（Tet4）の純曲げ破壊確率がTet4曲げロッキングで解析解 V/(2(m+1)) に収束しない残条件が記録された。既存ソルバーに構造用2次四面体は無い（`stokes-p2-*` は流体P2のみ）。

1. `docs/opencode-work-orders-2026-10-28/90-FAIL1.md`, `docs/evidence/2026-10-29-opencode-90-fail1.json`
2. `src/fem-core.js`（`pcg`, `elementGeometry` の単位 mm→m）, `src/weibull-fracture.js`

## 実装・検証手順

1. `tet10FromTet4(mesh)`: 辺中点節点を共有生成（節点順 角0-3、辺01,12,20,03,13,23、直辺のみ）。
2. `tet10ElementStiffness`: 等方線形弾性、4点2次Gauss（アフィンTet10の剛性に厳密）。
3. `solveTet10Elastic`: 既存 `pcg` で解き、Gauss点で応力回復（要素内線形）。拘束は全体軸方向の変位のみ。
4. `evaluateWeibullFailureTet10`: Gauss点（各要素体積の1/4）を標本として81の `evaluateWeibullFailure` へ委譲。
5. 検査: (a) 要素剛性の対称性・剛体運動零・線形場でTet4エネルギーと一致、(b) 一様引張（ν=0.3）でTet4 `solveElastic` と応力一致、(c) Tet4ロッキングの定量（要素数に対するリスク誤差）、(d) Tet10純曲げで応力が解析解に一致し、リスクが V/(2(m+1)) へ収束、(e) 不正入力拒否。
6. 入力は合成値（物性主張なし）。

## 受け入れ条件

(a) 対称誤差<1e-12、エネルギー相対誤差<1e-12、(b) 応力差<1e-7·E·1e-3、(c) Tet4 384/1536要素でリスク相対誤差>10/>1（ロッキングの記録）、(d) Gauss点応力誤差<1e-9·σ_max、nx=16 でリスク相対誤差<5e-4、各段で誤差1/6以下、観測次数>3.5、(e) 拒否。閾値緩和で通さない。

## 対象試験

```text
node --test tests/tet10-weibull-bending.test.mjs
node --test tests/weibull-fem-coupling.test.mjs
node --test tests/weibull-fracture.test.mjs
node --test tests/module-boundaries.test.mjs
npm run check:contracts
git diff --check
```

## 境界と納品

証拠 `docs/evidence/2026-10-29-opencode-93-fail1.json`。`src/progress.json` は編集しない（更新案を納品へ添える）。観測: Tet4（全方向一様細分 8x2x4→64x2x32、384→24576要素）のリスク相対誤差 12.5/1.32/0.260/0.0613、ピーク主応力誤差 36.9/17.5/10.8/7.0%。Tet10は12要素から応力が丸め誤差内で厳密、リスク誤差 0.302/0.0461/0.00368/0.000244（12/24/48/96要素）は体積積分（σ^m のGauss求積）の誤差のみ。残る親受入: Tet10の本体ソルバー・WASM・worker・UI・保存への組込み、曲辺要素・荷重/熱/直交異方、表面欠陥Weibull、3母数・信頼区間、き裂進展・混合モード、塑性・多軸疲労、接触摩擦、実測データ照合。
