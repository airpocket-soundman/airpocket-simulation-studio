# 指示71: 固定候補9594884の受入照合案

[English](en/order71-candidate-audit-2026-10-23.md)

固定候補 `9594884` とprimaryの指示52〜71、既存棚卸し、PR180〜184を読取照合した。[全20件・全37未完ID・固定head/check一覧](evidence/2026-10-23-order71-candidate-9594884.json)に原本hashを保存した。PR185とそのCIは未確認。source/progressは変更していない。

集計は171件、公開済134、queued12、building21、checking4、未完37。公開ゲートは1 complete/5 pendingで変わらない。PR180〜184はすべてOPEN、verify成功、deploy/verify-publishedはSKIPPED。PR184だけは今回実host/WASMログも確認し、2+19試験・失敗0・skip0。これは8c902f3の証拠で、9594884の最終CI・配信を保証しない。

| 指示 | 追加で閉じた範囲 | 現在の残件 |
|---|---|---|
| 52 | 実荷重列に加え、明示変位制御の独立実solve・反力・再計算・型・容量 | 最終CI/公開・実Chrome出力一巡。一般非線形履歴は別の未実装 |
| 53 | DOM Blob全bytes/hashと正式stdio一致、遅延再選択/破棄 | Chrome保存全bytes、390px、拡大、版snapshot、HTTPS |
| 54 | 合成childによる有界text session・取消/close/期限 | 実ACP入口/認証、browser本番transport |
| 55 | 明示provider会話controller/panel、ABA/本文上限/日英fixture | 本番transportとmain接続は未実装。実Chrome390px/keyboardも未確認 |
| 56 | 実stdio再起動、metadata-only復元、取得不能の安定code/再実行手順 | 親P3受入。完全結果永続化は本指示の対象外 |
| 57 | 正常poll401→所有録画取消→成果物拒否→新接続成功の模擬統合 | 実Chrome録画・失効・visible/hidden/非選択×日英の版復元 |
| 58 | snapshot/idle/active分離とIAB tiny1規模の実測 | 同一実Chromeの既存2規模再測定、追加規模、UASM idle欠測 |
| 59 | 別surfaceのIABでcold/warm/取消/復帰 | 同じChrome155系UAで別browser/engine実証ではない。Edge/Firefox未実測 |
| 60 | 反復不足と格子差を分離した有界調査 | Cd格子差4.1226447%>3%。新格子系列の計画/予算/数値受入 |
| 61 | 固定SU2一次source/discoveryと取得不可capability/code | 数値境界流束instrumentation/export/parser未実装、実収支未達 |
| 62 | 明示境界選択→record、PR184実host/WASM parity | 最新候補CI、製品backend/CAD写像/一般材料 |
| 63 | 容量/型/独立圧縮数値を含むdataset取込 | 実測/校正は外部。材料同定/GUIは未実装 |
| 64 | 版/明示法線/内点確認、厳密境界/型 | 一般局所CAD蓋/wire/複数体積/UI/solver未実装 |
| 65 | 適合Tet4に加え、版固定6境界BC/品質/距離manifest | solver接続、shared-edge節点BC優先、一般層/y+未実装 |
| 66 | 独立節点積分に加え、保存affine演算子と改ざん/重なり拒否 | 部分被覆は明示拒否。一般熱流体反復/任意nodal場/実測は未実装 |
| 67 | 限定1DOF penalty独立解析表 | 一般3D/摩擦/履歴未実装 |
| 68 | 非共面複素facetの合力/モーメント/剛体虚仕事 | 一般精度・本番連成未実装/未検証 |
| 69 | 世代分離と自動ABA/取消/破棄。root QAで通常JA/EN+Enter実Chrome | 強制遅延競合は自動のみ。390px/正確な版snapshotなし。正常Chrome証拠は後続47bfd03で固定 |
| 70 | final recipeだけを使うfresh独立正式stdio一巡 | 公開HTTPS・専門Skill全体ゲート |
| 71 | 全20指示・37未完・PR固定headの対応照合 | PR185最終CI、manifest一致、公開verify、採用headを結ぶ最終監査 |

旧棚卸しの52変位制御、55会話境界、62選択変換、66保存演算子、69世代分離の「未実装」は履歴となった。旧文書の結果を消さず、最新の限定成果へ参照を付ける必要がある。progress release説明にも変位制御継続との旧記載があるため、共有担当が日英のdetail/lastUpdateを最新実証範囲へ整合させる。状態昇格の根拠にはしない。

優先順は、(1)最終候補CIと69実Chrome証拠の固定、(2)復旧したブラウザで53/57/58/59の既存受入を実行、(3)55本番接続・61実数値流束・60格子系列など未実装/数値未達を個別計画、(4)認証/材料実測/校正/runtime原因の外部証拠、(5)許可済み統合後の同一SHA配信/公開verifyと全6ゲート照合。合成回帰・過去CI・ローカル公開相当検査を実機/公開合格へ読み替えない。

本候補で指示71のprogress/publication/docs試験14件成功、失敗0・skip0。契約15宣言成功。これは公開milestone validatorの整合を確認したもので、remote結果や物理精度を検証する試験ではない。

追記: root47bfd03で69正常Chrome証拠が `docs/evidence/2026-10-23-selection-browser.json` に完全head/source hash付きで固定され、読取照合した。rootからPR185作成・CI待機の連絡があるが、本監査では結果を取得/推定していない。
