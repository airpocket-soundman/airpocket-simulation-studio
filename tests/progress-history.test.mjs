import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {collectProgressHistory,serializeProgressHistory,MAX_SNAPSHOT_BYTES} from '../scripts/progress-history.mjs';
import {validateProgressHistory,summarizeProgressSnapshot,diffTaskIds,chartModel,historyNotices,historyMatchesProgress,MAX_HISTORY_POINTS,MAX_HISTORY_BYTES,MAX_HISTORY_IDS,HISTORY_PATH} from '../src/progress-history.js';
import {statusNames} from '../src/progress.js';

const rev=n=>n.toString(16).padStart(40,'0');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const snapshot=tasks=>Buffer.from(JSON.stringify({version:1,tasks:Object.entries(tasks).map(([id,status])=>({id,status}))}));
const zero=Object.fromEntries(statusNames.map(s=>[s,0]));
/** A scripted repository: commits are oldest first; file is a Buffer, null (absent) or 'big'. */
function fakeGit(commits,{shallow=false}={}){
 const calls=[],head=commits.at(-1).revision;
 const git=async(args,options={})=>{
  calls.push({args,options});
  if(args[0]==='rev-parse'&&args[1]==='--verify')return Buffer.from(head+'\n');
  if(args[0]==='rev-parse'&&args[1]==='--is-shallow-repository')return Buffer.from(shallow?'true\n':'false\n');
  if(args[0]==='log'){const limit=Number(args.find(a=>a.startsWith('--max-count=')).split('=')[1]);return Buffer.from(commits.slice(-limit).map(c=>c.revision+'\t'+c.committedAt).join('\n')+'\n');}
  if(args[0]==='show'){const c=commits.find(x=>args[1]===x.revision+':'+HISTORY_PATH);if(!c||c.file===null)throw Error('fatal: path does not exist');if(c.file==='big')throw Object.assign(Error('maxBuffer'),{code:'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'});return c.file;}
  throw Error('Unexpected git call '+args.join(' '));
 };
 return {git,calls};
}
const iso=ms=>new Date(ms).toISOString().replace('.000Z','Z');
const at=(n,file)=>({revision:rev(n),committedAt:iso(Date.UTC(2026,9,1)+n*3600e3),file});
const threeCommits=()=>[at(1,snapshot({A:'queued',B:'building'})),at(2,snapshot({A:'building',B:'building',C:'queued'})),at(3,snapshot({A:'released',C:'queued'}))];

test('history points are real commit snapshots with honest added/removed tasks and head identity',async()=>{
 const commits=threeCommits(),{git,calls}=fakeGit(commits),h=await collectProgressHistory({git});
 assert.equal(h.points.length,3);assert.deepEqual(h.points.map(p=>p.revision),commits.map(c=>c.revision));assert.deepEqual(h.points.map(p=>p.committedAt),commits.map(c=>c.committedAt));
 assert.deepEqual(h.points[0],{revision:rev(1),committedAt:commits[0].committedAt,total:2,counts:{...zero,queued:1,building:1},addedCount:null,removedCount:null,added:[],removed:[]});
 assert.deepEqual(h.points[1].counts,{...zero,queued:1,building:2});assert.equal(h.points[1].total,3);assert.deepEqual([h.points[1].addedCount,h.points[1].added,h.points[1].removedCount],[1,['C'],0]);
 assert.deepEqual([h.points[2].total,h.points[2].counts.released,h.points[2].removed,h.points[2].addedCount],[2,1,['B'],0]);
 assert.deepEqual(h.head,{revision:commits.at(-1).revision,progressSha256:sha(commits.at(-1).file),progressBytes:commits.at(-1).file.length});
 assert.deepEqual(h.completeness,{shallow:false,truncated:false,maxPoints:MAX_HISTORY_POINTS,commitsListed:3,pointCount:3,skippedCount:0,timestampRegressions:0});
 validateProgressHistory(structuredClone(h));
 // No shell, bounded output on every call, and the file path is always after --.
 // Argument vectors only (no shell string), a known subcommand, and bounded output on every show.
 for(const {args,options} of calls){assert.ok(['rev-parse','log','show'].includes(args[0]));assert.ok(args.every(a=>typeof a==='string'&&!a.includes('\n')));if(args[0]==='show')assert.ok(options.maxBuffer<=MAX_SNAPSHOT_BYTES);}
 assert.deepEqual(calls.find(c=>c.args[0]==='log').args.slice(-2),['--',HISTORY_PATH]);
});
test('unreadable commits are skipped with a reason and never replaced by invented points',async()=>{
 const bad=[null,'big',Buffer.from([0xff,0xfe]),Buffer.from('{'),Buffer.from(JSON.stringify({version:1,tasks:[{id:'A',status:'paused'}]})),Buffer.from(JSON.stringify({version:1,tasks:[{id:'A',status:'queued'},{id:'A',status:'queued'}]})),Buffer.from(JSON.stringify({version:2,tasks:[]}))];
 const commits=[at(1,snapshot({A:'queued'})),...bad.map((file,i)=>at(i+2,file)),at(20,snapshot({A:'queued',B:'queued'}))],{git}=fakeGit(commits),h=await collectProgressHistory({git});
 assert.deepEqual(h.skipped.map(s=>s.reason),['file-absent','too-large','invalid-utf8','invalid-json','invalid-progress','invalid-progress','invalid-progress']);
 assert.equal(h.points.length,2);assert.equal(h.completeness.commitsListed,9);
 // The diff spans the skipped commits; it is against the last readable point only.
 assert.deepEqual([h.points[1].addedCount,h.points[1].added],[1,['B']]);
 validateProgressHistory(structuredClone(h));
});
test('point cap keeps the newest commits, declares truncation and shallow clones, and can be required complete',async()=>{
 const commits=[1,2,3,4,5].map(n=>at(n,snapshot({A:n>3?'released':'queued'}))),{git,calls}=fakeGit(commits);
 const h=await collectProgressHistory({git,maxPoints:3});
 assert.deepEqual(h.points.map(p=>p.revision),[rev(3),rev(4),rev(5)]);assert.equal(h.completeness.truncated,true);assert.equal(h.points[0].addedCount,null);
 assert.equal(calls.find(c=>c.args[0]==='log').args.includes('--max-count=4'),true);
 await assert.rejects(collectProgressHistory({git,maxPoints:3,requireComplete:true}),{code:'PROGRESS_HISTORY_INCOMPLETE'});
 const shallow=await collectProgressHistory({git:fakeGit(commits.slice(-1),{shallow:true}).git});assert.equal(shallow.completeness.shallow,true);assert.equal(shallow.points.length,1);assert.deepEqual(historyNotices(shallow),['shallow','single-point']);
 await assert.rejects(collectProgressHistory({git:fakeGit(commits.slice(-1),{shallow:true}).git,requireComplete:true}),{code:'PROGRESS_HISTORY_INCOMPLETE'});
 for(const maxPoints of [0,1.5,MAX_HISTORY_POINTS+1,'5'])await assert.rejects(collectProgressHistory({git,maxPoints}),RangeError);
 assert.equal(MAX_HISTORY_POINTS,1000);
});
test('malformed git output, empty history, unreadable head and too many skipped snapshots fail closed',async()=>{
 const good=threeCommits();
 const wrap=(override)=>async(args,options)=>{const result=await override(args,options);return result??fakeGit(good).git(args,options);};
 await assert.rejects(collectProgressHistory({git:wrap(async a=>a[0]==='log'?Buffer.from('not-a-revision\t2026-10-10T00:00:00Z\n'):undefined)}),{code:'PROGRESS_HISTORY_GIT'});
 await assert.rejects(collectProgressHistory({git:wrap(async a=>a[0]==='log'?Buffer.from(rev(1)+'\tyesterday\n'):undefined)}),{code:'PROGRESS_HISTORY_GIT'});
 await assert.rejects(collectProgressHistory({git:wrap(async a=>a[0]==='log'?Buffer.from(rev(1)+'\t2026-10-10T00:00:00Z\textra\n'):undefined)}),{code:'PROGRESS_HISTORY_GIT'});
 await assert.rejects(collectProgressHistory({git:wrap(async a=>a[0]==='log'?Buffer.from(''):undefined)}),{code:'PROGRESS_HISTORY_EMPTY'});
 await assert.rejects(collectProgressHistory({git:wrap(async a=>a[0]==='rev-parse'&&a[1]==='--verify'?Buffer.from('HEAD'):undefined)}),{code:'PROGRESS_HISTORY_GIT'});
 await assert.rejects(collectProgressHistory({git:wrap(async a=>a[1]==='--is-shallow-repository'?Buffer.from('maybe'):undefined)}),{code:'PROGRESS_HISTORY_GIT'});
 const many=[at(1,snapshot({A:'queued'})),...Array.from({length:201},(_,i)=>at(i+2,null)),at(300,snapshot({A:'queued'}))];
 await assert.rejects(collectProgressHistory({git:fakeGit(many).git}),{code:'PROGRESS_HISTORY_SKIPPED'});
 // The head file is read last (after the three commit snapshots); losing it must fail the build.
 const control=fakeGit(good);let shows=0;
 await assert.rejects(collectProgressHistory({git:async(args,o)=>{if(args[0]==='show'&&++shows===4)throw Error('fatal: bad object');return control.git(args,o);}}),{code:'PROGRESS_HISTORY_GIT'});
 assert.equal(shows,4);
});
test('timestamp regressions are counted, not hidden, and charted in time order',async()=>{
 const commits=[at(1,snapshot({A:'queued'})),at(3,snapshot({A:'building'})),{...at(2,snapshot({A:'released'})),committedAt:iso(Date.UTC(2026,9,1)+2*3600e3)}],h=await collectProgressHistory({git:fakeGit(commits).git});
 assert.equal(h.completeness.timestampRegressions,1);assert.deepEqual(historyNotices(h),['regressions']);
 const model=chartModel(h);assert.deepEqual(model.order,[0,2,1]);const xs=model.order.map((_,k)=>model.series[0].points[k].x);assert.deepEqual(xs,[...xs].sort((a,b)=>a-b));
});
test('real git: only commits that change progress.json become points; shallow clones are declared',{skip:(()=>{try{execFileSync('git',['--version'],{stdio:'ignore'});return false;}catch{return true;}})()},async()=>{
 const dir=mkdtempSync(join(tmpdir(),'progress-history-')),run=(cwd,args,time)=>execFileSync('git',['-c','user.name=t','-c','user.email=t@example.test','-c','commit.gpgsign=false','-c','core.autocrlf=false',...args],{cwd,stdio:'pipe',env:{...process.env,GIT_COMMITTER_DATE:time??'@1767225600 +0000',GIT_AUTHOR_DATE:time??'@1767225600 +0000'}});
 try{
  const origin=join(dir,'origin');mkdirSync(join(origin,'src'),{recursive:true});run(origin,['init','-q']);
  const commit=(tasks,time,extra)=>{writeFileSync(join(origin,'src','progress.json'),snapshot(tasks));if(extra)writeFileSync(join(origin,extra),'x');run(origin,['add','-A']);run(origin,['commit','-q','-m','c'],time);};
  commit({A:'queued'},'@1767225600 +0000');
  writeFileSync(join(origin,'README'),'unrelated');run(origin,['add','-A']);run(origin,['commit','-q','-m','unrelated'],'@1767229200 +0000');
  commit({A:'building',B:'queued'},'@1767232800 +0000');
  commit({A:'released',B:'queued'},'@1767236400 +0000');
  const full=await collectProgressHistory({root:origin});
  assert.equal(full.points.length,3);assert.equal(full.completeness.shallow,false);assert.deepEqual(full.points.map(p=>Date.parse(p.committedAt)),['2026-01-01T00:00:00+00:00','2026-01-01T02:00:00+00:00','2026-01-01T03:00:00+00:00'].map(Date.parse));
  assert.deepEqual([full.points[1].added,full.points[2].counts.released],[['B'],1]);
  assert.equal(serializeProgressHistory(full).toString('utf8').endsWith('}\n'),true);
  const clone=join(dir,'clone');run(dir,['clone','-q','--depth','1',pathToFileURL(origin).href,clone]);
  const shallow=await collectProgressHistory({root:clone});
  assert.equal(shallow.completeness.shallow,true);assert.equal(shallow.points.length,1);assert.equal(shallow.points[0].addedCount,null);
  await assert.rejects(collectProgressHistory({root:clone,requireComplete:true}),{code:'PROGRESS_HISTORY_INCOMPLETE'});
 }finally{rmSync(dir,{recursive:true,force:true});}
});

function validHistory(){
 return {schemaVersion:1,kind:'progress-history',path:HISTORY_PATH,statuses:[...statusNames],head:{revision:rev(2),progressSha256:'a'.repeat(64),progressBytes:100},
  completeness:{shallow:false,truncated:false,maxPoints:MAX_HISTORY_POINTS,commitsListed:2,pointCount:2,skippedCount:0,timestampRegressions:0},
  points:[{revision:rev(1),committedAt:'2026-10-14T00:00:00Z',total:2,counts:{...zero,queued:2},addedCount:null,removedCount:null,added:[],removed:[]},{revision:rev(2),committedAt:'2026-10-15T00:00:00Z',total:3,counts:{...zero,queued:1,released:2},addedCount:1,removedCount:0,added:['C'],removed:[]}],skipped:[]};
}
test('history schema accepts a consistent artifact and rejects every inconsistent variant without repair',()=>{
 assert.equal(validateProgressHistory(validHistory()).points.length,2);
 const mutations={
  'extra key':h=>{h.extra=1;},'wrong kind':h=>{h.kind='other';},'wrong path':h=>{h.path='../progress.json';},'schema':h=>{h.schemaVersion=2;},'statuses':h=>{h.statuses.reverse();},
  'head revision':h=>{h.head.revision='HEAD';},'head sha':h=>{h.head.progressSha256='A'.repeat(64);},'head bytes':h=>{h.head.progressBytes=0;},'head too large':h=>{h.head.progressBytes=MAX_HISTORY_BYTES+1;},
  'shallow type':h=>{h.completeness.shallow='no';},'point count':h=>{h.completeness.pointCount=1;},'listed count':h=>{h.completeness.commitsListed=5;},'regressions':h=>{h.completeness.timestampRegressions=3;},'max points':h=>{h.completeness.maxPoints=MAX_HISTORY_POINTS+1;},
  'no points':h=>{h.points=[];h.completeness.pointCount=0;h.completeness.commitsListed=0;},'more points than limit':h=>{h.completeness.maxPoints=1;},
  'duplicate revision':h=>{h.points[1].revision=h.points[0].revision;},'bad timestamp':h=>{h.points[0].committedAt='yesterday';},'date only':h=>{h.points[0].committedAt='2026-10-14';},
  'counts do not sum':h=>{h.points[0].counts.queued=1;},'negative count':h=>{h.points[0].counts.queued=-2;h.points[0].counts.released=4;},'fractional':h=>{h.points[0].counts.queued=1.5;},'missing status':h=>{delete h.points[0].counts.fixing;},'extra status':h=>{h.points[0].counts.paused=0;},
  'first point diff':h=>{h.points[0].addedCount=0;h.points[0].removedCount=0;},'first point ids':h=>{h.points[0].added=['A'];},
  'total chain':h=>{h.points[1].addedCount=0;h.points[1].added=[];},'removed hides loss':h=>{h.points[1].removedCount=1;h.points[1].removed=['Z'];},
  'ids shorter than count':h=>{h.points[1].added=[];},'bad task id':h=>{h.points[1].added=['a b'];},'long id':h=>{h.points[1].added=['A'.repeat(101)];},'null diff later':h=>{h.points[1].addedCount=null;},
  'skipped reason':h=>{h.skipped=[{revision:rev(9),committedAt:'2026-10-13T00:00:00Z',reason:'because'}];h.completeness.skippedCount=1;h.completeness.commitsListed=3;},
  'skipped duplicates a point':h=>{h.skipped=[{revision:rev(1),committedAt:'2026-10-13T00:00:00Z',reason:'file-absent'}];h.completeness.skippedCount=1;h.completeness.commitsListed=3;}
 };
 for(const [label,mutate] of Object.entries(mutations)){const h=validHistory();mutate(h);assert.throws(()=>validateProgressHistory(h),{code:'PROGRESS_HISTORY_INVALID'},label);}
 for(const bad of [null,[],'text',7,JSON.parse('{"__proto__":{"x":1}}')])assert.throws(()=>validateProgressHistory(bad),{code:'PROGRESS_HISTORY_INVALID'});
 const polluted=validHistory(),withProto=JSON.parse(JSON.stringify(polluted).replace('"kind"','"__proto__":{"a":1},"kind"'));assert.throws(()=>validateProgressHistory(withProto),{code:'PROGRESS_HISTORY_INVALID'});
 const many=validHistory();many.points=Array.from({length:MAX_HISTORY_POINTS+1},(_,i)=>({...many.points[0],revision:rev(i+100)}));many.completeness.pointCount=many.points.length;many.completeness.commitsListed=many.points.length;assert.throws(()=>validateProgressHistory(many),{code:'PROGRESS_HISTORY_INVALID'});
 const tooManySkipped=validHistory();tooManySkipped.skipped=Array.from({length:201},(_,i)=>({revision:rev(i+500),committedAt:'2026-10-13T00:00:00Z',reason:'file-absent'}));tooManySkipped.completeness.skippedCount=201;tooManySkipped.completeness.commitsListed=203;assert.throws(()=>validateProgressHistory(tooManySkipped),{code:'PROGRESS_HISTORY_INVALID'});
});
test('serialized history is bounded: a realistic 1000-point history fits, an id-laden one is refused',()=>{
 const build=(ids)=>{const h=validHistory();h.points=Array.from({length:MAX_HISTORY_POINTS},(_,i)=>({revision:rev(i+1),committedAt:iso(Date.UTC(2026,0,1)+i*3600e3),total:2,counts:{...zero,queued:2},addedCount:i?ids.length:null,removedCount:i?ids.length:null,added:i?ids:[],removed:i?ids:[]}));Object.assign(h.completeness,{commitsListed:MAX_HISTORY_POINTS,pointCount:MAX_HISTORY_POINTS});h.head.revision=rev(MAX_HISTORY_POINTS);return h;};
 assert.ok(serializeProgressHistory(build([])).length<MAX_HISTORY_BYTES/3);
 const ids=Array.from({length:MAX_HISTORY_IDS},(_,i)=>'T'.repeat(99)+String(i%10));
 assert.throws(()=>serializeProgressHistory(build(ids)),{code:'PROGRESS_HISTORY_BYTES'});
});
test('snapshot summary rejects ambiguous historical progress and diffs report only id changes',()=>{
 const ok=summarizeProgressSnapshot({version:1,tasks:[{id:'A',status:'ready'},{id:'B',status:'fixing'}]});assert.deepEqual([ok.total,ok.counts.ready,ok.counts.fixing],[2,1,1]);
 for(const bad of [null,{version:1},{version:1,tasks:[{id:'A',status:'x'}]},{version:1,tasks:[{id:'A',status:'ready'},{id:'A',status:'ready'}]},{version:1,tasks:[{id:'a b',status:'ready'}]},{version:1,tasks:[null]},{version:1,tasks:Array.from({length:10001},(_,i)=>({id:'T'+i,status:'queued'}))}])assert.throws(()=>summarizeProgressSnapshot(bad),/invalid-progress/);
 assert.deepEqual(diffTaskIds(new Set(['A','B']),new Set(['B','C','A2'])),{added:['A2','C'],removed:['A']});
 assert.deepEqual(diffTaskIds(new Set(['A']),new Set(['A'])),{added:[],removed:[]});
});
test('chart model draws step lines through recorded points only and rescales when a status is hidden',()=>{
 const h=validHistory(),m=chartModel(h);
 for(const series of m.series){assert.equal(series.points.length,h.points.length);assert.match(series.path,/^M[\d.]+ [\d.]+H[\d.]+V[\d.]+$/);assert.equal((series.path.match(/[MHV]/g)||[]).length,1+2*(h.points.length-1));}
 assert.deepEqual(m.series.find(s=>s.status==='released').points.map(p=>p.count),[0,2]);
 assert.ok(m.yMax>=2&&m.yTicks.every(t=>Number.isInteger(t.value))&&m.yTicks.at(-1).value===m.yMax);
 assert.deepEqual(m.markers.map(k=>[k.i,k.addedCount,k.removedCount]),[[1,1,0]]);
 const hidden=chartModel(h,{hidden:['queued']});assert.equal(hidden.series.find(s=>s.status==='queued').path,'');assert.equal(hidden.series.find(s=>s.status==='queued').visible,false);assert.ok(hidden.yMax<=m.yMax);
 const all=chartModel(h,{hidden:[...statusNames]});assert.ok(all.yMax>=1);
 const single=validHistory();single.points=[single.points[0]];Object.assign(single.completeness,{commitsListed:1,pointCount:1});single.head.revision=rev(1);
 const s=chartModel(single);assert.equal(s.series[0].points.length,1);assert.equal(s.series[0].path,`M${s.series[0].points[0].x} ${s.series[0].points[0].y}`);assert.equal(s.markers.length,0);assert.deepEqual(historyNotices(validateProgressHistory(single)),['single-point']);
 const same=validHistory();same.points[1].committedAt=same.points[0].committedAt;const sm=chartModel(same);assert.notEqual(sm.series[0].points[0].x,sm.series[0].points[1].x);
 for(const p of m.series.flatMap(x=>x.points)){assert.ok(p.x>=m.plot.left&&p.x<=m.width-m.plot.right&&p.y>=m.plot.top&&p.y<=m.height-m.plot.bottom);}
});
test('history notices and agreement with the displayed progress are explicit',()=>{
 const h=validHistory();assert.deepEqual(historyNotices(h),[]);
 Object.assign(h.completeness,{shallow:true,truncated:true,skippedCount:0});assert.deepEqual(historyNotices(h),['shallow','truncated']);
 const tasks=[{id:'A',status:'queued'},{id:'B',status:'released'},{id:'C',status:'released'}];
 assert.equal(historyMatchesProgress(validHistory(),{version:1,tasks}),true);
 assert.equal(historyMatchesProgress(validHistory(),{version:1,tasks:tasks.slice(1)}),false);
 assert.equal(historyMatchesProgress(validHistory(),{tasks:'bad'}),null);
});

test('clean CRLF checkout bytes bind exactly without admitting source changes',async()=>{
 const commits=threeCommits();commits.at(-1).file=Buffer.from(JSON.stringify(JSON.parse(commits.at(-1).file),null,2)+'\n');
 const crlf=Buffer.from(commits.at(-1).file.toString('utf8').replace(/\n/g,'\r\n'));
 const h=await collectProgressHistory({git:fakeGit(commits).git,progressBytes:crlf});
 assert.equal(h.head.progressSha256,sha(crlf));assert.equal(h.head.progressBytes,crlf.length);
 await assert.rejects(collectProgressHistory({git:fakeGit(commits).git,progressBytes:Buffer.from(crlf.toString().replace('released','fixing'))}),{code:'PROGRESS_HISTORY_SOURCE_MISMATCH'});
});
test('unreadable history never forward-fills unknown intervals, including equal or reversed timestamps',async()=>{
 for(const dates of [[1,2,3],[1,1,1],[3,2,1]]){
  const commits=[at(1,snapshot({A:'queued'})),at(2,Buffer.from('{')),at(3,snapshot({A:'released'}))];
  commits.forEach((c,i)=>c.committedAt=at(dates[i],null).committedAt);
  const history=await collectProgressHistory({git:fakeGit(commits).git});const chart=chartModel(history);
  assert.equal(chart.connected,false);assert.ok(chart.series.every(series=>!/[HV]/.test(series.path)));
  assert.equal(chart.series[0].points.length,2);
 }
});
