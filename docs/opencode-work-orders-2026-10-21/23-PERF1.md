# 23 PERF1 — 次の限定受入単位

## 必読・開始条件

1. [00-COMMON.md](00-COMMON.md) を最初に読み、この指示を実行する。専用 branch/worktree は `codex/opencode-next-23` / `D:/github/airpocket-soundman/studio-opencode-next-23` とする。
2. 実行時に fetch した `origin/main` が前提 PR #128 の commit `75c1e30a1530b5df132f1d9fdfbb9f7b5fcc8778` を含むことを `git merge-base --is-ancestor 75c1e30a1530b5df132f1d9fdfbb9f7b5fcc8778 origin/main` で確認する。履歴再編なら対応する公開変更を確認し、判定不能は停止報告。未取り込みなら自分で merge/cherry-pick せず待機する。
3. primary、thermal-compare、他の OpenCode worktree、制作中の別 PR/worktree を編集しない。知らない dirty を消さない。既存実装の再実装はしない。
4. 変更前に対象 source/test を読み、対象ファイル・追加動作・合否条件を短く記録する。下記パスは作成時に存在確認済み。前提 PR の新規ファイルは取り込み後に存在確認する。

## 今回の目的と読む順

UASM と JS heap の系列分離は実装済み。既存 driver/probe を実 Chrome で1つの小さなケースに使い、正直な測定証拠を作る。Node の混在系列 test を実測と呼ばない。

1. `scripts/perf-browser.mjs` の header、PROBE_SNIPPET、mergeMemory、CLI。
2. `tests/perf-browser.test.mjs`、`docs/perf-browser-plan.md`。
3. `docs/automation.md` の stdio/localhost 正規接続手順。

## 変更範囲

原則 evidence と短い PERF 計測手順追記のみ。実測で明確な不具合が出たときだけ perf-browser.mjs と同 test を最小修正可。
solver・mesh 上限・timeout・ブラウザ権限・COOP/COEP・一般 CI flags・main.js・UI2 は変更しない。

## 番号付き実施と受入

1. source を凍結し合成10×10×40 mm の既存構造参照を読み込む。既存例の材料・支持・荷重を使い、mesh size=8 mm、case=structural-tiny、repeats=1 に限定する。
2. `node scripts/perf-browser.mjs --print-probe` の現行 snippet を確認して owned Chrome tab に設置。秘密なしの probe JSON を保存する。時計は既存 Date.now と整合させる。
3. 正規 stdio pairing 後、実際の localhost origin を使い driver を実行する。例:
   `node scripts/perf-browser.mjs --origin http://127.0.0.1:5174 --cases structural-tiny --repeats 1 --out .qa/perf-next23.json`
   origin/port は自分の server に合わせる。CLI が提供しない flags は発明しない。
4. end 後少なくとも3000 ms の sample と cancel 対象があれば cancel settle 後3000 ms の sample を取得して停止する。不要な fine ケースや長時間計測へ広げない。
5. merge CLI は `--out` の既存 report を読み、その同じファイルへ書く。元 report を `.qa/perf-next23-merged.json` にコピーしてから `node scripts/perf-browser.mjs --merge-memory .qa/perf-next23-probe.json --out .qa/perf-next23-merged.json` を実行する。元 report/probe は保持し、時刻範囲を記録する。
6. UASM bytes と usedJSHeapSize bytes を独立表示。各系列 baseline/peak/afterSettle/afterCancel の元時刻・sample count を照合し、series間の足算/差分混用が0件であることを確認。
7. APIが利用不能な系列は null/reason を記録。両方取得を強要せず、最低1系列の実 measured samples を受入条件とする。両方不能なら browser memory 受入は未完了。peak は「観測 sample 最大」であり真の最大/RSS/GPU 使用量ではない。
8. probe timer と owned 接続/server/tab を片付け、browser版・crossOriginIsolated・wall ms・bytes を sanitize evidence に残す。

## 対象試験

```powershell
node --test tests/perf-browser.test.mjs
npm run check:contracts
git diff --check
```

3秒待ちや実 Chrome 計測が実行不能なら理由を記録し、fake driver の値で置換しない。

## 証拠・停止・納品

- `docs/evidence/<実行日>-opencode-next-23.json` に base/head、前提確認、コマンド、実測値と単位、pass/fail/skip、ブラウザ版・origin・入力版・未確認を記録する。合成値と実測値を分離し、秘密・pairing code・全環境変数は記録しない。
- source を凍結して実 Chrome を確認する。Node fixture、localhost Chrome、公開 HTTPS は別の検証。ブラウザ機能がなければ未実証とし、必須ブラウザ受入を完了扱いしない。自分の tab/server/probe/接続だけ片付ける。
- 予期しない dirty/競合、前提欠落、保存互換性破壊、非有限値、値不一致、秘密や権限拡張が必要なら関係変更を停止し、再現・安全な成果・必要判断を残す。test skip/閾値緩和/架空証拠で通さない。既知 Node24 V8 fatal はログを短く保存して報告し、runtime を勝手に変更しない。
- `src/progress.json` と共通 docs/Skill は編集禁止。親 PERF1 を complete/released にせず、限定受入と残条件の更新文案だけ納品する。
- 最終成果: 動作、変更ファイル、通った対象試験と数値、未確認、証拠、commit/push/PR URL、レビュー箇所。専用 branch のみ commit/push/PR 作成し、自己 merge・force push はしない。

