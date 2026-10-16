import {test} from 'node:test';import assert from 'node:assert/strict';
import {analyzeProject} from '../scripts/headless-analysis.mjs';import {createProjectFromBuiltin} from '../src/project-import.js';import {getProjectRevision} from '../src/project-revision.js';
// Characterisation of the resultRevision of two fresh identical solves (see docs: result-revision determinism).
// The revision hashes the complete displayed output, including result.performance.solveMs, which is wall-clock time.
// Excluding it would change every stored revision (case archives, named views, measurements), so it stays hashed;
// this test pins that the timing is the ONLY varying field and that all physical content is deterministic.
const faces=(p,z)=>p.meshes[0].faceIds.map((_,i)=>i).filter(i=>[2,5,8].every(k=>Math.abs(p.meshes[0].positions[i*9+k]-z)<1e-7));
function project(){const p=createProjectFromBuiltin({source:{kind:'box',bounds:[0,0,0,10,10,40]}});p.materialProperties={youngModulus:1e9,poissonRatio:.3};p.conditions=[{type:'fixed',value:0,direction:[1,0,0],regions:[{mesh:0,triangles:faces(p,0)}]},{type:'force',value:100,direction:[0,0,1],regions:[{mesh:0,triangles:faces(p,40)}]}];return p;}
const plain=o=>JSON.parse(JSON.stringify(o));
test('two identical fresh solves differ only by result.performance.solveMs; physical content has an identical revision',async()=>{
 const a=plain(await analyzeProject(project(),{size:5})),b=plain(await analyzeProject(project(),{size:5}));
 assert.equal(typeof a.result.performance.solveMs,'number');
 const {performance:pa,...ra}=a.result,{performance:pb,...rb}=b.result;
 assert.deepEqual(Object.keys(pa),['solveMs']);
 assert.deepEqual({...a,result:ra},{...b,result:rb});
 assert.equal(await getProjectRevision({...a,result:ra}),await getProjectRevision({...b,result:rb}));
 // The full-output revision intentionally still includes the volatile timing (compatibility with stored revisions).
 assert.equal(await getProjectRevision(a)===await getProjectRevision(b),pa.solveMs===pb.solveMs);
});
