# エージェント運用を前提としたCAEの競合比較

[English](en/competitive-landscape.md)

調査日: 2026-10-14

[製品方針](product-direction.md)に合わせ、利用者自身の計算資源、インストール不要、自分のLLMエージェント、複数ソルバー、判断可能なAPI、設計へのフィードバックを軸に比較する。公開一次資料による比較であり、各製品の実行・精度・性能の横並び試験ではない。資料にない機能は非対応と断定せず未確認とする。

## 主な競合

### 項目別の比較

○: 対応を資料で確認。△: 部分対応・条件付き。×: 確認した提供方式では対象外。?: 未確認。目標列の○は製品要件であり実装済みではない。ツール数や対応物理分野数を、複数ソルバー選択への対応と同一視しない。

| 比較項目 | Airpocket現状 | Airpocket目標 | SimScale | PhysBox | mcp-calculix | FreeCAD MCP TESSA | FEAScript | Stabileo |
|---|---|---|---|---|---|---|---|---|
| 利用者の計算資源で解析 | ○ | ○ | × | ○ | ○ | ○ | ○ | ○ |
| ブラウザ利用で追加インストール不要 | ○ | ○ | ○ | ○ | × | × | △ | ○ |
| 自分のエージェントからAPI等で運用 | △ | ○ | ○ | ○ | ○ | ○ | △ | ? |
| MCPを提供 | ○ | ○ | ? | ○ | ○ | ○ | ? | ? |
| 開いたブラウザの解析セッションをエージェントが操作 | × | ○ | ? | ○ | △ | × | ? | ? |
| 接続用ソフト追加なしで自分のエージェントから運用 | × | ○ | △ | × | × | × | ? | ? |
| 複数の解析エンジンを利用 | ○ | ○ | ○ | ○ | △ | △ | △ | ? |
| 同一解析で独立ソルバーを選択・比較 | △ | ○ | ? | ? | × | △ | ? | ? |
| エージェント向け事前検査・構造化情報 | △ | ○ | △ | △ | ○ | △ | ? | ? |
| 設定の出所・仮定・未確認事項を一貫して保存 | △ | ○ | ? | ? | △ | ? | ? | ? |
| CAD変更と解析の反復 | △ | ○ | ○ | △ | △ | △ | ? | △ |
| CAEコアをWASM版・ネイティブ版として提供 | × | ○ | ? | ? | × | × | × | ? |
| 自由な再配布が可能なOSS方針 | ○ | ○ | × | × | ○ | ○ | ○ | △ |

判定の補足:

- Airpocket現状: MCPは保存JSON向け。独立エンジン比較は線形構造のAirpocket/MFEMに限定。根拠保存は材料出典等の部分対応。NodeでWASMを実行する経路は、ネイティブ機械語版の提供とは区別する。
- SimScale: 外部APIとクラウド上の複数計算基盤を確認。自分のエージェントから接続する開発・設定要件と、MCP提供は別事項。設定自動化だけで根拠保存の全要件を満たすとは判定しない。
- PhysBox: ブラウザ実行とMCP接続を確認。各アプリの回路・剛体等のエンジンは、同じ問題のソルバー比較とは異なる。PPPLの再配布制限によりOSS項目は×。
- mcp-calculix: 事前検査と単位・証跡に強い。Gmshはメッシャー、解析ソルバーはCalculiX。MCP Appの結果表示はライブブラウザ解析の操作とは異なる。CAD修正は外部側との組み合わせになる。
- FreeCAD MCP TESSA: 複数ソルバーの準備・出力を確認。実行・比較・CAD条件維持の全経路を確認したものではない。FreeCAD本体と拡張・各ソルバーの導入要件がある。
- FEAScript: ブラウザとNodeで使うJavaScriptライブラリ。Node対応はネイティブ機械語版ではない。CPU/WebGPUや線形解法の選択は独立したCAEソルバー比較とは区別する。
- Stabileo: OSS公開との記述は確認したが、この調査でライセンス全文を精査していないため自由な再配布の項目は△。設計反復は骨組モデルの編集・再計算に限定した判定。

根拠は末尾の一次資料と各製品の説明を参照する。?を×へ置き換えたり、○の数で精度・成熟度を順位付けしたりしない。

| 対象 | 分類 | 計算・導入 | エージェントと設計反復 | Airpocketに対する意味 |
|---|---|---|---|---|
| SimScale Engineering AIとSimulation API | 商用サービス | クラウド計算、Web UI | 自然言語による設定・後処理、外部API、カスタムエージェント、Onshape連携を公式に案内 | 初心者向けエージェントCAEとして直接競合。自分の計算資源とOSSが差別化候補 |
| PhysBox | 制限付きソース公開サービス | ブラウザWASM、MCP接続にはPythonの補助サーバー導入 | ローカルWebSocketでブラウザ操作、OpenSCAD・MuJoCo・Ngspice等を使う反復 | 接続構成が非常に近い。機構・回路・製作が中心で、応力・熱等のFEMとは分野が異なる |
| mcp-calculix | OSS、MCPサーバー部分はMIT | DockerまたはDenoとネイティブ環境、Gmsh・CalculiX | STEP、名前付き領域の事前検査、単位付き結果、入力と証跡の記録 | CAE専用MCPの直接比較対象。構造化結果・再現性はすでに競合が重視 |
| sandraschi/freecad-mcp | OSS候補、採用時のライセンス詳細確認が必要 | FreeCADとMCP環境、FEMにはCalculiX等 | FEM設定から結果取得までのツール、CAD操作、CFD関連ツールを文書化 | 自分のエージェントによるローカルCAD・CAEで近い。導入要件と検証済み範囲を比較したい |
| TESSA LABS freecad-mcp | OSS、MCP拡張はMIT | FreeCAD、アドオン、Python/MCP環境 | パラメータスイープ、名前付き境界、Elmer・CalculiX・OpenFOAM等への受け渡し | 複数ソルバー準備と設計反復で近い。ただしケース出力と実解析の完了を区別する |
| FEAScript | OSS、MIT | JavaScript、ブラウザまたはNode | FEM APIを提供。標準MCPとCAD設計反復は今回の資料では未確認 | ローカルWeb計算の比較対象。アプリやエージェント向け契約を組み合わせれば接近する |
| Stabileo | OSSとして公開 | ブラウザWASM、ローカル計算 | 構造編集と再計算。MCP運用は今回の資料では未確認 | 初回体験とローカル計算の比較対象。主に骨組構造で対象形状が異なる |

ソース公開されたMCPサーバーのライセンスと、同梱ソルバー・CADライブラリのライセンスは別である。PhysBoxはサイトでopen-sourceと表現する一方、PPPL-1.0で競合する独立サービス等への再配布を制限しているため、本比較では通常のOSSと区別する。

## 特に近い3つの競合

### SimScale

公式資料では、Engineering AIが解析設定・後処理を担当し、APIからの呼び出しと利用者側の文書・手順を使うカスタムエージェントに対応する。Onshape内から解析する連携も案内している。「AIが設定を支援する」「APIから解析する」「CADへ結果を戻す」だけでは差別化になりにくい。

Airpocketの目標との違いは、利用者のCPU/GPUによる実行とOSSである。外部エージェントからAPIを使えることと、任意のMCPクライアントから追加設定なしで使えることは別であり、後者は今回の資料では未確認。

### PhysBox

公式サイトはブラウザWASMとMCPによる反復を案内する。MCP補助サーバーを導入し、ローカルWebSocketで開いたブラウザへ命令を送る構成はAirpocketの接続検討に直接参考になる。ブラウザ利用とエージェント接続のインストール要件は区別する。

主要分野は回路、剛体・機構、CADと製作。MuJoCoでの衝突・機構評価を、連続体FEMによる応力解析と同一視しない。Airpocketは構造・熱・流体・音響の検証付きCAEワークフローで違いを示せる。ツール数やサイトの高精度表現だけで品質を評価しない。

### mcp-calculix

公開READMEは線形静解析、固有振動、線形座屈、Norton則クリープ、定常温度・変位連成を列挙する。名前付き領域の事前検査と、入力形状・要求・メッシュ・解析デッキ・診断・結果の証跡を重視する。物性や荷重は呼び出し側が与え、ソルバー観測から設計承認を自動生成しない構成を明示する。

Airpocketでは、これに初心者向けの質問・根拠付き設定提案、ブラウザ内実行、複数物理分野、CAD変更追跡を組み合わせる。ただし、これらは製品目標であり現状の優位を実証したものではない。

## 周辺サービスと連携候補

- [PhysicsX](https://www.physicsx.ai/platform): 数値解析と学習済み物理AIを組み合わせる企業向け基盤。高速な設計探索で競合するが、利用者のブラウザ内で任意の解析を実行する構成とは異なる。
- [Ansys Engineering Copilot](https://ansyshelp.ansys.com/public/Views/Secured/corp/v261/en/copilot_ug/copilot_ug_intro.html): 確認した公式ガイドでは学習・サポートが主用途。製品名にAIがあることだけで自律解析エージェントと同一視しない。
- [SolidCraft](https://github.com/bherbruck/solidcraft): CAD・パラメータ・STEP・MCPを持つ設計側の連携候補。
- [PartMode](https://github.com/BOMWiki/partmode): ブラウザOpenCascade WASMと型付きエージェント操作を掲げるCAD。ブラウザCADとの接続設計の比較候補で、CAEソルバー提供とは区別する。

## 差別化と実装優先度

差別化候補は「自分のエージェント」「自分の計算資源」「ブラウザから開始」「検証可能な複数ソルバー」「根拠と診断」「設計反復」の組み合わせである。本調査で全条件を満たす競合は確認できていないが、唯一性を主張する根拠にはしない。

現状はブラウザ内解析と保存JSON向けMCPがあり、ライブ接続・構造化診断の共通契約・根拠管理・CADとの自動反復は整備対象。多くのソルバーは候補で、現在選択できるAirpocketとMFEMの検証範囲を明示する。

1. ブラウザセッションと任意のエージェントをつなぐ。接続要件と通信される情報を公開する。
2. capabilities、事前検査、単位付き診断、修正候補を共通API・MCPに整える。
3. 入力の根拠、設計版、ソルバー版、結果と証跡を結び付ける。
4. SolidCraftで形状変更し、同じ条件で再解析する例題を公開する。
5. WASMの必要時取得・先読みと、初回・反復時の時間とメモリを測る。

## 今後の実比較

同じブラケットのSTEPと材料・荷重・支持を用意し、初期設定の負担、エージェントが質問すべき情報、拘束不足等の診断、面の変更後の条件維持、参照解との誤差、初回と反復の時間・メモリ、版固定と再現性を比較する。クラウドとローカルの時間は端末・回線・計算環境を記録して区別する。

## 一次資料

- [SimScale Engineering AI](https://www.simscale.com/product/engineering-ai/)
- [SimScale Simulation API](https://www.simscale.com/technology/simulation-api/)
- [SimScaleのCAD・API連携説明](https://www.simscale.com/blog/engineering-ai-explained/)
- [PhysBoxの構成とMCP導入](https://physbox.io/)
- [PhysBoxライセンス](https://physbox.io/license.html)
- [mcp-calculix](https://github.com/superWorldSavior/mcp-calculix)
- [mcp-calculix解析契約](https://github.com/superWorldSavior/mcp-calculix/blob/main/docs/analysis-contracts.md)
- [sandraschi FreeCAD MCPツール](https://github.com/sandraschi/freecad-mcp/blob/master/docs/mcp-tools.md)
- [TESSA LABS FreeCAD MCP](https://github.com/tessalabs-space/freecad-mcp)
- [FEAScript](https://github.com/FEAScript/FEAScript-core)
- [Stabileo](https://github.com/lambdaclass/stabileo)
