# 再実行手順

1. 同一source56576af6のlocalhostをChrome390×844で開き、解析サンプルを使う。
2. adaptiveをcheckしてpreflight後、checkboxでSpaceを押す。falseとなり旧reportがstale化することを読む。再checkで現在入力へ戻ることを確認。
3. adaptiveからTabでadaptive-rounds、Shift+Tabでadaptive-runへ戻り、focus画像を保存。
4. 解析分野をthermalへ変更しadaptiveがdisabled/uncheckedであることを読む。日英labelを確認する。非対応checkboxをforce-enableしない。
5. Nodeの公式createStudioApiで熱入力をloadしdiagnoseExecution({method:'wasm-pcg',adaptive:true})を呼ぶ。pointerと入力不変を照合する。
6. disabled診断focusは既存ui-analysis-preflight.test.mjsで確認する。実GUIは非対応要求を作れないため、そのNode試験を実ブラウザ成果と記載しない。
7. viewportを戻し所有tab/serverを閉じる。
