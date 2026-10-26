# 最終合成観測の比較画面

[English](en/finite-observation-inspector.md) · [比較の入力契約](finite-visco-observation-comparison.md) · [履歴確認](finite-history-inspector.md)

材料欄の「有限材料点の入力履歴を確認」で履歴JSONを入力し、「最終合成観測との比較（任意）」を開く。最終合成観測JSONを貼り、「最終合成観測と比較」を押す。履歴だけの「履歴を確認」は観測欄が空/不正でも独立して使用できる。観測欄のCtrl/Command+Enterは比較、履歴欄の同操作は従来の履歴確認である。

「比較用の合成例を両欄へ入力」は**両欄を置き換える**。例はpublic/examples/finite-visco-comparison-history.jsonとfinite-visco-final-synthetic-observation.jsonの明示テキストであり、実測ではない。F=1.01I、K=2 MPa、1秒rampと2秒holdの静水圧参照はE=.01005I、S=60300I Pa、自由エネルギー/仕事909.0225 J/m³-reference、散逸0。観測にはS11+25 Pa・エネルギー+2・累積散逸+1 J/m³-referenceの**説明済み合成差**を入れている。応力/エネルギー/散逸は独立な差分の例であり、一組の物理実験の観測ではない。丸めによる微小差も隠さない。

既存compareFiniteViscoFinalObservationを専用Workerで1回だけ呼び、I/Z0からの再計算と最終時刻1点を比較する。raw/canonical履歴identity・parameter版・時刻・Pa/J/m³-reference単位・合成/暫定/未校正/由来を既存pure境界で完全照合する。空白だけ異なる履歴のrawも異なるため拒否し、許容時刻・補間・近傍点は使わない。hashは署名・由来認証・校正の保証ではない。

表示するのは観測−再計算のsecond Piola–Kirchhoff Sの3×3符号付き差/最大絶対成分差（Pa）と、自由エネルギー/累積散逸の符号付き差・絶対差（J/m³-reference）。値の尺度を一つへ混ぜず、合否threshold、fit、相対誤差%、calibrated/pass判定はない。時刻/入力hash/parameter版/観測raw hashを併記し、由来説明はplain textの最大240文字に切る。入力のoriginが合成であることを外部実測の証明へ読み替えない。

両入力はそれぞれ1MiB以内（合計最大2MiB）、履歴4096段階、比較は最終1件。従来と同じ1つの所有Worker/10秒監視/取消/破棄を使い、どちらの入力変更でも旧結果と処理を無効化する。直接value変更も応答時に照合し、ABAは世代で遮断する。成功/拒否/error/messageerror/timeoutでは所有Workerをterminateする。JavaScript停止中の実時間上限やOS資源の完全解放は主張しない。

応答はrequest種別ごとに検査し、別経路のsummary、primitive、疎/装飾行列、非有限値、異単位/校正flags、余分なpass/state、絶対差の不整合を拒否する。途中履歴拒否は失敗段階と完了段階数だけを表示し、比較数値を表示しない。全描画はtextContent。project/material/case、structural solver、保存schema、MCP method/scope、進捗状態を変更しない。

[検証証拠](evidence/2026-10-27-finite-observation-inspector.json)。独立静水圧式、符号付き差、hash/時刻/単位/由来の拒否、両入力の取消・変更・古い応答、exact各1MiB、実moduleWorkerメッセージを確認する。実GUI確認はこの実装時点では未実施。実材料/構造反力/校正/塑性/損傷やFINITEVISCO1の完了は未証明。


## 通常main/IABの実GUI確認（2026-10-27）

固定source `f8b2a084f942f320a72c907926b9c2602863c122` の[実画面証拠](evidence/2026-10-27-finite-observation-inspector-gui/README.md)で、対の合成例のボタン入力・比較・日英切替を確認した。history477 bytesのraw SHAは `e32a3ee8648ca26f7ce119ce35194018d4e4abc533ab3fd5013cee7bf22c5dac`、観測1139 bytesのraw SHAは `b46e565ab6383a409e8bda546dfdd25731303455c8f933a7372e2677a43909a5`。応力差9cellと独立したエネルギー/散逸差がdomain出力と一致し、主要な合成差25 Pa/2/1 J/m³-reference、微小丸め差を含む表示と日英の入力・値保持を確認した。

履歴へ空白を追加すると旧結果が即消え、再比較は実WorkerでHISTORY_MISMATCHを返して表を出さなかった。観測が編集後の履歴版と一致しないままでも旧「履歴を確認」は独立に動作した。クリアは両入力と結果を空・idleへ戻した。pure Worker呼出は比較成功/版不一致拒否/履歴のみ成功の3回で、このGUI操作の構造solver/出力exportは0。272個の保護DOM controls・条件表示・case数は同一だったが、正式なin-memory APIの全状態同一性や実取消の受入は証明していない。

同sourceでroot focused66（4367.6697 ms）・型28・build9.17秒・local28（約61.34秒）が成功した。runtime-manifest生成前の早すぎたlocal確認はENOENTで失敗し、正しいbuild順の後に成功した履歴を保持する。実装時点の未確認記述は当時の記録である。合否threshold・fit・材料校正・構造連成・親タスク完了・公開成功は追加しない。
