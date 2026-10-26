# 単一ビューorbit GIFの限定統合記録

[English](en/single-orbit-gif-integration-2026-10-27.md)

2026-10-27、runtime 4e0f785de1971a2a40b89db6c04a8fe5035818deの通常main/IAB・正式stdioで、既存94節点熱ケースを補間2秒に固定したorbit GIFを1回確認した。[原本と可視確認](evidence/2026-10-27-single-orbit-gif-visible-main/README.md)は24フレーム、640×320、総200cs、86ページ、5574849 bytes、SHA256 56b231f00c29b5b37f39cd165035bef192b2ecb593266ca47e782f0700fe7fbcを保持する。独立復号pixel一致、全24モデル領域の非背景2785〜5163 pixels・24種hash、3画像の箱全体/回転/陰影/補間2秒caption目視を確認した。5状態不変・補間2秒復元・所有job解放/GUI欄クリア/sessionなし/子process終了を別に確認した。

source検証はfocused111件＋重複しない独立1件、型27、build成功、local28件成功（38259.865900000004ms）。追加のsolver/GUI/codec/export実行はない。初回proof拒否と202b背景のみの出力は歴史証拠として保持する。今回の可視成功はそれらを成功へ書き換えない。

[統合JSON](evidence/2026-10-27-single-orbit-gif-integration.json)にprotected比較を記録した。progressのBROWSEREXPORT1/P4のlastUpdate、lastUpdateEn、evidenceだけを追記し、171件全statusと他の全fieldをdeep比較で維持した。親受入全体、実取消matrix、GUI download完了、公開/main/release、別engine、一般物理精度/校正の証明は残る。
