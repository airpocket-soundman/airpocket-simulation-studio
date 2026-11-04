import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identifyPrintedParametersByCondition as grouped} from '../src/printed-identification-groups.js';
import {independentPrintedHost as host,independentPrintedRaw as raw} from './helpers/printed-identification-independent-host.mjs';

test('source SHA cannot authenticate forged group conditions: every normalized source field remains bound to specimen identity',async()=>{
 for(const change of [c=>c.temperatureC=999,c=>c.speedMmPerSecond=2,c=>c.batch='different-but-valid',c=>c.dimensionsMm[0]=2,c=>c.gaugeLengthMm=9,c=>c.buildDirection=[1,0,0]]){const h=host();h.setOptions();try{const pending=h.ui.identify();await h.ready();const w=h.workers[0],r=await grouped(w.request.raw,w.request.options);change(r.grouping.groups[0].conditions);w.saved({data:{requestId:w.request.requestId,ok:true,result:r.identification,grouping:r.grouping}});assert.equal(await pending,false);assert.equal(h.ui.snapshot().phase,'invalid');assert.equal(h.ui.results.textContent,'');assert.equal(w.terminations,1);assert.equal(h.timers.size,0);}finally{h.close();}}
});

test('swapping condition-group memberships and their internally correct statistics still refuses a source-condition mismatch',async()=>{
 const d=JSON.parse(raw()),other=structuredClone(d.specimens[0]);other.id='independent-second';other.temperature=30;other.samples=other.samples.map(([t,f,u])=>[t,2*f,u]);d.specimens.push(other);const h=host(JSON.stringify(d));h.setOptions();try{const pending=h.ui.identify();await h.ready();const w=h.workers[0],r=await grouped(w.request.raw,w.request.options),[a,b]=r.grouping.groups;assert.equal(r.grouping.groups.length,2);[a.members,b.members]=[b.members,a.members];[a.statistics,b.statistics]=[b.statistics,a.statistics];w.saved({data:{requestId:w.request.requestId,ok:true,result:r.identification,grouping:r.grouping}});assert.equal(await pending,false);assert.equal(h.ui.snapshot().phase,'invalid');assert.equal(h.ui.results.textContent,'');assert.equal(w.terminations,1);}finally{h.close();}
});
