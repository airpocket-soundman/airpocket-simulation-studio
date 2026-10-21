# 45 EXPORTBACKGROUND1 — 実hiddenタブの録画終了を確認する

先に [共通手順](00-COMMON.md) を読む。小さなPRは中間成果であり、下記の親タスク完了条件まで継続する。外部条件だけは未実施として明示する。

## 現状と着手条件
- checking。停止監視は公開済みだが、実Chromeのforeground/hidden/非選択タブを確定した検証が未完。
- 利用者は現在手動操作できないと回答済み。再度協力を求めず、実visibilityを確認できる操作環境を確保できるまで実機項目を保留する。
- DOMイベントの手動dispatch、headlessの模擬hidden、タブ名だけのforeground表示を実hiddenの証拠にしない。

## 作業場所と読むもの
- origin/mainから専用worktree/branch。主作業フォルダ/他担当worktreeを保護する。他人のChromeや録画処理を停止しない。
- `docs/automation.md`、`docs/task-critical-path.md`、`docs/evidence/2026-10-18-webm-lifecycle-real-chrome.json`の観測限界を読む。
- `src/ui/webm-recording-lifecycle.js`、`src/comparison-video-controller.js`、`src/ui/comparison-video.js`、`tests/helpers/webm-test-env.mjs`を確認する。

## 今すぐ行える作業
1. 開始/中止/期限/失効/例外の所有権とfinally経路を追い、lock・stream・recorder・元表示がどこで解放されるか一覧化する。
2. `node --test tests/webm-recording-lifecycle.test.mjs tests/comparison-video-controller.test.mjs tests/browser-export-session.test.mjs`を実行する。
3. 未検証マトリクスを「本当のhiddenが必要」「模擬で回帰確認済み」に分ける。既存の固定フレーム出力と実時間WebMを混同しない。
4. 不足が見つかれば、期限以内のsettlementと部分成果物拒否を確認する回帰試験付きの修正PRを出す。実機確認を済んだと書かない。

## 実機環境が使える時の手順
1. 専用の検証ページ/合成モデルを使い、公開sourceSHAとChrome/OS/MediaRecorder対応codecを記録する。
2. 通常タブで録画開始→中止、期限、セッション失効を個別に実行し、開始前と終了後の表示状態を比較する。
3. 本当に別タブを選択し、録画側の`document.visibilityState`/hiddenの観測時刻とタブ操作の時刻を記録する。
4. hidden開始時と録画途中hiddenの両方を試し、中止/期限/失効が有限時間でlock/streamを解放することを確認する。
5. 未完WebMを正常成果物として保存/登録しないこと、理由が日英で表示されること、元表示へ戻り次の録画が開始できることを確認する。
6. 実hiddenで再現しなくても観測時間・OS/Chrome制約を記録し、滑らかな背景再生を保証しない。
7. 取得物は自身の合成モデルだけを保存し、無関係なユーザー画面/認証情報を録画しない。

## 証拠・提出・完了条件
- JSONにsourceSHA、実visibility遷移、操作/停止時刻、開始/解放lock状態、終了理由、成果物の採否、元表示復元を残す。
- 模擬試験、実foreground、実hidden、未実行を明確に分け、日英docsと小さいPRで提出する。自己merge・force pushは禁止。
- 操作環境が不足する間はcheckingを維持し、必要な実機操作だけをblocking条件として残す。
- 2026-10-21の実Chrome調査では、所有タブ2枚を作っても両方のdocument.visibilityStateはvisibleのままだった。選択タブIDの変化はhiddenの証拠にしない。記録: `../evidence/2026-10-21-background-tab-visibility-feasibility.json`。所有タブは終了済み。手動操作ができない利用者へ同じ依頼を繰り返さず、実hiddenを生じる正規操作が利用可能になるまで当該マトリクスを未確認として保持する。
- 全条件を実確認してもVIEWCOMPARE/BROWSEREXPORT1/P3や公開ゲート全体は別判定。親タスクを自動releasedにしない。
