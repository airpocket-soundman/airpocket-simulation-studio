import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserSession,connectBrowserSession,browserMethods} from '../src/browser-session.js';
import {createBrowserBridge} from '../scripts/browser-bridge.mjs';
import {createCaseStore} from '../src/cases.js';
import {createCaseOperations} from '../src/case-operations.js';
import {createStudioApi} from '../src/studio-api.js';
import {getBrowserOperationContracts} from '../src/browser-operation-contracts.js';
const output=shift=>({input:{version:1,meshes:[{positions:[0,0,0,1,0,0,0,1,0],faceIds:[0]}],conditions:[],study:{kind:'thermal'},materialProperties:{conductivity:1}},calculation:{operation:'elastic',options:{size:5,method:'pcg',adaptive:false,maxRounds:3}},mesh:{nodes:[0,0,0,1,0,0,0,1,0,0,0,1],tetrahedra:[[0,1,2,3]],surface:[{nodes:[0,1,2]}]},result:{kind:'thermal',minTemperature:20+shift,maxTemperature:50+shift,temperature:[20,30,40,50].map(v=>v+shift),flux:[[1,2,3]]}});
async function fixture(){const store=createCaseStore();store.add('A',output(0));store.add('B',output(10));const studio=createStudioApi();studio.loadProject({...output(0).input,name:'current input C'});let changes=0;const display={tag:'current unrelated display'},cases=createCaseOperations({store,view:()=>changes++,loadProject:()=>changes++,getAnalysis:()=>display,isBusy:()=>true}),session=createBrowserSession({studio,cases,isBusy:()=>true,analysis:{isBusy:()=>true}}),references=(await cases.list()).cases.map(row=>({caseId:row.caseId,expectedRevision:row.revision,field:'temperature'}));return {store,studio,display,cases,session,references,get changes(){return changes;}};}

test('caseCompare is inspect-only, discoverable and reads real saved cases while busy without altering inputs or display',async()=>{
 const h=await fixture(),before=h.studio.exportProject(),archive=h.store.export(),display=structuredClone(h.display),contracts=getBrowserOperationContracts({method:'caseCompare'}),contract=contracts.operations[0];
 assert.equal(browserMethods.caseCompare,'inspect');assert.equal(contract.scope,'inspect');assert.equal(contract.inputSchema.additionalProperties,false);assert.equal(contract.inputSchema.properties.references.minItems,1);assert.equal(contract.inputSchema.properties.references.maxItems,8);assert.equal(contract.inputSchema.properties.references.items.additionalProperties,false);assert.deepEqual(contract.sideEffects,[]);assert.equal(contract.units.vonMisesPa,'Pa');assert.equal(contract.units.equivalentPlasticStrain,'1');assert.ok(contract.limitations.some(t=>t.includes('65536')));
 const result=await h.session.call('caseCompare',{references:h.references,point:[.25,.25,.25]});assert.equal(result.comparison.comparable,true);assert.equal(result.references[0].measurement.values.temperature,35);assert.equal(result.references[1].measurement.values.temperature,45);assert.equal(result.comparison.deltas[0].values.temperature,10);assert.equal(result.references[0].selection.displayUnit,'degC');assert.equal(result.references[0].measurement.units.temperature,'degC');assert.ok(Buffer.byteLength(JSON.stringify(result))<=65536);
 assert.deepEqual(h.studio.exportProject(),before);assert.deepEqual(h.store.export(),archive);assert.deepEqual(h.display,display);assert.equal(h.changes,0);
 await assert.rejects(h.session.call('caseView',h.references[0]),/busy/);
 for(const args of [{references:h.references,unknown:true},{references:[...h.references,h.references[0]]},{references:[{...h.references[0],modeIndex:0}]},{references:[{...h.references[0],expectedRevision:'sha256:'+'0'.repeat(64)}]}])await assert.rejects(h.session.call('caseCompare',args));assert.deepEqual(h.store.export(),archive);
});

test('saved case leases and session disconnect or expiry reject asynchronous comparisons without mutating current state',async()=>{
 const h=await fixture(),before=h.studio.exportProject(),pending=h.session.call('caseCompare',{references:h.references,point:[.25,.25,.25]});h.session.disconnect();await assert.rejects(pending,/expired|revoked/i);assert.deepEqual(h.studio.exportProject(),before);assert.equal(h.changes,0);
 await assert.rejects(h.session.call('caseCompare',{references:h.references},{expiresAt:Date.now()-1}),/expired/);
 const original=crypto.subtle.digest;let changed=false;crypto.subtle.digest=function(...args){if(!changed){changed=true;h.store.remove(0);}return original.apply(this,args);};
 try{await assert.rejects(h.session.call('caseCompare',{references:h.references,point:[.25,.25,.25]}),/conflict|changed|unknown/i);}finally{crypto.subtle.digest=original;}
 assert.equal(changed,true);assert.deepEqual(h.studio.exportProject(),before);assert.equal(h.changes,0);
});

test('real loopback scope grants permit case comparison but refuse it for view-only sessions',async()=>{
 const origin='https://comparison.example',bridge=await createBrowserBridge({origin,timeoutMs:2000}),h=await fixture();let client;
 try{
  const paired=await(await fetch(bridge.endpoint+'/pair',{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+bridge.pairingToken,'Content-Type':'application/json'},body:JSON.stringify({scopes:['view']})})).json();await assert.rejects(bridge.call(paired.sessionId,'caseCompare',{references:h.references},browserMethods.caseCompare),e=>e.code==='BROWSER_SCOPE_REFUSED');
  client=connectBrowserSession({endpoint:bridge.endpoint,pairingToken:bridge.pairingToken,scopes:['inspect'],session:h.session,intervalMs:2,fetcher:(url,options)=>fetch(url,{...options,headers:{...options.headers,Origin:origin}})});
  const {sessionId}=await client.ready,result=await bridge.call(sessionId,'caseCompare',{references:h.references,point:[.25,.25,.25]},browserMethods.caseCompare);assert.equal(result.comparison.deltas[0].values.temperature,10);assert.equal(h.changes,0);
 }finally{client?.stop();await bridge.close();}
});


test('browser comparison preserves raw Pa independently from viewer MPa and accepts the actual long GPU engine label',async()=>{
 const saved=output(0);saved.input.study={kind:'structural'};saved.input.materialProperties={youngModulus:1e9,poissonRatio:0};saved.result={kind:'elastic',engine:'Airpocket Tet4 / WebGPU float32 + WASM CPU float64 correction',maxDisplacementMm:0,maxVonMisesPa:1e6,displacement:Array(12).fill(0),magnitudes:Array(4).fill(0),vonMises:[1e6]};
 const store=createCaseStore();store.add('GPU saved',saved);const cases=createCaseOperations({store,isBusy:()=>true}),reference=(await cases.list()).cases[0],session=createBrowserSession({cases,isBusy:()=>true}),row=(await session.call('caseCompare',{references:[{caseId:reference.caseId,expectedRevision:reference.revision,field:'stress'}],point:[.25,.25,.25]})).references[0];
 assert.equal(row.selection.displayUnit,'MPa');assert.equal(row.measurement.units.vonMisesPa,'Pa');assert.equal(row.measurement.values.vonMisesPa,1e6);assert.equal(row.calculation.engine,saved.result.engine);
});
