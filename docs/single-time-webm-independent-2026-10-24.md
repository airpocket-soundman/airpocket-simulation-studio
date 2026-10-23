# 単画面音響時間WebMの独立監査

[English](en/single-time-webm-independent-2026-10-24.md)

owner `12ab81b842d5d91c39acf926d7d7d38bd8db4cc0` を固定して監査した。draftで、同schedule・寸法の別packet bytesへ元Blobの復号証明を流用できる反例を発見した。ownerは原Blobのintrinsic読取SHAをprivate proofへ結合し、manifest再計算SHAとjob SHAを照合、own arrayBuffer差替を拒否する修正を加えた。独立反例は `WEBM_ENDPOINT_UNVERIFIED` へ変化した。

独立3回帰は、非ゼロ開始・不均一時刻軸の全15動画長についてBigInt表示時刻と直接距離探索、first/last/offset、異payload/clone/返却proof変更/iterator偽装拒否、codec probe待機中のabortと遅延完了を検証する。関連UI回帰と合わせ33成功・失敗/skip0。JA/ENの4K capture上限、補間表示状態の復元、取消/結果交代/GUI stop、preview互換も確認した。

実codec・実録画・solver追加は0。fake codecの成功は実VP8画素内容の証明ではない。既存比較動画の実証は別記録で、単画面mainの実export成功は未主張。熱WebM、補間生成、物理精度判定は対象外。executionSettledはOS資源解放の保証ではない。進捗statusは無変更。

再現: `node --test tests/single-view-time-webm-independent.test.mjs tests/single-view-time-webm.test.mjs tests/visual-export-adapter.test.mjs`。固定sourceのworking CRLF/Git blob SHAと制約は[証拠JSON](evidence/2026-10-24-single-time-webm-independent.json)に記録した。
