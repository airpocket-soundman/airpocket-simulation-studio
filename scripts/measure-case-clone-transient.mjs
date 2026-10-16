// Transient allocation of reading one case: store.list()[i] (clones every case) vs store.at(i) (clones one).
// node --expose-gc scripts/measure-case-clone-transient.mjs [--cases 8]
import {createHost,solveCase} from './measure-case-archive-transfer.mjs';
import {getProjectRevision} from '../src/project-revision.js';
const n=Number(process.argv[process.argv.indexOf('--cases')+1])||8,MB=v=>Math.round(v/1048576*10)/10;
const output=await solveCase(1.0),host=createHost();host.display.value=output;
const revision=await getProjectRevision(JSON.parse(JSON.stringify(output)));
for(let i=0;i<n;i++)await host.operations.saveCurrent({name:'c'+i,expectedResultRevision:revision});
const measure=(label,read)=>{gc();gc();const base=process.memoryUsage().heapUsed,t=performance.now();const held=read();const ms=performance.now()-t,grown=process.memoryUsage().heapUsed-base;console.log(JSON.stringify({label,cases:n,heldWhileReadingMB:MB(grown),ms:Math.round(ms)}));return held;};
measure('list()[0]',()=>host.store.list()[0]);
measure('at(0)',()=>host.store.at(0));
measure('list().length',()=>host.store.list().length);
measure('count()',()=>host.store.count());
