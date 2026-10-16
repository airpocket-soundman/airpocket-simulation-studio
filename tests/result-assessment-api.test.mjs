import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createResultAssessmentApi} from '../src/result-assessment-api.js';
import {getProjectRevision} from '../src/project-operations.js';

const fatigueData={model:'stress-life',stressRatio:-1,snCurve:[{stressAmplitudePa:200e6,cycles:1e4},{stressAmplitudePa:100e6,cycles:1e6},{stressAmplitudePa:50e6,cycles:1e8}],ultimateStrengthPa:600e6,yieldStressPa:300e6,source:'Synthetic reference curve; not material design data',testConditions:'Fully reversed uniaxial elastic synthetic test, R=-1'};
const fractureData={model:'lefm-mode-i',toughnessRangePaSqrtM:[20000,30000],temperatureRangeC:[20,20],source:'Synthetic analytical reference only',testConditions:'Uniform tensile stress; infinite centre crack, Y=1',surfaceCondition:'Synthetic crack; residual stress specified separately'};
const fatigueOptions={minLoadFactor:-1,maxLoadFactor:1,appliedCycles:5000};
const fractureOptions={flawSizeRangeMm:[.1,.4],geometryFactorRange:[1,1],crackNormal:[0,0,1],residualNormalStressRangePa:[0,0],geometrySource:'Infinite centre crack; a is half crack length',stressAssumption:'Uniform uncracked nominal stress'};
function fixture(kind='fatigue'){return {input:{study:{kind:'structural',materialTemperature:20},materialProperties:{youngModulus:1e9,poissonRatio:0,...(kind==='fatigue'?{fatigueData:structuredClone(fatigueData)}:{fractureData:structuredClone(fractureData)})}},mesh:{tetrahedra:[[0,1,2,3],[0,1,2,3]]},result:{kind:'elastic',stresses:kind==='fatigue'?[[200e6,0,0,0,0,0],[100e6,0,0,0,0,0]]:[[0,0,1e6,0,0,0],[0,0,-1e6,0,0,0]],displacements:[[0,0,0]],materialEvaluation:{temperatureMin:20,temperatureMax:20}},calculation:{operation:'elastic',options:{size:5}}};}
function setup(initial=fixture()){let output=initial,busy=false,commits=0;const api=createResultAssessmentApi({getAnalysis:()=>output,isBusy:()=>busy,commit:next=>{output=next;commits++;}});return {api,get output(){return output;},get commits(){return commits;},setBusy:v=>busy=v,replace:v=>output=v};}
async function command(s,kind='fatigue',options=kind==='fatigue'?fatigueOptions:fractureOptions){return {kind,options:structuredClone(options),expectedResultRevision:await getProjectRevision(JSON.parse(JSON.stringify(s.output)))};}

test('revision-bound stress-life evaluation commits once and pages independently verified synthetic life',async()=>{
 const s=setup(),original=s.output,old=structuredClone(original),cmd=await command(s),r=await s.api.evaluate(cmd);
 assert.equal(s.commits,1);assert.deepEqual(original,old);assert.notEqual(s.output,original);assert.deepEqual(s.output.result.stresses,old.result.stresses);assert.deepEqual(s.output.result.displacements,old.result.displacements);
 assert.equal(r.previousResultRevision,cmd.expectedResultRevision);assert.equal(r.resultRevision,await getProjectRevision(s.output));assert.notEqual(r.resultRevision,r.previousResultRevision);assert.equal(r.summary.minLifeCycles,1e4);assert.equal(r.summary.maxDamage,.5);assert.deepEqual(r.provenance,fatigueData);assert.equal(r.lifeCycles,undefined);
 const page=await s.api.get({kind:'fatigue',expectedResultRevision:r.resultRevision,offset:1,limit:1});assert.equal(page.page.total,2);assert.equal(page.page.elements[0].index,1);assert.equal(page.page.elements[0].lifeCycles,1e6);assert.equal(page.page.elements[0].damage,.005);
 page.provenance.source='Changed';page.page.elements[0].lifeCycles=0;cmd.options.appliedCycles=0;assert.equal(s.output.result.fatigue.lifeCycles[1],1e6);assert.equal(s.output.calculation.options.fatigueAssessment.appliedCycles,5000);
 await assert.rejects(s.api.get({kind:'fatigue',expectedResultRevision:r.previousResultRevision}),/revision conflict/);
});
test('mode-I intensity uses mm to SI conversion and deterministic range provenance',async()=>{
 const s=setup(fixture('fracture')),r=await s.api.evaluate(await command(s,'fracture')),p=await s.api.get({kind:'fracture',limit:2});
 assert.ok(Math.abs(p.page.elements[0].intensityRangePaSqrtM[0]/(1e6*Math.sqrt(Math.PI*1e-4))-1)<1e-12);assert.deepEqual(p.page.elements[1].criticalFlawRangeMm,[null,null]);assert.equal(p.page.elements[0].classification,'uncertain');assert.deepEqual(r.summary.maxUtilizationRange,[0.5908179503018387,1.772453850905516]);assert.deepEqual(r.provenance,fractureData);assert.ok(r.limitations.some(x=>x.includes('not confidence')));
});
test('page bounds, absent assessment and unknown keys reject without writes; empty pages are bounded',async()=>{
 const s=setup(),discovery=await s.api.get({kind:'fatigue'});assert.equal(discovery.available,false);assert.equal(discovery.resultRevision,await getProjectRevision(s.output));assert.equal(discovery.summary,undefined);assert.equal(discovery.provenance,undefined);assert.deepEqual(discovery.page,{offset:0,limit:50,total:0,elements:[]});assert.equal(discovery.elementCount,2);await s.api.evaluate(await command(s));assert.equal((await s.api.get({kind:'fatigue'})).available,true);
 for(const args of [{offset:-1},{limit:201},{limit:1.5},{offset:Number.MAX_SAFE_INTEGER+1},{unexpected:true},{kind:'invented'}])await assert.rejects(s.api.get({kind:'fatigue',...args}));
 for(const args of [{offset:2},{offset:Number.MAX_SAFE_INTEGER},{limit:0}])assert.deepEqual((await s.api.get({kind:'fatigue',...args})).page.elements,[]);
 assert.equal(s.commits,1);
});
test('scope, missing registered material data and unknown options cannot alter displayed output',async()=>{
 for(const mutate of [o=>o.result.kind='modal',o=>o.input.study.modalAnalysis=true,o=>o.input.study.thermalStress=true,o=>o.result.plasticity={},o=>o.result.hyperelastic={},o=>o.result.stresses[0][1]=1e7,o=>delete o.input.materialProperties.fatigueData,o=>o.mesh.tetrahedra.pop()]){const o=fixture();mutate(o);const s=setup(o),old=structuredClone(o);await assert.rejects(s.api.evaluate(await command(s)));assert.deepEqual(s.output,old);assert.equal(s.commits,0);}
 const s=setup(),old=structuredClone(s.output);for(const cmd of [{...(await command(s)),extra:true},await command(s,'fatigue',{...fatigueOptions,invented:true}),await command(s,'fatigue',{...fatigueOptions,appliedCycles:NaN}),await command(s,'fatigue',null),await command(s,'fatigue',[])])await assert.rejects(s.api.evaluate(cmd));assert.equal(s.commits,0);assert.deepEqual(s.output,old);
});
test('busy, stale source, expired guards and edits during async revision leave assessment uncommitted',async()=>{
 const s=setup(),cmd=await command(s);s.setBusy(true);await assert.rejects(s.api.evaluate(cmd),/busy/);s.setBusy(false);await assert.rejects(s.api.evaluate({...cmd,expectedResultRevision:'sha256:stale'}),/revision conflict/);await assert.rejects(s.api.evaluate(cmd,{guard:()=>false}),/expired/);
 let checks=0;await assert.rejects(s.api.evaluate(cmd,{guard:()=>++checks===1}),/expired/);assert.equal(s.commits,0);
 const pending=s.api.evaluate(cmd);s.output.result.stresses[0][0]=100e6;await assert.rejects(pending,/changed/);assert.equal(s.commits,0);
 const t=setup(),tc=await command(t);let count=0;const api=createResultAssessmentApi({getAnalysis:()=>t.output,isBusy:()=>++count>1,commit:()=>assert.fail('busy commit')});await assert.rejects(api.evaluate(tc),/busy/);
});
test('recomputation detects saved assessment tampering and unknown fracture assumptions',async()=>{
 const s=setup(fixture('fracture'));await assert.rejects(s.api.evaluate(await command(s,'fracture',{...fractureOptions,unknown:1})));await s.api.evaluate(await command(s,'fracture'));s.output.result.fracture.intensityRangePaSqrtM[0][0]*=2;await assert.rejects(s.api.get({kind:'fracture'}),/does not match/);
});
test('source edits during the second hash and expired read snapshots are refused',async()=>{
 const output=fixture(),revision=await getProjectRevision(output);let reads=0,commits=0;
 const api=createResultAssessmentApi({getAnalysis:()=>{if(++reads===2)queueMicrotask(()=>{output.result.stresses[0][0]=100e6;});return output;},commit:()=>commits++});
 await assert.rejects(api.evaluate({kind:'fatigue',expectedResultRevision:revision,options:fatigueOptions}),/changed/);assert.equal(commits,0);assert.equal(output.result.fatigue,undefined);
 const s=setup();await s.api.evaluate(await command(s));const reading=s.api.get({kind:'fatigue'});s.replace(structuredClone(s.output));await assert.rejects(reading,/changed/);
});
test('evaluate and paged reads preserve and clone exploratory assessment limitations',async()=>{
 const metadata={schemaVersion:1,mode:'exploratory',provisional:true,completePreflight:false,remainingChecks:['Source applicability','Mesh dependence and physical accuracy']};
 for(const placement of ['top','result']){
  const o=fixture();if(placement==='top'){o.analysisAssessment=structuredClone(metadata);o.result.analysisAssessment={...structuredClone(metadata),remainingChecks:['Result fallback']};}else o.result.analysisAssessment=structuredClone(metadata);
  const s=setup(o),reply=await s.api.evaluate(await command(s));assert.deepEqual(reply.analysisAssessment,metadata);reply.analysisAssessment.provisional=false;reply.analysisAssessment.remainingChecks.push('Edited response');
  const page=await s.api.get({kind:'fatigue',limit:1});assert.deepEqual(page.analysisAssessment,metadata);page.analysisAssessment.remainingChecks.length=0;assert.deepEqual((await s.api.get({kind:'fatigue',limit:0})).analysisAssessment,metadata);
  assert.deepEqual(placement==='top'?s.output.analysisAssessment:s.output.result.analysisAssessment,metadata);assert.equal(s.output.result.fatigue.kind,'fatigue');
 }
});
test('empty assessment discovery preserves provenance status but rejects requested missing results',async()=>{
 for(const kind of ['fatigue','fracture']){
  const o=fixture(kind);o.analysisAssessment={mode:'exploratory',provisional:true,remainingChecks:['Physical accuracy']};const s=setup(o),r=await s.api.get({kind,offset:3,limit:0});assert.equal(r.available,false);assert.deepEqual(r.analysisAssessment,o.analysisAssessment);r.analysisAssessment.remainingChecks.length=0;assert.equal(o.analysisAssessment.remainingChecks.length,1);assert.deepEqual(r.page,{offset:3,limit:0,total:0,elements:[]});assert.equal(s.commits,0);
  o.calculation.options[kind+'Assessment']=kind==='fatigue'?fatigueOptions:fractureOptions;await assert.rejects(s.api.get({kind}),/request has no assessment/);
 }
});

test('live API (connector path) replaces an existing assessment and defaults omitted fatigue options; fracture options stay required',async()=>{
 const s=setup();await s.api.evaluate(await command(s));assert.equal(s.output.result.fatigue.appliedCycles,5000);
 const again=await s.api.evaluate({kind:'fatigue',expectedResultRevision:await getProjectRevision(JSON.parse(JSON.stringify(s.output)))});
 assert.equal(s.commits,2);assert.deepEqual([s.output.result.fatigue.minLoadFactor,s.output.result.fatigue.maxLoadFactor,s.output.result.fatigue.appliedCycles],[0,1,1]);assert.equal(again.summary.appliedCycles,1);
 const f=setup(fixture('fracture'));await assert.rejects(f.api.evaluate({kind:'fracture',expectedResultRevision:await getProjectRevision(JSON.parse(JSON.stringify(f.output)))}));assert.equal(f.commits,0);
});
