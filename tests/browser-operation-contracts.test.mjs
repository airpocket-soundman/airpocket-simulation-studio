import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getBrowserOperationContracts} from '../src/browser-operation-contracts.js';
import {browserMethods} from '../src/browser-session.js';
import {createStudioApi} from '../src/studio-api.js';
import {getCapabilities} from '../src/capabilities.js';

test('bounded contract discovery covers every executable method exactly once with the actual permission scope',()=>{
 const found=[];let offset=0;do{const page=getBrowserOperationContracts({offset,limit:10});assert.ok(new TextEncoder().encode(JSON.stringify(page)).length<=page.maxPageBytes);assert.equal(page.declarationOnly,true);for(const c of page.operations){assert.equal(c.scope,browserMethods[c.method]);assert.ok(c.description&&c.inputSchema.type==='object');for(const key of c.revisionFields)assert.ok(Object.hasOwn(c.inputSchema.properties,key),c.method+': '+key);found.push(c.method);}offset=page.nextOffset;}while(offset!==null);
 assert.deepEqual(found,Object.keys(browserMethods));assert.equal(found.length,82);
 const scoped=getBrowserOperationContracts({scope:'analyze',limit:10});assert.ok(scoped.operations.every(c=>c.scope==='analyze'));assert.equal(scoped.total,Object.values(browserMethods).filter(s=>s==='analyze').length);
 assert.equal(getBrowserOperationContracts({method:'edit',scope:'inspect'}).total,0);
});
test('contract reads require no model or grant and return detached declarations with explicit revision/units/effects',()=>{
 const api=createStudioApi(),response=api.getBrowserOperationContracts({method:'createBuiltinProject'}),entry=response.operations[0];assert.equal(api.getSummary().loaded,false);assert.ok(entry.inputSchema.required.includes('expectedRevision'));assert.ok(entry.sideEffects.length);assert.equal(entry.units['source.bounds'],'mm');entry.inputSchema.required.push('invented');entry.sideEffects.length=0;assert.ok(!api.getBrowserOperationContracts({method:entry.method}).operations[0].inputSchema.required.includes('invented'));
 assert.equal(getCapabilities().connector.operationContracts.methodCount,82);assert.equal(getCapabilities().connector.operationContracts.mcp,'studio_browser_contracts');
});
test('invalid and accessor contract queries are rejected before reading untrusted properties',()=>{
 for(const q of [null,[],new Date(),{method:'eval'},{scope:'admin'},{limit:0},{limit:11},{offset:-1},{offset:83},{unknown:1}])assert.throws(()=>getBrowserOperationContracts(q),{code:'BROWSER_CONTRACT_QUERY_INVALID'});
 let read=false;const query={get method(){read=true;return 'inspect';}};assert.throws(()=>getBrowserOperationContracts(query));assert.equal(read,false);
});
