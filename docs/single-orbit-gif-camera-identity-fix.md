# 回転GIFのカメラ同一性修正

[English](en/single-orbit-gif-camera-identity-fix.md)

2026-10-27の実画面試験（固定ソース35922baf）は24フレーム生成後、最終証明照合で失敗し、公開artifactはありません。追加の実出力は実施していません。当時の「completed」表示は生成段階の表示であり、artifact公開成功を意味しません。

表示APIはカメラを12有効数字へ正規化しますが、GIFは生の座標を証明へ格納していました。実Three.js OrbitControlsの数値更新だけで、指定61が61.00000000000001となる反例を再現しました。実試験では生の証明カメラを保存していないため、当日の失敗原因をこの差だけへ断定できません。

GIFも既存canonicalViewStateを使用し、正規化済みカメラから計画・描画・証明を生成します。終了時は元の生カメラを復元します。異なるカメラは引き続き拒否し、正規化でfovが180となる入力も拒否します。最終照合のエラーは同じGIF_ORBIT_INVALIDのまま、値を含めず不一致項目を示します。API生成完了表示は「GIFのフレームを作成しました。」とし、公開artifact成功とは区別します。

回帰は実OrbitControlsのULP差、公開APIと同じカメラ正規化、熱2秒補間・null frame/modeのjob境界、異なるカメラ拒否、計画初期座標、日英生成段階表示を確認します。関連126件成功・失敗0・skip0（8.3567秒）。型と層の試験を含みます。実GUI・外部codec・solver・追加exportは0です。実artifact成功の検証は未実施です。


## 202bの可視受入失敗と向きの修正

後続202bはartifactの技術検査を通過しましたが、独立画像監査でモデル領域が背景のみとなり、可視受入は失敗しました。前述のカメラ正規化は維持します。

正規化したtargetを描画へ渡す変更で、Three.jsが対応しないplain xyz objectをlookAtへ渡していました。これは本修正担当の誤りです。実PerspectiveCameraの数値試験でquaternionと行列のNaNを再現し、正式なlookAt(x,y,z)呼出へ修正しました。寛容だったfakeもvectorまたは数値3引数を要求します。

実PerspectiveCameraをadapterへ注入した回帰は全24captureでquaternion・matrixWorld・projection・視線方向の有限性、targetへの向き、モデル境界8頂点の視錐台内投影、終了時の元カメラ復元を確認します。新しい実出力は行っていません。次の実画面での可視成功は未確認です。


## 202cの限定可視成功（2026-10-27）

後続の固定runtime `4e0f785de1971a2a40b89db6c04a8fe5035818de`で、別予算の202cを1回実行し、[独立可視確認](evidence/2026-10-27-single-orbit-gif-visible-main/README.md)まで成功した。24枚・640×320・200cs・loop0、補間表示2秒固定、全scene ROIの非背景2785〜5163 pixelsと24種類のhash、5状態復元と後始末を確認した。先頭/中央/最後で箱全体と向きの変化が見える。上記の未確認記述は各修正時点の履歴であり、202/202bの失敗記録は変更しない。成功範囲はsynthetic 94-node thermal box、通常main/IAB・英語・前景の当該例のみ。GUIボタンのdownload完了・一般形状/物理校正等は未証明。
