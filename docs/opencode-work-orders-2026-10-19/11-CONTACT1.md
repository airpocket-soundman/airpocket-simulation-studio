# CONTACT1: 一自由度の片側接触参照ソルバー

## 作業前の共通条件

- 最初に [00-COMMON.md](00-COMMON.md) を読み、その作業場所・実行環境・承認条件を守る。
- 対象モデル: OpenCode / DeepSeek v4.1 Flash。曖昧な部分を推測で実装せず、この限定範囲を優先する。
- このファイルは次の実装担当への指示。指示書作成時点で機能が完成したという意味ではない。
- 開始時に branch / HEAD / dirty paths を記録し、既存変更を退避・破棄・上書きしない。
- 以下の既存パスは thermal-compare checkout の読み取りで確認した。実装先で存在と内容を再確認する。
- shared docs / progress / Skill / main.js / package.json / lockfile は本単位の変更対象外。
- 新規 module は src/module-layers.json の所属を確認し、所有者と調整して必要行だけ追加する。
- 認証情報・ユーザーモデル・巨大 trace を証拠へ入れない。commit / push とレビュー用PRは00-COMMONの納品手順に従う。merge・公開は行わない。

## 最初の受入単位

本番Tet4接触へ接続する前に、ばねに支持された1自由度と剛体stopの片側penalty接触を解く独立moduleを作る。
これは限定した実数値問題のsolverであり、3D接触・摩擦・ボルトsolverのmockとして本番へ差し込まない。

## 読む順

1. src/progress.json の CONTACT1 と docs/roadmap.md。
2. src/fem-core.js / tests/elastic.test.mjs: 力N・変位mm・反力の符号を確認。
3. src/plasticity-core.js / src/hyperelastic-core.js: 既存反復/失敗の契約を読むだけ。
4. src/nonlinear-input-contract.js: 現在未対応の接触を許可しない。

## 変更範囲

- 追加可: src/unilateral-contact-reference.js / tests/unilateral-contact-reference.test.mjs。
- fem-core/plasticity/hyperelastic/worker/schema/UIの本番経路は変更しない。
- 接触熱抵抗 thermal-contact を機械接触として再利用しない。

## 実装手順

1. springNPerMm / penaltyNPerMm / gapMm / forceN / toleranceN / maxIterations を受け取る。
2. +uはstopへ接近、penetration=max(0,u-gap)、contactReaction=-kp*penetration と定義。
3. residual=k*u+kp*max(0,u-gap)-F を piecewise Newton/active set で解く。
4. 収束状態、u、gapRemaining、penetration、springForce、contactReaction、力残差、反復数を返す。
5. 不収束は成功結果を返さず typed refusal。forceの符号を勝手にabsolute化しない。
6. 非接触解u=F/k、接触解u=(F+kp*gap)/(k+kp)を独立な解析期待値にする。
7. 入力状態を変更せず、連続した摩擦/塑性履歴が存在するようなmetadataを付けない。

## 数値参照と拒否

- k=100 N/mm、gap=1 mm、kp=10000 N/mm。
- F=50 N → u=0.5 mm、接触反力0 N、残差≤1e-9 N。
- F=200 N → u=10200/10100 mm、penetration=100/10100 mm、反力=-10000*100/10100 N。
- F=100 N → ちょうど接触開始、penetration=0、反力0。F=-50 N → u=-0.5 mm、非接触。
- kp=1e4/1e5/1e6 N/mmでpenetration減少、硬いstopの反力-100 Nへ近づくこと。
- k/kp≤0、gap<0、非有限値、非整数/0反復、tol≤0を拒否。
- maxIterations=1で未収束となる初期条件を固定し、failure出力を検証する。
- frictionCoefficient等の未知keyを拒否し、摩擦を無視して成功にしない。

## targeted 実行と実機境界

`node --test tests/unilateral-contact-reference.test.mjs tests/elastic.test.mjs`

- 小問題の収束は3D面探索、接線剛性、作用反作用面分配、摩擦収束の証拠ではない。
- 摩擦・ボルト・大滑り・本番API/GUIは残す。親 CONTACT1 queued を維持する。

## 証拠と納品

- 変更ファイル一覧、実行した targeted command、pass/fail、残課題を短い日本語で提出する。
- docs/evidence/ に日付入り小さい JSON を追加。fixture の由来、入力値、単位、期待値、実測誤差、拒否例を残す。
- テスト未実行・dependency 不足・実ブラウザ未確認は、そのまま記載する。mock を実 CAD / solver / Worker の証拠にしない。
- 親タスクは未完を維持する。小単位の成功から status=done / checking / 公開済みへ昇格しない。
- 納品に「今回実装」「未接続」「親に残る条件」を分けて書く。

## 停止条件

- 既存実装が本受入を満たす場合、重複 module を作らず根拠と次の不足を報告する。
- 指定外の物理モデル、一般 CAD、外部 solver 導入、UI/API 本番接続が必要ならそこで止めて設計差分を報告する。
- 数値不一致を tolerance の拡大・fixture の置換・失敗 test の skip で隠さない。
- 環境準備ができない場合は不足を記録し、他 owner の source を改変して突破しない。
