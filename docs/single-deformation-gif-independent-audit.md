# 表示用変形GIFの独立監査

[English](en/single-deformation-gif-independent-audit.md) · [機能契約](single-deformation-gif.md)

owner初版1babe802を読み取り監査し、最終修正 `167412d834aa1988bda2a4ead4c275ea67c9214e` を受け入れた。独立branchは追加3回帰と記録だけでproduction sourceを変更しない。[証拠JSON](evidence/2026-10-27-single-deformation-gif-independent.json)。

実prepareCaseViewが受理する最小legacy保存結果へ、elasticの変位uAと余分なmodes[0]のuBを同居させた。初版planはuAを検査したが、既存mainの表示はmodesのuBを優先でき、静的proofと描画vectorが不一致になった。owner修正は新しい静的GIF profileだけで定義済みmodesを拒否し、static adapterもmodesを読まない。getterは0回。undefinedは既存表示も静的vectorを使うため許可し、mainの広い変更は加えていない。旧PNG等の一般挙動を修正したという主張ではない。

独立数式はproduction animationStateを使わず、sin²(πi/24)と根号による既知の分数を使う。最大倍率37で既知の節点座標がpeak時10.37/9.26/41.48 mmとなり、全24poseのFloat32座標と実Three camera投影が当該fixtureで有限・画角内であることを検査する。全入力の可視性を保証する試験ではない。正規化modeの保存周波数1/1000 Hzと表示時間1/15秒が倍率列を変えず、動的応答/載荷履歴ではないことも確認する。

job→handoff→adapterの3層を使い、7枚目のcapture・倍率12.5付近で量子化yieldを停止する。取消/watchdog要求やmode閉包の変更があっても終了・復元を先取りせず、yield解決後に元の倍率25と選択modeへ戻す。onchangeは実main同様に閉包更新とredrawを模擬し、復元mode/倍率で描画されることを確認する。成果物の部分公開はない。

新3件を含む関連113件が成功（失敗/skip0、15.9101237秒）。型31/層/日英docを含む。実solve依存fixed-frame fileは実行せず、ownerの既存WASM欠如による準備失敗記録を維持する。追加actual GUI/GIF decode/native codec/solver/product exportは0。実モデル可視性・校正・物理応答・OS資源解放・公開・親完了は未証明。
