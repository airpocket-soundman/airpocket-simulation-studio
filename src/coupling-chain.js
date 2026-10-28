// Common description of a one-way multiphysics coupling chain (COUPLE1 first step).
//
// A chain is a list of stages. Each stage is one saved analysis with its physical
// revision and the sources it consumed, each recorded with the producer revision
// that was current when the transfer was built:
//   {id, physics, revision, sources:[{from, kind, revision}]}
// The module only checks the description: supported transfer kinds per physics pair,
// unique ids, known producers, acyclic order and revision currency. A stage whose
// recorded source revision differs from the producer's revision is stale, and every
// stage downstream of a stale stage is stale too (transitively), because its inputs
// were built from a result that no longer matches its own inputs.
// It does not run solvers, move fields between meshes or claim two-way coupling
// (COUPLE5); cycles are rejected rather than iterated.
const PHYSICS=['thermal','structural','acoustic','fluid'];
// Transfer kinds already backed by an existing limited operator in main.
export const COUPLING_TRANSFERS=Object.freeze({
 temperature:Object.freeze({from:'thermal',to:'structural',operator:'src/temperature-transfer.js'}),
 vibration:Object.freeze({from:'structural',to:'acoustic',operator:'src/vibration-source.js'}),
 pressure:Object.freeze({from:'fluid',to:'structural',operator:'src/curved-pressure-transfer.js'}),
 heatFlux:Object.freeze({from:'thermal',to:'thermal',operator:'src/planar-heat-transfer.js'}),
});
const hash=v=>typeof v==='string'&&/^sha256:[a-f0-9]{64}$/.test(v);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const MAX_STAGES=64;

export function inspectCouplingChain(chain){
 const diagnostics=[],add=(code,stage,message,evidence={})=>diagnostics.push({code,severity:'error',stage,message,evidence});
 if(!Array.isArray(chain)||!chain.length||chain.length>MAX_STAGES){add('COUPLING_CHAIN_INVALID',null,`Coupling chain requires 1 to ${MAX_STAGES} stages`);return {valid:false,order:[],stale:[],diagnostics};}
 const byId=new Map();
 for(const stage of chain){
  if(!plain(stage)||typeof stage.id!=='string'||!stage.id.trim()||stage.id.length>100){add('COUPLING_STAGE_INVALID',null,'Stage requires a non-empty id');continue;}
  if(byId.has(stage.id)){add('COUPLING_STAGE_DUPLICATE',stage.id,'Stage ids must be unique');continue;}
  if(!PHYSICS.includes(stage.physics))add('COUPLING_STAGE_INVALID',stage.id,'Unsupported physics',{physics:stage.physics});
  if(!hash(stage.revision))add('COUPLING_REVISION_INVALID',stage.id,'Stage revision must be a sha256 physical revision');
  if(stage.sources!==undefined&&!Array.isArray(stage.sources))add('COUPLING_STAGE_INVALID',stage.id,'Stage sources must be an array');
  byId.set(stage.id,stage);
 }
 for(const stage of byId.values())for(const source of Array.isArray(stage.sources)?stage.sources:[]){
  if(!plain(source)){add('COUPLING_SOURCE_INVALID',stage.id,'Source must be an object');continue;}
  const producer=byId.get(source.from),rule=Object.hasOwn(COUPLING_TRANSFERS,source.kind)?COUPLING_TRANSFERS[source.kind]:null;
  if(!producer){add('COUPLING_SOURCE_UNKNOWN',stage.id,'Source stage is not in the chain',{from:source.from});continue;}
  if(producer===stage)add('COUPLING_CYCLE',stage.id,'A stage cannot consume its own result');
  if(!rule)add('COUPLING_TRANSFER_UNSUPPORTED',stage.id,'Unsupported transfer kind',{kind:source.kind});
  else if(rule.from!==producer.physics||rule.to!==stage.physics)add('COUPLING_TRANSFER_UNSUPPORTED',stage.id,`Transfer ${source.kind} requires ${rule.from} to ${rule.to}`,{kind:source.kind,from:producer.physics,to:stage.physics});
  if(!hash(source.revision))add('COUPLING_REVISION_INVALID',stage.id,'Source revision must be a sha256 physical revision',{from:source.from});
 }
 if(diagnostics.length)return {valid:false,order:[],stale:[],diagnostics};
 // Kahn order; leftover stages form a cycle.
 const indegree=new Map([...byId.keys()].map(id=>[id,0])),consumers=new Map([...byId.keys()].map(id=>[id,[]]));
 for(const stage of byId.values())for(const source of stage.sources??[]){indegree.set(stage.id,indegree.get(stage.id)+1);consumers.get(source.from).push(stage.id);}
 const order=[],queue=[...byId.keys()].filter(id=>indegree.get(id)===0);
 while(queue.length){const id=queue.shift();order.push(id);for(const next of consumers.get(id)){indegree.set(next,indegree.get(next)-1);if(!indegree.get(next))queue.push(next);}}
 if(order.length!==byId.size){for(const id of byId.keys())if(!order.includes(id))add('COUPLING_CYCLE',id,'Two-way or cyclic coupling is not part of a one-way chain');return {valid:false,order:[],stale:[],diagnostics};}
 const stale=[],staleIds=new Set();
 for(const id of order){
  const stage=byId.get(id);
  for(const source of stage.sources??[]){
   if(source.revision!==byId.get(source.from).revision){stale.push({stage:id,reason:'source-revision-changed',from:source.from,kind:source.kind,recorded:source.revision,current:byId.get(source.from).revision});staleIds.add(id);break;}
   if(staleIds.has(source.from)){stale.push({stage:id,reason:'upstream-stale',from:source.from,kind:source.kind});staleIds.add(id);break;}
  }
 }
 return {valid:true,current:!stale.length,order,stale,diagnostics};
}

// Saved-case adapter (COUPLE1 second step). Builds the chain description from saved
// case rows {caseId, revision, output} as returned by the case archive: the stage
// revision is the saved case revision, and each source is the caseReference that
// buildTemperatureCaseSource / buildVibrationCaseSource recorded in the consumer's
// solved input. Cases without a mapped result kind are reported, not guessed.
const RESULT_PHYSICS=Object.freeze({thermal:'thermal',elastic:'structural',modal:'structural',acoustic:'acoustic',acousticTransient:'acoustic'});
const CASE_SOURCES=Object.freeze([['temperatureSource','temperature'],['vibrationSource','vibration']]);
export function couplingChainFromCases(cases){
 if(!Array.isArray(cases))return {chain:[],diagnostics:[{code:'COUPLING_CHAIN_INVALID',severity:'error',stage:null,message:'Saved cases must be an array',evidence:{}}]};
 const chain=[],diagnostics=[];
 for(const entry of cases){
  const kind=entry?.output?.result?.kind,physics=Object.hasOwn(RESULT_PHYSICS,kind??'')?RESULT_PHYSICS[kind]:null;
  if(!physics){diagnostics.push({code:'COUPLING_CASE_UNSUPPORTED',severity:'error',stage:entry?.caseId??null,message:'Saved case result kind has no coupling physics',evidence:{kind}});continue;}
  const study=entry.output.input?.study,sources=[];
  for(const [key,transfer] of CASE_SOURCES){const reference=study?.[key]?.caseReference;if(reference!==undefined)sources.push({from:reference?.caseId,kind:transfer,revision:reference?.revision});}
  chain.push({id:entry.caseId,physics,revision:entry.revision,sources});
 }
 return {chain,diagnostics};
}

/** Inspect saved cases directly; adapter diagnostics make the result invalid. */
export function inspectSavedCaseChain(cases){
 const {chain,diagnostics}=couplingChainFromCases(cases);
 if(diagnostics.length)return {valid:false,order:[],stale:[],diagnostics};
 return inspectCouplingChain(chain);
}
