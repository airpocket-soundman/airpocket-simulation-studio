import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PRODUCT_RUBRIC,STATUS_CREDIT,UNTRACKED_CREDIT,validateRubric,estimateProductCompletion,observedTaskCounts} from '../src/product-estimate.js';
import {statusNames} from '../src/progress.js';

const real=()=>JSON.parse(readFileSync(new URL('../src/progress.json',import.meta.url),'utf8'));
const referenced=()=>[...new Set(PRODUCT_RUBRIC.flatMap(c=>c.elements.flatMap(e=>e.tasks)))];
const allIds=()=>[...new Set([...referenced(),...['P0','P1','P2','P3','P4','P5','P6']])];
const tasksAt=(status,ids=allIds())=>ids.map(id=>({id,status}));
const candidateRevision='a'.repeat(40);
const gatesFor=status=>PRODUCT_RUBRIC.find(c=>c.id==='MILESTONE').elements.map(e=>({id:e.gate,status,taskIds:['P0'],evidence:{verified:true,result:'passed',candidateRevision,manifestRevision:candidateRevision}}));
// The shipped rubric always contains elements no task tracks, so closure is exercised with a derived rubric.
const trackedRubric=()=>PRODUCT_RUBRIC.map(c=>({...c,elements:c.elements.map(e=>e.gate||e.tasks.length?e:{...e,tasks:['P0']})}));

test('rubric weights are fixed, sum to 100 and every element is bilingual, sourced and valid',()=>{
 assert.equal(validateRubric(),true);
 assert.equal(PRODUCT_RUBRIC.reduce((s,c)=>s+c.weight,0),100);
 for(const c of PRODUCT_RUBRIC){assert.ok(c.source&&c.reasonJa&&c.reasonEn&&c.ja&&c.en,c.id);assert.ok(Math.abs(c.elements.reduce((s,e)=>s+e.weight,0)-1)<1e-9,c.id);}
 for(const plan of ['P0','P1','P2','P3','P4','P5','P6'])assert.ok(PRODUCT_RUBRIC.some(c=>c.anchor===plan),plan);
 const broken=(edit)=>{const copy=structuredClone(PRODUCT_RUBRIC);edit(copy);return copy;};
 assert.throws(()=>validateRubric(broken(r=>{r[0].weight=11;})),/sum to 100/);
 assert.throws(()=>validateRubric(broken(r=>{r[0].elements[0].weight=.5;})),/sum to 1/);
 assert.throws(()=>validateRubric(broken(r=>{r[1].id=r[0].id;})),/Invalid criterion/);
 assert.throws(()=>validateRubric(broken(r=>{r[0].elements[1].id=r[0].elements[0].id;})),/Invalid element/);
 assert.throws(()=>validateRubric(broken(r=>{r[0].elements[0].en='';})),/Missing label/);
 assert.throws(()=>validateRubric(broken(r=>{r.find(c=>c.id==='MILESTONE').elements[0].tasks=['P0'];})),/Gate element/);
 assert.throws(()=>validateRubric(PRODUCT_RUBRIC.filter(c=>c.id!=='P6').map(c=>({...c,weight:c.weight*100/94}))),/Missing plan P6/);
});
test('every task and gate the rubric cites exists in the current progress.json',()=>{
 const p=real(),ids=new Set(p.tasks.map(t=>t.id)),gates=new Set(p.publicationMilestone.gates.map(g=>g.id));
 for(const id of allIds())assert.ok(ids.has(id),'missing task '+id);
 for(const c of PRODUCT_RUBRIC)for(const e of c.elements)if(e.gate)assert.ok(gates.has(e.gate),'missing gate '+e.gate);
 assert.equal(gates.size,PRODUCT_RUBRIC.find(c=>c.id==='MILESTONE').elements.length);
 const r=estimateProductCompletion({candidateRevision,tasks:p.tasks,publicationMilestone:p.publicationMilestone});
 for(const c of r.criteria)for(const e of c.elements)assert.deepEqual(e.missing,[],e.id);
});
test('status credits are monotone in scenario and in progress, and untracked work earns nothing conservatively',()=>{
 for(const status of statusNames){const c=STATUS_CREDIT;assert.ok(c.low[status]<=c.central[status]&&c.central[status]<=c.high[status],status);}
 for(const level of ['low','central','high']){const c=STATUS_CREDIT[level];assert.ok(c.queued<=c.building&&c.building<=c.checking&&c.checking<=c.ready&&c.ready<=c.released);assert.ok(c.fixing<=c.checking);}
 assert.equal(STATUS_CREDIT.central.released<1,true);assert.deepEqual([UNTRACKED_CREDIT.low,UNTRACKED_CREDIT.central],[0,0]);assert.ok(UNTRACKED_CREDIT.high<STATUS_CREDIT.high.building);
});
test('estimate arithmetic: weights x element credit, with low <= central <= high',()=>{
 const none=estimateProductCompletion({candidateRevision,tasks:tasksAt('queued'),publicationMilestone:{status:'pending',gates:gatesFor('pending')}});
 assert.equal(none.estimate.raw.low,0);assert.equal(none.estimate.raw.central,0);assert.ok(none.estimate.raw.high>0&&none.estimate.raw.high<10);
 // One hand-computable criterion: P2 'versioned-cache' (P2,RUNTIMEWASM1) at central: mean 0.5*(.2+.9)... computed from the table below.
 const tasks=tasksAt('queued');tasks.find(t=>t.id==='P2').status='released';tasks.find(t=>t.id==='RUNTIMEWASM1').status='building';
 const r=estimateProductCompletion({candidateRevision,tasks,publicationMilestone:{status:'pending',gates:gatesFor('pending')}}),p2=r.criteria.find(c=>c.id==='P2'),el=p2.elements.find(e=>e.id==='versioned-cache');
 const credits=[STATUS_CREDIT.central.released,STATUS_CREDIT.central.building];assert.ok(Math.abs(el.credit.central-((credits[0]+credits[1])/2+Math.min(...credits))/2)<1e-12);
 assert.ok(Math.abs(p2.credit.central-.3*el.credit.central)<1e-12);
 // Only P2's 'versioned-cache' element earns credit here: 6 (criterion weight) x 0.3 (element weight) x its credit.
 assert.ok(Math.abs(r.estimate.raw.central-6*.3*el.credit.central)<1e-9);assert.ok(Math.abs(r.estimate.raw.central-r.criteria.reduce((s,c)=>s+c.weight*c.credit.central,0))<1e-12);
 for(const state of ['queued','building','checking','fixing','ready','released']){const e=estimateProductCompletion({candidateRevision,tasks:tasksAt(state),publicationMilestone:{status:'pending',gates:gatesFor('pending')}}).estimate;assert.ok(e.raw.low<=e.raw.central&&e.raw.central<=e.raw.high,state);assert.ok(e.display.low<=e.display.central&&e.display.central<=e.display.high,state);}
 const order=['queued','building','checking','ready','released'].map(s=>estimateProductCompletion({candidateRevision,tasks:tasksAt(s),publicationMilestone:{status:'pending',gates:gatesFor('pending')}}).estimate.raw.central);assert.deepEqual(order,[...order].sort((a,b)=>a-b));
 // A single queued task limits an element below its all-released credit (min term).
 const mixed=tasksAt('released');mixed.find(t=>t.id==='P3').status='queued';const m=estimateProductCompletion({candidateRevision,tasks:mixed,publicationMilestone:{status:'pending',gates:gatesFor('pending')}}),a=estimateProductCompletion({candidateRevision,tasks:tasksAt('released'),publicationMilestone:{status:'pending',gates:gatesFor('pending')}});assert.ok(m.estimate.raw.central<a.estimate.raw.central);
});
test('released tasks and the released ratio never make the product look complete',()=>{
 const everyTaskReleased=real().tasks.map(t=>({...t,status:'released'})),p=real();
 const r=estimateProductCompletion({candidateRevision,tasks:everyTaskReleased,publicationMilestone:p.publicationMilestone});
 assert.equal(r.observed.releasedShare,1);assert.equal(r.scope.complete,false);
 assert.ok(r.estimate.raw.central<91,'released credit is capped');assert.ok(r.estimate.display.central<100&&r.estimate.display.high<=99);
 assert.ok(r.unknowns.length>0&&r.scope.untrackedElements===r.unknowns.length);
 // Adding or splitting tasks changes the observed ratio but not the fixed weights.
 const split=[...everyTaskReleased,...Array.from({length:100},(_,i)=>({id:'EXTRA'+i,status:'queued'}))],s=estimateProductCompletion({candidateRevision,tasks:split,publicationMilestone:p.publicationMilestone});
 assert.ok(s.observed.releasedShare<r.observed.releasedShare);assert.equal(s.estimate.raw.central,r.estimate.raw.central);
 // Observed counts are plain counts, separate from the estimate object.
 assert.equal('observed' in r.estimate,false);assert.deepEqual(observedTaskCounts([{status:'ready'},{status:'ready'},{status:'queued'},{status:'weird'}]).counts,{queued:1,building:0,checking:0,fixing:0,ready:2,released:0});
 assert.equal(observedTaskCounts([]).releasedShare,null);
});
test('milestone gates close only on complete status, not on task status, and incomplete scope cannot reach 100',()=>{
 const base=gatesFor('pending'),tasks=tasksAt('released');
 const pending=estimateProductCompletion({candidateRevision,tasks,publicationMilestone:{status:'pending',gates:base}}).criteria.find(c=>c.id==='MILESTONE');
 assert.equal(pending.credit.low,0);assert.equal(pending.credit.central,0);assert.ok(pending.credit.high>0&&pending.credit.high<=.5);
 const oneDone=estimateProductCompletion({candidateRevision,tasks,publicationMilestone:{status:'pending',gates:base.map((g,i)=>i===0?{...g,status:'complete'}:g)}}).criteria.find(c=>c.id==='MILESTONE');
 assert.ok(Math.abs(oneDone.credit.central-1/6)<1e-12&&Math.abs(oneDone.credit.low-1/6)<1e-12);
 const none=estimateProductCompletion({candidateRevision,tasks,publicationMilestone:undefined}).criteria.find(c=>c.id==='MILESTONE');assert.equal(none.credit.central,0);assert.ok(none.elements.every(e=>!e.tracked));
 const allDone=estimateProductCompletion({candidateRevision,tasks,publicationMilestone:{status:'complete',gates:gatesFor('complete')}});
 assert.equal(allDone.scope.complete,false,'untracked rubric elements still block closure');assert.ok(allDone.estimate.display.central<100);
});
test('closure is the only way to reach 100, and any open item or missing task removes it',()=>{
 const rubric=trackedRubric(),done=()=>({tasks:tasksAt('released'),publicationMilestone:{status:'complete',gates:gatesFor('complete')},candidateRevision,rubric});
 const closed=estimateProductCompletion(done());assert.equal(closed.scope.complete,true);assert.equal(closed.estimate.display.central,100);assert.ok(Math.abs(closed.estimate.raw.central-100)<1e-9);assert.deepEqual(closed.unknowns,[]);
 const open=done();open.tasks.find(t=>t.id==='P3').status='ready';assert.equal(estimateProductCompletion(open).scope.complete,false);assert.ok(estimateProductCompletion(open).estimate.display.central<100);
 const milestone=done();milestone.publicationMilestone.status='pending';assert.equal(estimateProductCompletion(milestone).scope.complete,false);
 const gate=done();gate.publicationMilestone.gates[2].status='pending';assert.equal(estimateProductCompletion(gate).scope.complete,false);
 const missing=done();missing.tasks=missing.tasks.filter(t=>t.id!=='AGENTJOBS1');const m=estimateProductCompletion(missing);assert.equal(m.scope.complete,false);assert.equal(m.criteria.find(c=>c.id==='P3').elements.find(e=>e.id==='job-lifecycle').missing.includes('AGENTJOBS1'),true);
 const almost=done();almost.tasks.find(t=>t.id==='P6').status='released';almost.tasks.find(t=>t.id==='CFD3').status='checking';assert.ok(estimateProductCompletion(almost).estimate.display.high<=99);
});
test('the current repository state yields a bounded, honest estimate with its unknowns listed',()=>{
 const p=real(),r=estimateProductCompletion({candidateRevision,tasks:p.tasks,publicationMilestone:p.publicationMilestone});
 assert.equal(r.rubricVersion,1);assert.equal(r.scope.complete,false);assert.ok(r.estimate.display.central>0&&r.estimate.display.central<100);
 assert.ok(r.estimate.display.low<=r.estimate.display.central&&r.estimate.display.central<=r.estimate.display.high&&r.estimate.display.high<=99);
 assert.equal(r.observed.total,p.tasks.length);assert.equal(r.criteria.reduce((s,c)=>s+c.weight,0),100);
 assert.ok(r.unknowns.every(u=>u.source&&u.ja&&u.en));
 // The milestone criterion is exactly the share of gates marked complete; task status plays no part in it.
 const complete=p.publicationMilestone.gates.filter(g=>g.status==='complete'&&g.evidence?.verified===true&&g.evidence.result==='passed'&&g.evidence.candidateRevision===candidateRevision&&g.evidence.manifestRevision===candidateRevision).length;
 assert.ok(Math.abs(r.criteria.find(c=>c.id==='MILESTONE').credit.central-complete/6)<1e-12);
});

test('historical or unverified gate evidence never becomes current-candidate completion',()=>{
 const tasks=tasksAt('released'),gates=gatesFor('complete');
 const evaluate=(revision,rows=gates)=>estimateProductCompletion({tasks,publicationMilestone:{status:'complete',gates:rows},candidateRevision:revision});
 const matched=evaluate(candidateRevision).criteria.find(c=>c.id==='MILESTONE');assert.ok(Math.abs(matched.credit.central-1)<1e-12);
 for(const r of [undefined,'b'.repeat(40)]){const e=evaluate(r);assert.equal(e.criteria.find(c=>c.id==='MILESTONE').credit.central,0);assert.equal(e.scope.milestoneComplete,false);}
 for(const patch of [{verified:false},{result:'failed'},{manifestRevision:'b'.repeat(40)}]){
  const rows=gates.map(g=>({...g,evidence:{...g.evidence,...patch}}));assert.equal(evaluate(candidateRevision,rows).criteria.find(c=>c.id==='MILESTONE').credit.central,0);
 }
});
