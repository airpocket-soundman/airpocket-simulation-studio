import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createBrowserSession} from '../src/browser-session.js';
import {createBrowserIntermediateStore} from '../src/browser-intermediate-store.js';
import {getBrowserOperationContracts} from '../src/browser-operation-contracts.js';

test('browser artifact contract and forwarding expose bounded element connectivity without measurement selectors',async()=>{
 const contract=getBrowserOperationContracts({method:'jobArtifact'}).operations[0];
 assert.deepEqual(contract.inputSchema.properties.pageKind,{enum:['nodes','elements'],default:'nodes'});
 const mesh={nodes:[0,0,0,1,0,0,0,1,0,0,0,1,1,1,1],tetrahedra:[[0,1,2,3],[1,2,3,4]]},store=createBrowserIntermediateStore();
 const captured=await store.capture('job','revision',{mesh});
 const session=createBrowserSession({analysis:{getJobArtifact:(job,artifact,options)=>store.read(job,artifact,options)}});
 const args={jobId:'job',artifactId:captured.artifact.artifactId,pageKind:'elements',offset:1,limit:1};
 const result=await session.call('jobArtifact',args);
 assert.equal(result.page.kind,'elements');assert.equal(result.page.total,2);assert.deepEqual(result.page.tetrahedra,[[1,2,3,4]]);
 assert.equal(result.inputRevision,'revision');assert.equal(result.provisional,true);
 const nodes=await session.call('jobArtifact',{...args,pageKind:'nodes'});assert.equal(nodes.page.total,5);
 for(const selector of [{point:[0,0,0]},{bodyIndex:0},{elementIndex:0}])await assert.rejects(session.call('jobArtifact',{...args,...selector}),/cannot include measurement selectors/);
 for(const query of [{pageKind:'faces'},{limit:201},{offset:3}])await assert.rejects(session.call('jobArtifact',{...args,...query}));
 assert.deepEqual(mesh.tetrahedra,[[0,1,2,3],[1,2,3,4]]);
});
