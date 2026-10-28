import test from 'node:test';
import assert from 'node:assert/strict';
import {advancedStructuralProject,documentAdvancedStructural} from './fixtures/advanced-structural-projects.mjs';
import {analyzeProject} from '../scripts/headless-analysis.mjs';
import {createCaseSourceOperations} from '../src/case-source-operations.js';
import {createStudioApi} from '../src/studio-api.js';
import {getProjectRevision} from '../src/project-revision.js';
import {couplingChainFromCases,inspectSavedCaseChain} from '../src/coupling-chain.js';

// Saved case revision as case-operations computes it: hash of {name, output}.
const save=async(caseId,name,output)=>{const saved=JSON.parse(JSON.stringify({name,output}));return {caseId,name,output:saved.output,revision:await getProjectRevision(saved)};};
async function solveHeat(wall){
 const heat=advancedStructuralProject('thermalStress');heat.study={kind:'thermal',transient:false,volumetricSource:0};heat.materialProperties={conductivity:1};
 heat.conditions=heat.conditions.map(c=>({...c,type:'temperature',value:wall}));documentAdvancedStructural(heat);
 return save('heat','Heat',await analyzeProject(heat,{size:5}));
}
async function solveStress(heatCase){
 const api=createStudioApi();api.loadProject(advancedStructuralProject('thermalStress'));
 const ops=createCaseSourceOperations({studio:api,getCase:async()=>({...heatCase,assertCurrent(){}})});
 await ops.apply({expectedRevision:await getProjectRevision(api.exportProject()),caseId:heatCase.caseId,caseRevision:heatCase.revision,kind:'temperature'});
 return save('stress','Stress',await analyzeProject(api.exportProject(),{size:5}));
}

test('solved thermal->structural cases form a current chain from recorded case references',async()=>{
 const heat=await solveHeat(80),stress=await solveStress(heat);
 const {chain,diagnostics}=couplingChainFromCases([stress,heat]);
 assert.deepEqual(diagnostics,[]);
 assert.deepEqual(chain.find(s=>s.id==='stress'),{id:'stress',physics:'structural',revision:stress.revision,sources:[{from:'heat',kind:'temperature',revision:heat.revision}]});
 const r=inspectSavedCaseChain([stress,heat]);
 assert.equal(r.valid,true);assert.equal(r.current,true);assert.deepEqual(r.order,['heat','stress']);
});

test('re-solving the upstream thermal case with a changed input makes the saved stress case stale',async()=>{
 const heat=await solveHeat(80),stress=await solveStress(heat),changed=await solveHeat(90);
 assert.notEqual(changed.revision,heat.revision);
 const r=inspectSavedCaseChain([changed,stress]);
 assert.equal(r.valid,true);assert.equal(r.current,false);
 assert.deepEqual(r.stale,[{stage:'stress',reason:'source-revision-changed',from:'heat',kind:'temperature',recorded:heat.revision,current:changed.revision}]);
 // Re-applying the new thermal case and re-solving restores currency.
 const refreshed=await solveStress(changed);
 assert.equal(inspectSavedCaseChain([changed,refreshed]).current,true);
});

test('missing producer case or unmapped result kind is invalid, not current',async()=>{
 const heat=await solveHeat(80),stress=await solveStress(heat);
 const missing=inspectSavedCaseChain([stress]);
 assert.equal(missing.valid,false);assert.deepEqual(missing.diagnostics.map(d=>d.code),['COUPLING_SOURCE_UNKNOWN']);
 const odd=inspectSavedCaseChain([heat,{caseId:'x',revision:heat.revision,output:{result:{kind:'unknown'}}}]);
 assert.equal(odd.valid,false);assert.deepEqual(odd.diagnostics.map(d=>d.code),['COUPLING_CASE_UNSUPPORTED']);
 assert.equal(inspectSavedCaseChain(null).valid,false);
});
