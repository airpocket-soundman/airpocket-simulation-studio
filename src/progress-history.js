import {statusNames} from './progress.js';

export const HISTORY_PATH='src/progress.json';
export const MAX_HISTORY_POINTS=1000;
export const MAX_HISTORY_SKIPPED=200;
export const MAX_HISTORY_IDS=25;
export const MAX_HISTORY_BYTES=2_000_000;
export const MAX_SNAPSHOT_TASKS=10000;
export const SKIP_REASONS=['file-absent','too-large','invalid-utf8','invalid-json','invalid-progress'];
const taskId=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(v);
const revision=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const sha256=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const timestamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v));
const count=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
const exact=(v,keys)=>plain(v)&&Object.keys(v).sort().join()===[...keys].sort().join();
const fail=reason=>{throw Object.assign(Error('Invalid progress history: '+reason),{code:'PROGRESS_HISTORY_INVALID'});};

/** Count statuses of one historical progress.json. Deliberately weaker than the
 * current validateProgress: old commits predate later fields, but their task ids
 * and statuses must still be unambiguous or the commit is skipped, never guessed. */
export function summarizeProgressSnapshot(progress){
 if(!plain(progress)||progress.version!==1||!Array.isArray(progress.tasks)||progress.tasks.length>MAX_SNAPSHOT_TASKS)throw Error('invalid-progress');
 const counts=Object.fromEntries(statusNames.map(status=>[status,0])),ids=new Set();
 for(const task of progress.tasks){if(!plain(task)||!taskId(task.id)||ids.has(task.id)||!statusNames.includes(task.status))throw Error('invalid-progress');ids.add(task.id);counts[task.status]++;}
 return {counts,total:ids.size,ids};
}
/** Task-id set difference. A renamed id is indistinguishable from remove + add. */
export function diffTaskIds(previous,next){
 return {added:[...next].filter(id=>!previous.has(id)).sort(),removed:[...previous].filter(id=>!next.has(id)).sort()};
}
/** Validate the build-time history artifact. Rejects, never repairs. */
export function validateProgressHistory(value){
 if(!exact(value,['schemaVersion','kind','path','statuses','head','completeness','points','skipped'])||value.schemaVersion!==1||value.kind!=='progress-history'||value.path!==HISTORY_PATH)fail('envelope');
 if(JSON.stringify(value.statuses)!==JSON.stringify(statusNames))fail('statuses');
 const head=value.head;
 if(!exact(head,['revision','progressSha256','progressBytes'])||!revision(head.revision)||!sha256(head.progressSha256)||!Number.isSafeInteger(head.progressBytes)||head.progressBytes<1||head.progressBytes>MAX_HISTORY_BYTES)fail('head');
 const c=value.completeness;
 if(!exact(c,['shallow','truncated','maxPoints','commitsListed','pointCount','skippedCount','timestampRegressions'])||typeof c.shallow!=='boolean'||typeof c.truncated!=='boolean'||!Number.isInteger(c.maxPoints)||c.maxPoints<1||c.maxPoints>MAX_HISTORY_POINTS)fail('completeness');
 if(!Array.isArray(value.points)||!Array.isArray(value.skipped)||value.points.length<1||value.points.length>c.maxPoints||value.skipped.length>MAX_HISTORY_SKIPPED)fail('bounds');
 if(c.pointCount!==value.points.length||c.skippedCount!==value.skipped.length||c.commitsListed!==c.pointCount+c.skippedCount||c.commitsListed>c.maxPoints||!count(c.timestampRegressions,c.commitsListed))fail('counts');
 const seen=new Set();let previous=null;
 value.points.forEach((point,index)=>{
  if(!exact(point,['revision','committedAt','total','counts','addedCount','removedCount','added','removed'])||!revision(point.revision)||seen.has(point.revision)||!timestamp(point.committedAt)||!count(point.total,MAX_SNAPSHOT_TASKS)||!exact(point.counts,statusNames))fail('point '+index);
  seen.add(point.revision);
  let sum=0;for(const status of statusNames){if(!count(point.counts[status],MAX_SNAPSHOT_TASKS))fail('point '+index+' count');sum+=point.counts[status];}
  if(sum!==point.total)fail('point '+index+' total');
  if(!Array.isArray(point.added)||!Array.isArray(point.removed)||[...point.added,...point.removed].some(id=>!taskId(id)))fail('point '+index+' ids');
  if(previous===null){if(point.addedCount!==null||point.removedCount!==null||point.added.length||point.removed.length)fail('first point claims a diff');}
  else{
   if(!count(point.addedCount,MAX_SNAPSHOT_TASKS)||!count(point.removedCount,MAX_SNAPSHOT_TASKS)||point.added.length!==Math.min(point.addedCount,MAX_HISTORY_IDS)||point.removed.length!==Math.min(point.removedCount,MAX_HISTORY_IDS))fail('point '+index+' diff');
   // Task total is exactly the previous recorded total plus the stated difference.
   if(point.total!==previous.total+point.addedCount-point.removedCount)fail('point '+index+' task total does not follow its added/removed counts');
  }
  previous=point;
 });
 value.skipped.forEach((entry,index)=>{if(!exact(entry,['revision','committedAt','reason'])||!revision(entry.revision)||seen.has(entry.revision)||!timestamp(entry.committedAt)||!SKIP_REASONS.includes(entry.reason))fail('skipped '+index);seen.add(entry.revision);});
 return value;
}
/** True when the newest recorded point agrees with the progress being shown;
 * null when the progress cannot be summarized. Informational, not an integrity proof. */
export function historyMatchesProgress(history,progress){
 try{const current=summarizeProgressSnapshot(progress),last=history.points.at(-1);return last.total===current.total&&statusNames.every(status=>last.counts[status]===current.counts[status]);}catch{return null;}
}
/** Notices a viewer must show next to the series, as stable codes. */
export function historyNotices(history){
 const c=history.completeness,notices=[];
 if(c.shallow)notices.push('shallow');if(c.truncated)notices.push('truncated');
 if(history.points.length<2)notices.push('single-point');
 if(c.skippedCount>0)notices.push('skipped');if(c.timestampRegressions>0)notices.push('regressions');
 return notices;
}
const niceStep=raw=>{const power=10**Math.floor(Math.log10(Math.max(raw,1)));const unit=raw/power;return power*(unit<=1?1:unit<=2?2:unit<=5?5:10);};
/** Geometry for the status-count chart. One vertex per recorded commit; segments
 * hold the previous value until the next commit (step), so nothing is interpolated.
 * Points are drawn in committer-time order; `i` indexes history.points. */
export function chartModel(history,{width=720,height=320,left=44,right=16,top=14,bottom=34,hidden=[]}={}){
 const pts=history.points,times=pts.map(p=>Date.parse(p.committedAt));
 const order=[...pts.keys()].sort((a,b)=>times[a]-times[b]||a-b);
 const t0=times[order[0]],t1=times[order.at(-1)],span=t1-t0,w=width-left-right,h=height-top-bottom;
 const xAt=position=>left+(span>0?(times[order[position]]-t0)/span*w:order.length>1?position/(order.length-1)*w:w/2);
 const hide=new Set(hidden),visible=statusNames.filter(status=>!hide.has(status));
 const peak=Math.max(1,...visible.flatMap(status=>pts.map(p=>p.counts[status]))),step=niceStep(peak/4),yMax=step*Math.ceil(peak/step);
 const yAt=value=>top+h-value/yMax*h,r=v=>Math.round(v*10)/10;
 const yTicks=[];for(let v=0;v<=yMax;v+=step)yTicks.push({value:v,y:r(yAt(v))});
 const series=statusNames.map(status=>{
  const on=!hide.has(status),points=order.map((i,position)=>({i,x:r(xAt(position)),y:r(yAt(pts[i].counts[status])),count:pts[i].counts[status]}));
  let path='';if(on)points.forEach((p,k)=>{path+=k===0||history.skipped.length>0?`M${p.x} ${p.y}`:`H${p.x}V${p.y}`;});
  return {status,visible:on,points,path};
 });
 const xTicks=span>0?[0,1/3,2/3,1].map(f=>({time:new Date(t0+Math.round(span*f)).toISOString(),x:r(left+f*w)})):[{time:new Date(t0).toISOString(),x:r(xAt(0))}];
 const markers=order.flatMap((i,position)=>pts[i].addedCount>0||pts[i].removedCount>0?[{i,x:r(xAt(position)),addedCount:pts[i].addedCount,removedCount:pts[i].removedCount}]:[]);
 return {connected:history.skipped.length===0,width,height,plot:{left,right,top,bottom,w,h},yMax,yTicks,xTicks,order,series,markers};
}
