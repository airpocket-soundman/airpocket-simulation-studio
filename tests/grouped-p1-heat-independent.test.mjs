import {test} from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {buildGroupedP1HeatTransferOperator as build,applyGroupedP1HeatTransferOperator as apply,serializeGroupedP1HeatTransferOperator as serialize,loadGroupedP1HeatTransferOperator as load} from '../src/grouped-p1-heat-operator.js';
import {getProjectRevision} from '../src/project-revision.js';
// Two unit squares meet along a shared global edge. Source has center fans;
// target has diagonals AC and AE, with separate source/target global IDs.
function squares(){return {units:'mm',mesh:{nodes:[0,0,0,1,0,0,1,1,0,0,1,0,.5,.5,0,1,0,1,0,0,1,.5,0,.5,0,0,0,1,0,0,1,1,0,0,1,0,1,0,1,0,0,1]},sourceFaces:[[0,1,4],[1,2,4],[2,3,4],[3,0,4],[1,0,7],[0,6,7],[6,5,7],[5,1,7]].map(nodes=>({nodes})),targetFaces:[[8,10,9],[8,11,10],[8,9,12],[8,12,13]].map(nodes=>({nodes})),groups:[{groupId:'xy',sourceFaceIds:[0,1,2,3],targetFaceIds:[0,1]},{groupId:'xz',sourceFaceIds:[4,5,6,7],targetFaceIds:[2,3]}]};}
const field=()=>({units:'W/m2',groups:[{groupId:'xy',values:[0,1,2,3,4].map(nodeId=>({nodeId,value:nodeId===4?6:0}))},{groupId:'xz',values:[0,1,5,6,7].map(nodeId=>({nodeId,value:-2}))}]});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-18+1e-11*Math.max(Math.abs(a),Math.abs(b)),`${a} vs ${b}`);
const sha=raw=>'sha256:'+createHash('sha256').update(raw).digest('hex');

test('independent nonmatching square-fan oracle keeps shared-edge loads and nonzero weighted weak-form rate at zero total heat rate',async()=>{
 const g=squares(),q=field(),before=structuredClone({g,q}),op=await build(g),r=await apply(op,g,q);
 // For the unit square center hat h, ∫Ntarget*h=[1/8,1/24,1/8,1/24].
 // qXY=6h; qXZ=-2. The latter integrates target diagonal weights [1/3,1/6,1/3,1/6].
 const expected=[1/12,-1/12,3/4,1/4,-2/3,-1/3].map(x=>x*1e-6);
 expected.forEach((v,i)=>near(r.nodeHeatW.get(i+8),v));near(r.groups[0].sourceOutwardW,2e-6);near(r.groups[1].sourceOutwardW,-2e-6);near(r.sourceOutwardW,0);near(r.targetLoadW,0);near(r.targetOutwardW,0);near(r.coveredAreaM2,2e-6);
 // Test θ=1+2x+3y+4z: ∫XY6hθ=7microW*K, ∫XZ(-2)θ=-8microW*K.
 const theta=[1,3,6,4,7,5];near(expected.reduce((s,v,i)=>s+v*theta[i],0),-1e-6);near([...r.nodeHeatW].reduce((s,[id,v])=>s+v*theta[id-8],0),-1e-6);
 assert.equal(r.nodeHeatW.size,6);assert.equal(r.solverConnected,false);assert.deepEqual({g,q},before);
});

test('group contact cannot be laundered through duplicate coordinate IDs or nonconforming shared-edge subdivisions',async()=>{
 for(const side of ['sourceFaces','targetFaces']){
  const g=squares(),start=side==='sourceFaces'?0:8,a=g.mesh.nodes.slice(start*3,start*3+3),b=g.mesh.nodes.slice((start+1)*3,(start+1)*3+3);g.mesh.nodes.push(...a,...b);const group=g.groups[1],faceIds=group[side==='sourceFaces'?'sourceFaceIds':'targetFaceIds'];for(const id of faceIds)g[side][id].nodes=g[side][id].nodes.map(n=>n===start?14:n===start+1?15:n);
  await assert.rejects(build(g),{code:'GROUPED_P1_HEAT_OPERATOR_INVALID',message:/shared global/});
 }
 for(const side of ['sourceFaces','targetFaces']){
  const g=squares();g.mesh.nodes.push(.5,0,0);
  if(side==='sourceFaces'){g.sourceFaces.splice(4,1,{nodes:[1,14,7]},{nodes:[14,0,7]});g.groups[1].sourceFaceIds=[4,5,6,7,8];}
  else{g.targetFaces.splice(2,1,{nodes:[8,14,12]},{nodes:[14,9,12]});g.groups[1].targetFaceIds=[2,3,4];}
  await assert.rejects(build(g),{code:'GROUPED_P1_HEAT_OPERATOR_INVALID',message:/shared global/});
 }
});

test('conservative 2x2 coefficient tamper is rejected after recomputing both local and global operator hashes',async()=>{
 const g=squares(),op=await build(g),originalRaw=serialize(op),original=JSON.parse(originalRaw),p=structuredClone(original),local=p.groups[0].operator,rows=[8,9].map(id=>local.rows.find(r=>r.nodeId===id));
 const before=rows.map(r=>new Map(r.terms.map(t=>[t.sourceNodeId,t.coefficientM2]))),delta=1e-9;
 for(let i=0;i<2;i++)for(let j=0;j<2;j++){const term=rows[i].terms.find(t=>t.sourceNodeId===j);assert.ok(term);term.coefficientM2+=(i===j?delta:-delta);assert.ok(term.coefficientM2>0);}
 // Constants, each affected row sum and each affected source-column sum remain conserved.
 for(let i=0;i<2;i++)near(rows[i].terms.reduce((s,t)=>s+t.coefficientM2,0),[...before[i].values()].reduce((s,v)=>s+v,0));
 for(let j=0;j<2;j++)near(rows.reduce((s,r)=>s+r.terms.find(t=>t.sourceNodeId===j).coefficientM2,0),before[0].get(j)+before[1].get(j));
 const q=id=>id===0?1:id===1?3:0,changes=rows.map((r,i)=>r.terms.reduce((s,t)=>s+t.coefficientM2*q(t.sourceNodeId),0)-[...before[i]].reduce((s,[id,v])=>s+v*q(id),0));near(changes[0],-2*delta);near(changes[1],2*delta);near(changes[0]+changes[1],0);
 const{operatorRevision:localHash,...localPayload}=local;local.operatorRevision=await getProjectRevision(localPayload);assert.notEqual(local.operatorRevision,localHash);
 const{operatorRevision,...payload}=p;p.operatorRevision=await getProjectRevision(payload);assert.notEqual(p.operatorRevision,operatorRevision);
 await assert.rejects(load(JSON.stringify(p),g),{code:'GROUPED_P1_HEAT_OPERATOR_INVALID',message:/differ/});assert.equal(serialize(op),originalRaw);
});

test('reload owns geometry before its first await and rederivation keeps local coefficients frozen and scalar identity detached',async()=>{
 const g=squares(),stable=structuredClone(g),op=await build(g),raw=serialize(op),pending=load(raw,g);g.mesh.nodes[0]=.25;g.groups[0].sourceFaceIds.reverse();const loaded=await pending;
 assert.equal(serialize(loaded.operator),raw);assert.equal(loaded.source.rawIdentity,sha(raw));const r=await apply(loaded.operator,stable,field());near(r.nodeHeatW.get(8),1e-6/12);
 assert.ok(Object.isFrozen(loaded.operator.groups[0].operator.rows[0].terms[0]));assert.throws(()=>{loaded.operator.groups[0].operator.rows[0].terms[0].coefficientM2=0;});await assert.rejects(apply(loaded.operator,g,field()),/revision/);assert.equal(loaded.source.meaning,'input-operator-JSON-identity-not-authentication');
});
