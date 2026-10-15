# API・保存形式の互換性方針

[English](en/compatibility-policy.md)

[開発計画](roadmap.md)の判断項目「API版と保存形式の互換性」の方針。調査日 2026-10-15、基準は `src/` の現行ローダーと `tests/compatibility-future-version.test.mjs`。ここに書く挙動は現状の記録であり、「既知の隙間」は将来修正すべき箇所として残す（本変更ではコードを変えない）。

## 規則

1. 追加的な変更（任意フィールドの追加）は版を上げずに行ってよい。ただし厳密なキー検査を持つ形式（下表で「厳密」）は未知キーを拒否するため、追加フィールドを書き出す側は版を上げる。
2. 破壊的変更（必須フィールドの意味変更・削除・単位変更・検査の厳格化による旧データの無効化）は、新しい版番号とする。
3. ローダーは未知の将来版を安定したエラー（`Invalid ...` 系、または `対応するプロジェクトではありません。`）で拒否する。部分的に読み込む、旧版として扱う、既定値で補う、といった黙った変換をしてはならない。
4. 拒否は状態を変更する前に行う（原子的）。拒否後もプロジェクト、ケース、表示、履歴は読み込み前と同一でなければならない。
5. 旧版の読み込みは、移行規則を明文化した場合のみ許可する。現状で唯一の移行規則は、ケース/表示バンドル v1 を測定履歴対応環境へ取り込む際に測定履歴を空にする（`measurementsCleared:true` を返す）ことである。
6. 応答の `schemaVersion: 1` は出力契約の版であり、保存データではない。応答形が破壊的に変わる場合は `schemaVersion` を上げ、`getBrowserOperationContracts` に反映する。クライアントは未知の応答 `schemaVersion` を処理しない。
7. 版の判定は厳密一致（`!== 1`）とし、`>= 1` や文字列の暗黙変換を使わない。

## 形式一覧

| 形式 | 版フィールド | 旧版 | 現行版 | 将来/未知版 | 実装 |
|---|---|---|---|---|---|
| 保存プロジェクト | `version` | 該当なし（0・欠落・`'1'` も拒否） | 1: 読み込み・書き出しで往復一致。任意の追加トップレベルキーは保持 | 拒否 `対応するプロジェクトではありません。`、状態は不変 | `regions.js validateProject`、`studio-api.js loadProject` |
| 入力来歴 | `inputProvenance.schemaVersion` | なし | 1 | 拒否 `Invalid input provenance document`（`loadProject` 全体も拒否） | `input-provenance.js` |
| 実行環境識別 | `runtimeIdentity.schemaVersion` | なし（欠落はレガシー扱い） | 1 | 拒否 `Invalid runtime identity` | `runtime-identity.js` |
| 解析評価 | `analysisAssessment.schemaVersion` | 欠落はレガシー扱い | 1 | 拒否（保存ケース検証で不一致エラー） | `analysis-preflight.js` |
| 保存ケース参照 | `caseReference.schemaVersion` | なし | 1 | 拒否 `Valid saved-case source identity required` | `acoustic-input-contract.js` |
| ケースアーカイブ | `version` | なし | 1。各ケースは入力・結果を再検証して取り込み | 拒否 `Invalid case archive`。入れ子の `input.version` が未来でも拒否。全件置換は原子的 | `cases.js` |
| 名前付き結果表示アーカイブ | `version` | なし | 1（厳密キー） | 拒否 `Invalid named view archive`、アーカイブ不変 | `named-result-views.js` |
| 測定履歴アーカイブ | `version`（記録の `evidence.analysisAssessment.schemaVersion` も） | なし | 1（厳密キー、300000 バイト上限） | 拒否 `Invalid measurement archive`、履歴不変 | `measurement-history.js` |
| ケース/表示バンドル | `version`・`kind: 'case-view-bundle'` | v1（測定履歴なし）を受理。測定履歴対応環境では空の履歴に移行 | v2（測定履歴付き。非対応環境では v2 を拒否） | 拒否 `Invalid case view bundle`。入れ子アーカイブの将来版も拒否。置換は原子的 | `case-view-bundle.js` |
| ケースアーカイブ転送・バンドル転送（ステージング） | 本体は上記アーカイブの JSON。転送自体に版なし | 上記に従う | 上記に従う | コミット時に上記ローダーが拒否 | `case-archive-transfer.js` |
| 解析失敗記録 | `schemaVersion` | なし | 1 | 拒否されず、構造化失敗を捨てて旧メッセージのみ保持（既知の隙間 G1） | `analysis-failure.js` |
| 応答（読み取り専用） | `schemaVersion` | 該当なし | 1 | 書き込み対象ではない。クライアントは未知版を扱わない | 各 `*-operations.js` |
| 共通API | `studio-api.js` の `version: 1` | 該当なし | 1 | 能力・契約は `getCapabilities`・`getBrowserOperationContracts` で発見する | `studio-api.js` |

## 既知の隙間（現状の挙動を記録。コードは変更していない）

| ID | 内容 | 現状 | 望ましい方向 |
|---|---|---|---|
| G1 | 解析失敗記録の将来 `schemaVersion` | `restoreAnalysisError` は検証に失敗した記録を無視し、旧メッセージのみの `Error` を返す。エラーは出ず、構造化失敗（`code` など）が黙って失われる | 将来版は安定した警告またはエラーで明示する |
| G2 | ケースアーカイブの最上位の未知キー | `import` は最上位キーを検査せず、未知キーを黙って捨てる（`export` に現れない）。入れ子の版は拒否する | 厳密キー検査に揃えるか、保持する |
| G3 | 厳密キー形式の追加フィールド | 名前付き表示・測定履歴・バンドルは未知キーを拒否するため、追加的変更でも版を上げる必要がある | 規則1のとおり版を上げる運用で足りる。拡張用の領域を設けるかは未決定 |
| G4 | 旧版の移行手順 | 版 1 のみ存在。バンドル v1→v2 以外に移行規則はない | 版を上げる際に移行規則を本書へ追記する |

`tests/compatibility-future-version.test.mjs` は、将来版の拒否と不変性、現行版の往復、および上記 G1・G2 の現状挙動（`knownGap`）を固定する。G1・G2 を修正する場合は同テストと本書を同時に更新する。
