# PNG連番QAの引継ぎ

この保存資料は実Node構造計算の結果で、PNG ZIPの合格証拠ではない。前回Chrome接続断の記録は2026-10-21-review50-interrupted-attempt.json。

1. 最新mainに今回資料が入った専用worktreeを使う。source56576af6との差を確認し、公開用ソースを変更せず固定する。
2. 再計算する場合 `node scripts/qa-review-export-archives.mjs structural .qa/review50-fresh`。空の出力先だけを指定し、原本を上書きしない。
3. 安定したChromeで正規GUIからcases.jsonをImport case archiveし、保存結果を3D表示する。
4. 公式stdio connectorを同じlocalhost originで起動し、所有合成QAのinspect+viewだけを正規GUIで選択。edit/analyzeは追加しない。codeはメモリだけに保持。
5. getResultView/getView/inspect/caseList/getCompareViewの原状態を保存する。section axisX・位置4mm・無効を正規setViewで設定し、値を再読取。
6. 現在expectedResultRevisionでstartExport format=png-sequence、animation=slice、frames=3を実行する。timeoutは無条件再試行せず先に状態確認。
7. terminal後にartifact全ページ取得、全ZIP SHA・STORE CRC・各frame SHAを独立検査。
8. 一般PNG decoderで3枚の寸法・画素差を読み、manifest phase0/0.5/1とslice0/5/10mmを照合する。Node stubを代用しない。
9. 成功/取消でinput/result/cases/compare/camera/section復元、部分成果物拒否を確認し、原本ZIPとdecode結果を残す。
10. GUI Disconnect、stdio EOF、所有server/tabだけcleanup。接続が繰り返し切れるなら未確認を保持し、盲目的retryしない。
