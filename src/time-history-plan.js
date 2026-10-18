// Budgets cover stored scalar values at eight bytes per node/frame, not JS arrays,
// observation payloads, receiver traces, render copies or peak process memory.
export const HISTORY_MAX_FRAMES=61,HISTORY_MAX_BYTES=64*1024*1024;
export function validateHistorySettings(study){
 for(const prefix of ['thermal','acoustic']){
  const count=study[prefix+'SnapshotCount'],budget=study[prefix+'SnapshotBudgetBytes'];
  if(count!==undefined&&(!Number.isInteger(count)||count<2||count>HISTORY_MAX_FRAMES))throw Error(prefix+'SnapshotCount must be an integer from 2 through '+HISTORY_MAX_FRAMES);
  if(budget!==undefined&&(!Number.isSafeInteger(budget)||budget<1||budget>HISTORY_MAX_BYTES))throw Error(prefix+'SnapshotBudgetBytes must be an integer from 1 through '+HISTORY_MAX_BYTES);
 }
}
/** Include both endpoints, cap by available solved states and scalar storage budget. */
export function createHistoryPlan(steps,nodeCount,{requested=HISTORY_MAX_FRAMES,budgetBytes=HISTORY_MAX_BYTES,prefix='thermal',legacyAcoustic=false}={}){
 validateHistorySettings({[prefix+'SnapshotCount']:requested,[prefix+'SnapshotBudgetBytes']:budgetBytes});
 if(!Number.isSafeInteger(steps)||steps<1||!Number.isSafeInteger(nodeCount)||nodeCount<1)throw Error('Invalid time history dimensions');
 const warnings=[],wanted=Math.min(requested,steps+1),fit=Math.floor(budgetBytes/(8*nodeCount));
 if(fit<2)throw Error((prefix==='thermal'?'Thermal':'Acoustic')+' snapshot memory budget of '+budgetBytes+' bytes cannot hold two frames of '+nodeCount+' nodes');
 let count=Math.min(wanted,fit),indices;
 if(wanted<requested)warnings.push('Requested '+requested+' snapshots but only '+(steps+1)+' states exist (initial plus '+steps+' steps); storing '+wanted);
 if(count<wanted)warnings.push('Snapshot count reduced from '+wanted+' to '+count+' to stay within the '+budgetBytes+' byte budget');
 if(legacyAcoustic&&count===wanted){const stride=Math.max(1,Math.ceil(steps/60));indices=[0];for(let step=stride;step<steps;step+=stride)indices.push(step);indices.push(steps);count=indices.length;}
 else indices=Array.from({length:count},(_,i)=>i===count-1?steps:Math.round(i*steps/(count-1)));
 return {requested,count,indices,bytes:count*nodeCount*8,budgetBytes,warnings};
}

/** Optional storage metadata must agree with retained fields; old archives may omit it. */
export function validateHistoryMetadata(result){
 const info=result?.snapshotInfo;if(info===undefined)return;
 const fields=result.kind==='thermal'?'temperature':result.kind==='acousticTransient'?'pressure':null,n=result[fields]?.length;
 if(!fields||!Array.isArray(result[fields])||!result[fields].every(Number.isFinite)||!Array.isArray(result.snapshots)||!Number.isSafeInteger(n)||n<1||info.count!==result.snapshots.length||info.count<2||info.count>HISTORY_MAX_FRAMES||info.count>info.requested||info.bytes!==n*info.count*8||!Number.isSafeInteger(info.budgetBytes)||info.budgetBytes<info.bytes||info.budgetBytes>HISTORY_MAX_BYTES||!Number.isInteger(info.requested)||info.requested<2||info.requested>HISTORY_MAX_FRAMES||!Array.isArray(info.steps)||info.steps.length!==info.count||info.steps[0]!==0||info.steps.some((s,i)=>!Number.isInteger(s)||s<0||i>0&&s<=info.steps[i-1])||!Array.isArray(info.warnings)||info.warnings.some(w=>typeof w!=='string'))throw Error('Invalid saved time history storage metadata');
 const totalSteps=result.kind==='thermal'?result.history?.length:result.steps;
 if(!Number.isSafeInteger(totalSteps)||totalSteps<1||info.steps.at(-1)!==totalSteps)throw Error('Invalid saved time history endpoint');
 for(const [i,frame] of result.snapshots.entries()){
  const step=info.steps[i],expectedTime=step===0?0:result.kind==='thermal'?result.history[step-1]?.time:step*result.timeStep,values=frame?.[fields];
  if(!Number.isFinite(expectedTime)||!Number.isFinite(frame?.time)||frame.time!==expectedTime||!Array.isArray(values)||values.length!==n||!values.every(Number.isFinite)||result.kind==='thermal'&&frame.step!==step)throw Error('Invalid saved time history frame');
 }
 if(result.snapshots.at(-1)[fields].some((v,i)=>v!==result[fields][i]))throw Error('Invalid saved time history final field');
}
