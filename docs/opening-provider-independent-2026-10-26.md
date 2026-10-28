# 保持開口surface provider独立監査

[English](en/opening-provider-independent-2026-10-26.md)

原本 `8a515074780c55a29b31644090d2ed4bac05af79` に、未完了SHAを5件保持したままreplace5件すべてを受理する反例が成立した。個別入力上限だけではprovider総保持量を制限できなかった。owner修正 `9e81c33f43a0d177c7c8d3544c719c2ff2f1fc69` はsnapshot前にpending2件のslotを予約し、超過を `OPENING_SURFACE_PENDING_LIMIT` で拒否する。全出口のfinallyで解放し、clear/disposeでも未完了slotを偽リセットしない。

独立2回帰で、pending中の不正入力による世代奪取なし、超過拒否前のcaller inspectionなし、hash失敗後のslot再利用、古いhash後着で新leaseを上書きしないこと、dispose後の復活拒否を検証した。owner8回帰と計10成功、失敗/skip0。source SHAと範囲は[証拠JSON](evidence/2026-10-26-opening-provider-independent.json)。相互リンクを含むdocs2も成功。

明示的なindexed surfaceのprivate snapshot/leaseだけを扱う。CAD変換・保存・GUI・solverへの接続は未実装であり、hash処理の強制終了も保証しない。追加solver/GUI/codec0、進捗変更なし。

再現: `node --test tests/retained-opening-surface-independent.test.mjs tests/retained-opening-surface.test.mjs`。
