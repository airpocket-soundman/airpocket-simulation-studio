import {statusNames} from './progress.js';

/* Estimated progress toward the FULL product target (docs/roadmap.md P0-P6 plus the
 * backlog and common completion gates). This is a fixed, judgment-based rubric over
 * self-reported task status, not a measurement. The released-task ratio is reported
 * separately as an observation and is never an input to the estimate. */
export const RUBRIC_VERSION=1;
// Status -> credit for one task, three scenarios. low is a conservative assumption over self-reported
// statuses, high is optimistic, central is the stated estimate. A released task is
// capped below 1 because releasing one task does not close a product-level acceptance
// criterion; full credit exists only under closure (see below).
export const STATUS_CREDIT=Object.freeze({
 low:{queued:0,building:0,checking:.25,fixing:.1,ready:.6,released:.8},
 central:{queued:0,building:.2,checking:.5,fixing:.35,ready:.75,released:.9},
 high:{queued:.05,building:.4,checking:.75,fixing:.6,ready:.9,released:1}
});
// An element no task tracks is unknown: it earns nothing unless the optimistic case allows a little.
export const UNTRACKED_CREDIT=Object.freeze({low:0,central:0,high:.2});
// A gate that is not complete earns 0 except in the optimistic case (half its tasks' credit).
export const PENDING_GATE_HIGH_FACTOR=.5;
const PLAN_IDS=['P0','P1','P2','P3','P4','P5','P6'];
const E=(id,ja,en,weight,tasks=[],gate)=>({id,ja,en,weight,tasks,...(gate?{gate}:{})});

export const PRODUCT_RUBRIC=Object.freeze([
 {id:'P0',weight:10,anchor:'P0',source:'docs/roadmap.md 優先順位と依存関係 P0; docs/api-coverage.md',ja:'P0 対応能力・操作契約・診断',en:'P0 Capabilities, operation contracts, diagnostics',
  reasonJa:'公開前優先順位1で全入力・LLM操作の前提。',reasonEn:'Prerequisite for every input and LLM operation (pre-release priority 1).',elements:[
  E('operation-contracts','GUI/API/MCPの操作対応と機械取得できる契約','GUI/API/MCP operation matrix and machine-readable contracts',.35,['P0','API1','MCP1','BROWSERCONTRACTS1','ASSESSMENTAPI1']),
  E('capabilities-diagnostics','実行環境別の能力・構造化診断','Per-environment capabilities and structured diagnostics',.3,['P0','EXECUTIONDIAGNOSTICS1','RUNTIMEIDENTITY1','NODERUNTIMEINFO1']),
  E('nested-schemas','入れ子の物理スキーマの完全化（進捗に専用タスクなし）','Complete nested physical schemas (no dedicated task)',.2),
  E('compatibility-decision','API版・保存形式の互換性方針の決定（判断項目）','API and save-format compatibility decision (open decision item)',.15)]},
 {id:'P1',weight:12,anchor:'P1',source:'docs/roadmap.md P1; docs/product-direction.md 根拠と仮定の保存',ja:'P1 入力作成・根拠・事前検査',en:'P1 Input creation, provenance, preflight',
  reasonJa:'初心者がLLMで解析を成立させる中心機能。',reasonEn:'Core of beginners getting an analysis through their LLM.',elements:[
  E('input-operations','画面座標なしの入力作成・編集・取込','Input creation, edit and import without screen coordinates',.3,['AGENTINPUT1','AGENTEDIT1','EDITPREVIEW1','INPUTINSPECTION1','BROWSERINPUTIMPORT1']),
  E('provenance','根拠・仮定・確認状態の契約','Provenance, assumption and confirmation contracts',.3,['P1','PROVENANCECONTRACT1','STRUCTURALPROVENANCE1','ADVANCEDSTRUCTURALPROVENANCE1','THERMALPROVENANCE1','WAVEFLUIDPROVENANCE1']),
  E('preflight','解析前検査・未解決領域の拒否','Preflight checks and rejection of unresolved regions',.25,['P1','PLANARROTATION1','MESHARRAYLIMIT1','REG2P']),
  E('post-mesh-material-checks','メッシュ後の境界/拘束検査・物理資料の適用性（専用タスクなし）','Post-mesh boundary/constraint checks and material applicability (no dedicated task)',.15)]},
 {id:'P2',weight:6,anchor:'P2',source:'docs/roadmap.md P2; PERF1',ja:'P2 必要時取得・実行準備・性能',en:'P2 On-demand loading, preparation, performance',
  reasonJa:'ロードマップが公開前提にしないと明記。',reasonEn:'The roadmap says it is not a release prerequisite beyond what the main path needs.',elements:[
  E('versioned-cache','版・ハッシュ・キャッシュと必要時取得','Versions, hashes, cache and on-demand loading',.3,['P2','RUNTIMEWASM1']),
  E('performance-measurement','代表条件の性能測定と対応規模の決定','Fixed-condition performance measurement and supported-size decision',.4,['PERF1']),
  E('resource-failure-paths','容量不足・中止・解放の検証（専用タスクなし）','Capacity failure, abort and release verification (no dedicated task)',.3)]},
 {id:'P3',weight:12,anchor:'P3',source:'docs/roadmap.md P3 と判断を要する項目（セッション接続）',ja:'P3 共通ジョブ・中間結果・ブラウザ接続',en:'P3 Shared jobs, intermediate results, browser sessions',
  reasonJa:'公開前優先順位2。LLMが観測して再設定する中核。',reasonEn:'Pre-release priority 2: the LLM observe-and-reconfigure loop.',elements:[
  E('job-lifecycle','ジョブ状態・中止・終了・解放','Job state, cancel, settle and release',.25,['P3','AGENTJOBS1','GUIJOBS1','JOBSETTLEMENT1','HEADLESSLIFECYCLE1','PROCESSISOLATION1']),
  E('observation-pipeline','中間観測の保持・上限・取得','Intermediate observation retention, bounds and retrieval',.3,['P3OBSERVATIONLIFECYCLE1','OBSERVATIONQUEUE1','JOBEVENTBYTES1','OBSERVATIONPROFILES1','INTERMEDIATEBODY1','BROWSERFIELDS1']),
  E('browser-session','標準ブラウザとの接続と診断','Connection to the ordinary browser and diagnostics',.25,['BROWSERBRIDGE1','BROWSERCONNECTOR1','CONNECTIONDIAGNOSTICS1']),
  E('https-restart-backpressure','公開HTTPS接続の実環境確認・再起動越し復元・Worker背圧（専用タスクなし）','Public HTTPS pairing, restart recovery, Worker backpressure (no dedicated task)',.2)]},
 {id:'P4',weight:10,anchor:'P4',source:'docs/roadmap.md P4; docs/result-viewer-direction.md',ja:'P4 結果の保存・比較・ビュー・出力',en:'P4 Saved results, comparison, views, export',
  reasonJa:'公開前優先順位3・4。',reasonEn:'Pre-release priorities 3 and 4.',elements:[
  E('saved-results','結果の取得・保存・復元・検証','Result retrieval, saving, restoring, verification',.3,['CASEOPS1','CASEARCHIVE1','CASEVIEWBUNDLE1','CASEMEASUREMENTBUNDLE1','MEASUREMENTVERIFY1','MEASUREMENTHISTORY1','JOBRESULTEXPORT1']),
  E('view-control','色範囲・カメラ・時刻・ビュー復元','Color range, camera, time and view restore',.3,['P4','RESULTCONTROL1','NAMEDVIEWS1','VIEWCOMPARE','VIEWTIME']),
  E('reproducible-export','再現可能な画像/動画出力','Reproducible image and video export',.25,['BROWSEREXPORT1','VISUAL1']),
  E('video-formats-remeasure','MP4/GIFの能力宣言・同一点再測定比較（専用タスクなし）','MP4/GIF capability declaration and same-point remeasure comparison (no dedicated task)',.15)]},
 {id:'P5',weight:6,anchor:'P5',source:'docs/roadmap.md P5; docs/product-direction.md SolidCraftとの設計反復',ja:'P5 ブラケット3案のCAD設計反復',en:'P5 Three-bracket CAD iteration',
  reasonJa:'公開後続と明記されている統合例題。',reasonEn:'Explicitly a post-release integration example.',elements:[
  E('cad-iteration','CAD更新・領域の再照合・再解析','CAD update, region reconciliation, re-analysis',.4,['P5','CADUPDATEAPI1','CAD2']),
  E('solidcraft-exchange','SolidCraftとのSTEP交換（外部APIは未検証・専用タスクなし）','SolidCraft STEP exchange (external API unverified, no dedicated task)',.3),
  E('three-design-comparison','3案の比較と出力の一巡（専用タスクなし）','Three-design comparison and export round trip (no dedicated task)',.3)]},
 {id:'P6',weight:6,anchor:'P6',source:'docs/roadmap.md P6; docs/native-solvers.md',ja:'P6 WASM・ネイティブ共通コア実証',en:'P6 Shared WASM/native core proof',
  reasonJa:'ロードマップが公開前提にしないと明記。',reasonEn:'The roadmap says not to make general native completion a release prerequisite.',elements:[
  E('native-proof','固定棒でのWASM/ネイティブ数値比較','Fixed-bar WASM versus native numerical comparison',.5,['P6','NATIVEPROOF1']),
  E('shared-core','検査・単位・診断の共通コア化（専用タスクなし）','Shared validation/units/diagnostics core (no dedicated task)',.3),
  E('native-arbitrary-input','任意保存入力のネイティブ実行（未対応）','Native execution of arbitrary saved input (unsupported)',.2)]},
 {id:'COMMON',weight:8,anchor:null,source:'docs/roadmap.md 全段階の完了判定 1-4',ja:'共通完了判定（参照値・実画面・失敗後保持・日英）',en:'Common completion gates (references, real UI, failure retention, JP/EN)',
  reasonJa:'全段階に共通の4条件。',reasonEn:'Four conditions shared by every plan.',elements:[
  E('reference-values','参照値・許容差・入力スナップショットの保存','Reference values, tolerances, input snapshots',.3,['NUMERICREFERENCE1','QA1']),
  E('published-browser-verification','公開画面でのブラウザ検証と進捗照合','Published-page browser verification and progress verification',.3,['PUBLISHEDPROGRESS1','PUBLICATIONGATES1']),
  E('failure-resource-retention','不正入力・中止後の状態保持と資源解放','State retention and resource release after invalid input or abort',.2,['EXECUTIONDIAGNOSTICS1','HEADLESSLIFECYCLE1']),
  E('bilingual-ui','日英表示・文書','Japanese/English UI and documents',.2,['I18N1','I18N2'])]},
 {id:'MILESTONE',weight:8,anchor:null,source:'src/progress.json publicationMilestone（6ゲート）; docs/roadmap.md 公開前の優先順位',ja:'公開マイルストーンの6ゲート',en:'Publication milestone, six gates',
  reasonJa:'ゲートは証跡付きでのみ完了。タスク状態では閉じない。',reasonEn:'A gate closes only with candidate-bound evidence, never by task status.',elements:[
  E('gate-publication-infrastructure','ゲート0 公開基盤','Gate 0 publication infrastructure',1/6,[],'publication-infrastructure'),
  E('gate-existing-input-contracts','ゲート1 既存入力契約','Gate 1 existing input contracts',1/6,[],'existing-input-contracts'),
  E('gate-ordinary-browser-https','ゲート2 標準ブラウザ/HTTPS','Gate 2 ordinary browser / HTTPS',1/6,[],'ordinary-browser-https'),
  E('gate-saved-results-comparison','ゲート3 保存結果・比較','Gate 3 saved results and comparison',1/6,[],'saved-results-comparison'),
  E('gate-reproducible-view-export','ゲート4 再現可能なビュー・出力','Gate 4 reproducible view and export',1/6,[],'reproducible-view-export'),
  E('gate-skill-end-to-end','ゲート5 Skillによる一巡','Gate 5 Skill end-to-end',1/6,[],'skill-end-to-end')]},
 {id:'FLOW',weight:6,anchor:null,source:'docs/roadmap.md 次に導入するソルバーの最優先対象; docs/compressible-cfd-plan.md',ja:'最優先ソルバー: 慣性を含む外部流れ',en:'Priority solver: external flow with inertia',
  reasonJa:'公開後のソルバー導入で第一優先と明記。',reasonEn:'Stated as first priority for solver work after release.',elements:[
  E('oss-evaluation','既存OSSの評価と契約固定','Existing-OSS evaluation and contract',.25,['CFDRESEARCH1','CFDRESEARCH2','CFDRESEARCH3']),
  E('reference-problems','単純形状の参照問題（抗力・質量収支・依存）','Reference problems (drag, mass balance, dependence)',.25,['CFD2','CFD3','STOKES2']),
  E('solid-meshing','複雑固体のメッシュ成立性と共通入力接続','Complex-solid meshing feasibility and shared-input connection',.25,['CFDMESH1','STLMESH1']),
  E('field-retrieval-video','速度・圧力・断面のAPI取得と物理時刻動画（専用タスクなし）','Velocity/pressure/section API retrieval and physical-time video (no dedicated task)',.25)]},
 {id:'BACKLOG',weight:8,anchor:null,source:'docs/roadmap.md 既存バックログと拡張の扱い',ja:'既存バックログ（領域・流体・連成・造形）',en:'Existing backlog (regions, fluids, coupling, printing)',
  reasonJa:'限定機能の残りの完成度。',reasonEn:'Remaining completeness of deliberately limited features.',elements:[
  E('regions-meshing','MESH1・REG2・CFDPORT1','MESH1, REG2, CFDPORT1',.25,['MESH1','REG2','CFDPORT1']),
  E('general-fluids','CFD1・CFD2・CFD3・CFDMESH1','CFD1, CFD2, CFD3, CFDMESH1',.25,['CFD1','CFD2','CFD3','CFDMESH1']),
  E('coupling-contact-failure','連成・接触・破壊','Coupling, contact, failure',.3,['COUPLE1','COUPLE3','COUPLE4B','COUPLE5','CONTACT1','FAIL1']),
  E('printed-parts','PRINT2 造形物の構造解析','PRINT2 printed-part structural analysis',.2,['PRINT2'])]},
 {id:'UI',weight:4,anchor:null,source:'docs/roadmap.md 後続タスク: 既存CAEのUI研究と改良',ja:'UI研究と改良',en:'UI research and improvement',
  reasonJa:'LLM機能の後続と明記。',reasonEn:'Explicitly follows the LLM-facing work.',elements:[
  E('ui-research','UIRESEARCH1 調査と改善案','UIRESEARCH1 study and proposals',.4,['UIRESEARCH1']),
  E('ui-improvement','UIIMPROVE1 改良と前後比較','UIIMPROVE1 improvements and before/after comparison',.6,['UIIMPROVE1'])]},
 {id:'EXTENSIONS',weight:4,anchor:null,source:'docs/compressible-cfd-plan.md; docs/solvers.md',ja:'追加ソルバー・圧縮性・メッシュフリー',en:'Additional solvers, compressible flow, meshfree',
  reasonJa:'後段の拡張と明記。',reasonEn:'Explicitly later-stage extensions.',elements:[
  E('compressible-meshfree','圧縮性（Mach 2・衝撃波）・メッシュフリー（専用タスクなし）','Compressible (Mach 2, shocks) and meshfree (no dedicated task)',.5),
  E('solver-adoption','追加構造・熱ソルバーの採用とGPU','Additional structural/thermal solver adoption and GPU',.5,['SOLVER1','GPU1'])]}
]);

/** Throws if the fixed rubric is not internally consistent. */
export function validateRubric(rubric=PRODUCT_RUBRIC){
 const ids=new Set(),elementIds=new Set();let total=0;
 for(const c of rubric){
  if(ids.has(c.id)||!(c.weight>0))throw Error('Invalid criterion '+c.id);ids.add(c.id);total+=c.weight;
  const sum=c.elements.reduce((s,e)=>s+e.weight,0);if(Math.abs(sum-1)>1e-9||!c.elements.length)throw Error('Element weights of '+c.id+' must sum to 1');
  for(const e of c.elements){if(elementIds.has(e.id)||!(e.weight>0))throw Error('Invalid element '+e.id);elementIds.add(e.id);if(e.gate&&e.tasks.length)throw Error('Gate element '+e.id+' takes its tasks from the gate');if(!e.ja||!e.en)throw Error('Missing label '+e.id);}
 }
 if(Math.abs(total-100)>1e-9)throw Error('Criterion weights must sum to 100');
 for(const plan of PLAN_IDS)if(!rubric.some(c=>c.anchor===plan))throw Error('Missing plan '+plan);
 return true;
}
/** Observed facts only: how many tasks are in each status. Not an estimate. */
export function observedTaskCounts(tasks){
 const counts=Object.fromEntries(statusNames.map(status=>[status,0]));for(const task of tasks)if(counts[task.status]!==undefined)counts[task.status]++;
 return {counts,total:tasks.length,releasedShare:tasks.length?counts.released/tasks.length:null};
}
const blend=values=>values.length?(values.reduce((s,v)=>s+v,0)/values.length+Math.min(...values))/2:0;
/** Estimate completion toward the full product target from live tasks and the
 * publication milestone. Credit per element is (mean+min)/2 of its tasks' credits.
 * Without closure the displayed value can never reach 100. */
export function estimateProductCompletion({tasks,publicationMilestone,candidateRevision,rubric=PRODUCT_RUBRIC}){
 validateRubric(rubric);
 const status=new Map(tasks.map(t=>[t.id,t.status])),gates=new Map((publicationMilestone?.gates||[]).map(g=>[g.id,g]));
 const gateCurrent=gate=>gate?.status==='complete'&&gate.evidence?.verified===true&&gate.evidence?.result==='passed'&&/^[a-f0-9]{40}$/.test(candidateRevision??'')&&gate.evidence.candidateRevision===candidateRevision&&gate.evidence.manifestRevision===candidateRevision;
 const resolved=rubric.map(c=>({c,elements:c.elements.map(e=>{
  const gate=e.gate?gates.get(e.gate)??null:null,ids=e.gate?(gate?.taskIds??[]):e.tasks;
  const items=ids.map(id=>({id,status:status.get(id)??null})),missing=items.filter(i=>i.status===null).map(i=>i.id);
  return {e,gate,items,missing,tracked:e.gate?gate!==null:ids.length>0&&!missing.length};
 })}));
 const untracked=resolved.flatMap(r=>r.elements.filter(x=>!x.tracked).map(x=>({criterion:r.c.id,element:x.e.id,ja:x.e.ja,en:x.e.en,source:r.c.source})));
 const anchorsOpen=PLAN_IDS.filter(id=>status.get(id)!=='released');
 const open=resolved.flatMap(r=>r.elements.flatMap(x=>x.e.gate?(gateCurrent(x.gate)?[]:[x.e.id]):x.items.filter(i=>i.status!=='released').map(i=>i.id)));
 const milestoneComplete=publicationMilestone?.status==='complete'&&resolved.flatMap(r=>r.elements.filter(x=>x.e.gate)).every(x=>gateCurrent(x.gate));
 const closed=!untracked.length&&!anchorsOpen.length&&milestoneComplete&&!open.length;
 const credit=(level,item)=>item.status===null?UNTRACKED_CREDIT[level]:(level==='central'&&closed&&item.status==='released'?1:STATUS_CREDIT[level][item.status]);
 const elementCredit=(level,x)=>{
  if(x.e.gate){
   if(!x.gate)return UNTRACKED_CREDIT[level];
   if(gateCurrent(x.gate))return 1;
   return level==='high'?blend(x.items.map(i=>credit('high',i)))*PENDING_GATE_HIGH_FACTOR:0;
  }
  if(!x.e.tasks.length)return UNTRACKED_CREDIT[level];
  return blend(x.items.map(i=>credit(level,i)));
 };
 const criteria=resolved.map(({c,elements})=>{
  const out=elements.map(x=>({id:x.e.id,ja:x.e.ja,en:x.e.en,weight:x.e.weight,tracked:x.tracked,gate:x.e.gate?{id:x.e.gate,status:x.gate?.status??null,currentEvidence:gateCurrent(x.gate),evidenceRevision:x.gate?.evidence?.candidateRevision??null}:null,tasks:x.items,missing:x.missing,credit:{low:elementCredit('low',x),central:elementCredit('central',x),high:elementCredit('high',x)}}));
  const score=level=>out.reduce((s,e)=>s+e.weight*e.credit[level],0);
  return {id:c.id,ja:c.ja,en:c.en,weight:c.weight,source:c.source,reasonJa:c.reasonJa,reasonEn:c.reasonEn,elements:out,credit:{low:score('low'),central:score('central'),high:score('high')}};
 });
 const total=level=>criteria.reduce((s,c)=>s+c.weight*c.credit[level],0),cap=closed?100:99;
 const raw={low:total('low'),central:total('central'),high:total('high')};
 return {
  rubricVersion:RUBRIC_VERSION,
  // Estimate, in percent of the full target. low <= central <= high by construction.
  estimate:{raw,display:{low:Math.min(cap,Math.floor(raw.low)),central:Math.min(cap,Math.round(raw.central)),high:Math.min(cap,Math.ceil(raw.high))}},
  scope:{complete:closed,untrackedElements:untracked.length,openPlanTasks:anchorsOpen,milestoneComplete,openItems:open.length},
  criteria,unknowns:untracked,
  // Observation, kept apart from the estimate on purpose.
  observed:observedTaskCounts(tasks)
 };
}
