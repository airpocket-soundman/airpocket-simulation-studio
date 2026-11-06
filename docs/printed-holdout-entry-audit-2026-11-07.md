# 保存holdout入口の独立監査

[English](en/printed-holdout-entry-audit-2026-11-07.md)

基準 `4bc0a9f` のCLI、保存ファイルservice、正式stdio MCP、能力宣言を独立に確認しました。製品ソースは変更しません。実CLIとMCPを起動し、m/kNとmm/Nの正規化を含む合成noise oracleでE=7e8Pa、SE=√((50000/4)/(55e-6))、残差[-300,100,-50]Paと統計値を照合しました。validationを変更してもtrainingの同定係数は変わりません。

両datasetの正確な2000000 bytesを受理し、1byte超過でモデル値なしの拒否を確認しました。要求・入力のraw UTF-8 SHA/bytes、入力不変、link/junction拒否、既存directory不変、MCPの限定summary・SHA拒否artifact・未知field拒否を確認しています。Nodeだけが能力を広告し、出版toolのreadOnly/idempotent hintはfalseです。

owner6件＋独立4件の実回帰を実施しました。実測・物理的独立性・校正・材料精度・GUIの保証ではありません。比較結果のPa誤差は合否閾値を持たず、学習だけで同定する元pure契約を維持します。敵対的なOS親directory差替えまで隔離するsandboxではありません。詳細は [日付付き証拠](evidence/2026-11-07-printed-holdout-entry-independent.json) を参照してください。
