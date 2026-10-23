# 静的等方線形のpreflight coverage

[English](en/structural-preflight-coverage.md)

`preflightProject` のsolve応答は、既存の `requiredInputContract` と `physicsCoverage.contract` に同じ契約identityを使う。以前は静的等方線形の前者が `static-isotropic-linear-structure`、後者がnullだった。legacy/quantitative/exploratoryを含め同じidentityに揃えた。mesh-onlyは従来どおり `requiredInputContract:mesh-only` / coverage契約nullで、solve検査を行ったとは表示しない。

静的等方線形のmetadataは、入力時のproject/material・実行設定・単位/桁・必須値・境界種類/支持の存在・CAD未解決拒否を列挙する。provenanceはquantitative/exploratoryの必須pointer検査で、legacyに新たな由来要求を課さない。

`postMeshImplemented` は別途成功・settledのmesh-only jobを渡す `preflightMeshBoundaryTransfer` の実装を表す。有限Tet4座標/接続/体積/勾配と既存品質値、境界転送/面積/投影距離report、連結成分の固定/指定変位による剛体rankである。入力preflight自体がこれらを実行するわけではない。剛体rank診断があっても現在の構造経路のallowed判定を変えない。spring/elastic supportのrankや一般品質閾値、資料適用性・収束・メッシュ依存・物理精度は未完で、`completePreflight:false`を維持する。

advanced契約は既存の正確なidentityをcoverageへ渡すが、静的等方線形の実装済み一覧を借用しない。未登録のcoverageはimplemented空と未完条件を返す。legacyのadvanced入力は従来のunsupported/warning、quantitative未対応studyはunsupported/errorのまま。定常熱の連結成分anchor（熱接触含む）・音響波長検査は既存実装であり再実装していない。

本変更はmetadataのみ。allowed、diagnostic severity、provisional、権限、solver実行、保存schemaを変更しない。[検証記録](evidence/2026-10-24-structural-preflight-coverage.json)はpure入力検査31件。solver・GUI・CIの追加実行、全物理preflight完成、公開を主張しない。
