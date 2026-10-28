# 79 VIEWTIME — 熱の「再生」プレビューを保存温度フレームへ接続する

## 開始条件

[共通指示](../opencode-work-orders-2026-10-23/00-COMMON.md)を先に読む。基準main `036c2e7`（PR212統合後）。この1作業だけを実行し、親VIEWTIMEの完成とは区別する。

## 前提と読む順

2026-10-27時点の`lastUpdate`の未完は一般形状・公開環境・GUI download・熱preview・取消matrix。うち「熱preview」だけを扱う。保存温度WebM/GIF/PNG連番の固定frame経路（`renderFixedAcousticTime`、`singleThermalTimeWebmExport`）とproofは変更しない。

1. `src/visual-export.js`（`animate`のtime分岐と熱preview拒否）
2. `docs/single-view-thermal-fixed-webm.md`、`docs/transient-acoustics.md`
3. `tests/visual-export-fixed-frame.test.mjs`（fake DOM fixture）

## 実装・検証手順

1. `animate(record=false)`の熱拒否を、保存温度frame（transient、2frame以上）かつ表示量「温度」の場合だけ通す条件へ置換する。熱流束・定常・1frameは従来どおり拒否し、温度へ自動変更しない。
2. 既存の実時間preview経路（共有`#acoustic-time-frame`スライダー、`animationState`の最初→最後）を再利用し、補間・再計算・新しいsolve時刻を作らない。完了・停止後は`restoreTimeView`で保存前の補間表示時刻へ戻す。
3. 日英UI説明、契約の説明文（startExportの意味は不変）、関連文書を更新する。main.js・progress・MCP入口は編集しない。

## 受け入れ条件

fake DOM/fake clockで、温度previewが保存frame 0から最後まで単調に進み、完了と停止の両方で補間表示時刻（frameIndex 1, 6.25 s）を復元し操作lockを解除すること、熱流束・定常・1frameがスライダーに触れず拒否されることを自動確認する。内蔵ブラウザで熱結果の再生ボタンが完走し状態文が完了になることを1回確認する。

## 対象試験

```text
node --test tests/thermal-time-preview.test.mjs tests/visual-export*.test.mjs tests/single-thermal-time-webm.test.mjs tests/single-view-time-webm*.test.mjs tests/single-stored-time-gif-independent.test.mjs
npm run check:contracts
git diff --check
```

上の試験の成功だけで実時間再生の物理時刻精度・一般形状・公開HTTPS・GUI download・取消matrixの合格にはしない。

## 境界と納品

証拠は`docs/evidence/2026-10-28-opencode-79-viewtime.json`。共通進捗は71担当へ更新案（lastUpdateに「熱の再生previewを保存温度frameへ接続」）を渡し、この作業だけで親をreleasedへ進めない。
