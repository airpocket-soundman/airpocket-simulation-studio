export const release={version:'v0.1',date:'2026-10-13',description:'3D領域設定と共通APIの試作版。解析計算は未実装。'};
export const tasks=[
 {id:'CAD1',title:'STEPをWASMで読み込む',status:'released',category:'3D',detail:'ブラウザ内のWorkerでSTEPをmmに変換し、表示三角形とCAD面の対応を取得。公開サイトで立方体の読み込みを確認。',evidence:'src/cad.worker.js'},
 {id:'VIEW1',title:'モデルを回転・拡大し、全体を表示',status:'released',category:'3D',detail:'回転、パン、ズーム、全体表示。狭い画面では縦並びに切り替える。',evidence:'src/main.js'},
 {id:'REG1',title:'曲面の一部分をブラシで選ぶ',status:'released',category:'3D',detail:'空間距離によるブラシ、消しゴム、面選択、戻す、面積表示。見えている領域を選択。CAD上の正確な分割と再メッシュへの転送は未対応。',evidence:'src/regions.js'},
 {id:'BC1',title:'固定と方向付き荷重を登録',status:'released',category:'構造',detail:'全方向固定と合計荷重の設定・領域再選択・削除。荷重方向を矢印で表示。設定保存のみで、まだ計算しない。',evidence:'src/main.js'},
 {id:'SAVE1',title:'プロジェクトの保存と復元',status:'released',category:'共通',detail:'表示形状・選択・条件・材料カテゴリをJSONに書き出し、復元。元のSTEPの正確なCAD形状そのものは保存しない。',evidence:'src/studio-api.js'},
 {id:'API1',title:'UIと共通APIで高速に検証',status:'released',category:'検証',detail:'領域選択、条件操作、保存復元の直接APIとNodeテスト。5件の自動テスト、公開時にも実行。',evidence:'docs/testing.md'},
 {id:'MESH1',title:'ブラウザで体積メッシュを生成',status:'queued',category:'構造',detail:'CADまたは閉じた表面から体積メッシュを生成。品質、局所細分化、部分領域への適合を検証。',depends:['REG2']},
 {id:'REG2',title:'選択領域をCADと解析メッシュに反映',status:'queued',category:'3D',detail:'表面上の領域を寸法で定義し、境界適合と面積誤差を検証。再メッシュ後も指定を維持。'},
 {id:'WASM1',title:'構造ソルバーのWASM移植を検証',status:'queued',category:'構造',detail:'CalculiX等の候補について依存・ビルド・メモリ・ライセンスを調査し、小規模例題をブラウザで実行。候補はまだ導入済みではない。'},
 {id:'FEM1',title:'固定と荷重から変形・応力を計算',status:'queued',category:'構造',detail:'線形静解析の縦通し。片持ち梁の理論値、反力、合力保存とメッシュ収束を確認。',depends:['MESH1','WASM1']},
 {id:'MAT1',title:'金属・樹脂・ガラス・ゴムの物性を設定',status:'queued',category:'材料',detail:'カテゴリだけでなく、出典・単位・有効条件・構成則を登録。ゴムの大変形、ガラスの破壊判定などは段階的に対応。'},
 {id:'SOLVER1',title:'対応するソルバーを選択・比較',status:'queued',category:'共通',detail:'移植と検証を通ったソルバーのみ選択可能。未対応の条件を列挙し、同条件の比較ケースを用意。',depends:['FEM1']},
 {id:'HEAT1',title:'熱伝導と温度変化を計算',status:'queued',category:'熱',detail:'定常・非定常熱伝導、温度・熱流束・発熱・対流境界。参照解とエネルギー収支で検証。'},
 {id:'ACOU1',title:'共鳴と周波数別の音圧を表示',status:'queued',category:'音響',detail:'Elmer等のブラウザ実行可否を確認。音源面・受音点・境界を設定し、空洞と管の共鳴を検証。'},
 {id:'CFD1',title:'流体領域を作り、流れを解析',status:'queued',category:'流体',detail:'まず単相・非圧縮・層流。OpenFOAM等の移植可能性を確認。質量収支と管の圧力損失を検証。'},
 {id:'GPU1',title:'WebGPUで計算を高速化',status:'queued',category:'共通',detail:'CPU版を成立させてから追加。専用計算処理の精度・収束・対応ブラウザを検証し、CPUへの切り替えを用意。',depends:['FEM1']},
 {id:'COUPLE1',title:'熱・構造・音響・流体をつなぐ',status:'queued',category:'連成',detail:'熱応力、振動からの音の放射、共役熱伝達を段階的に追加。メッシュ間の転送・保存則も検証。'},
 {id:'FAIL1',title:'破壊・疲労・接触・非線形を扱う',status:'queued',category:'構造',detail:'材料モデルと試験データに基づき、個別に検証。材料名や最大応力だけから破断を保証しない。'}
];
export const solvers=[
 ['CalculiX','構造・熱','WASM移植未検証'],['Elmer','構造・熱・流体・音響','WASM移植未検証'],['Code_Aster','高度な構造・熱・音響候補','WASM移植未検証'],['OpenFOAM','流体・共役熱伝達','WASM移植未検証'],['Gmsh','メッシュ生成','ブラウザ実行未検証'],['occt-import-js','STEP読込 / CAD表示','WASM実行確認済み']
];
export const stages=[['queued','順番を待っている','未着手'],['building','つくっている','実装中'],['checking','確かめている','検証中'],['fixing','直している','修正中'],['ready','次の版を待っている','検証済み・未公開'],['released','公開版に入っている','Pagesで利用できる']];
