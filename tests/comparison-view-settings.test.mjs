import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getProjectRevision} from '../src/project-revision.js';
import {validateComparisonSettings,validateComparisonViewSettings,captureComparisonView,resolveComparisonView} from '../src/comparison-view-settings.js';

const hash=n=>'sha256:'+String(n).repeat(64);
const settings=()=>({field:'temperature',deformScale:0,camera:{position:[5,5,5],target:[0,0,0],up:[0,1,0],fov:40},timeSeconds:0,toleranceSeconds:0});
const listing=()=>({schemaVersion:1,archiveRevision:hash(9),cases:[{caseId:'left-old',revision:hash(1),name:'Left',kind:'thermal',metrics:[]},{caseId:'right-old',revision:hash(2),name:'Right',kind:'thermal',metrics:[]}]});
const request=()=>({references:listing().cases.map(row=>({caseId:row.caseId,expectedRevision:row.revision})),...settings()});

test('portable JSON excludes runtime IDs and case arrays and resolves reordered reimported cases',()=>{
 const command=request(),current=listing(),before=structuredClone({command,current}),archive=captureComparisonView(command,current);
 assert.deepEqual(archive,{version:1,kind:'comparison-view',sources:[{revision:hash(1)},{revision:hash(2)}],settings:settings()});
 assert.doesNotMatch(JSON.stringify(archive),/left-old|right-old|metrics|archiveRevision|references/);
 const restored={cases:[{caseId:'right-new',revision:hash(2)},{caseId:'left-new',revision:hash(1)}]};
 const resolved=resolveComparisonView(JSON.parse(JSON.stringify(archive)),restored);
 assert.deepEqual(resolved,{references:[{caseId:'left-new',expectedRevision:hash(1)},{caseId:'right-new',expectedRevision:hash(2)}],...settings()});
 assert.deepEqual({command,current},before);
 resolved.camera.position[0]=999;assert.equal(archive.settings.camera.position[0],5);
});

test('missing changed or ambiguous saved cases fail without guessing a replacement',async()=>{
 const saved=[{name:'Left',output:{temperature:[20]}},{name:'Right',output:{temperature:[30]}}];
 const revisions=await Promise.all(saved.map(value=>getProjectRevision(value)));
 const current={cases:revisions.map((revision,i)=>({caseId:String(i),revision}))};
 const archive=captureComparisonView({references:current.cases.map(r=>({caseId:r.caseId,expectedRevision:r.revision})),...settings()},current);
 for(const change of [value=>value.name='Renamed',value=>value.output.temperature[0]=21]){
  const changed=structuredClone(saved[0]);change(changed);
  const next=structuredClone(current);next.cases[0].revision=await getProjectRevision(changed);
  assert.throws(()=>resolveComparisonView(archive,next),/revision is missing/);
 }
 const ambiguous=structuredClone(current);ambiguous.cases.push({caseId:'duplicate',revision:revisions[0]});
 assert.throws(()=>resolveComparisonView(archive,ambiguous),/ambiguous/);
 assert.throws(()=>captureComparisonView({references:current.cases.map(r=>({caseId:r.caseId,expectedRevision:r.revision})),...settings()},ambiguous),/ambiguous/);
 assert.throws(()=>resolveComparisonView(archive,{cases:[]}),/missing/);
});

test('capture refuses stale references duplicate IDs and indistinguishable source hashes',()=>{
 const current=listing();
 for(const change of [r=>r.references[0].expectedRevision=hash(3),r=>r.references[0].caseId='missing',r=>r.references[1]=r.references[0],r=>r.references[0].index=0]){
  const command=request();change(command);assert.throws(()=>captureComparisonView(command,current));
 }
 const duplicate=listing();duplicate.cases[1].revision=hash(1);
 assert.throws(()=>captureComparisonView({...settings(),references:duplicate.cases.map(r=>({caseId:r.caseId,expectedRevision:r.revision}))},duplicate),/archive/);
 assert.throws(()=>resolveComparisonView(captureComparisonView(request(),current),{cases:[current.cases[0],current.cases[0]]}),/listing/);
});

test('strict archive rejects unknown versions keys null non-JSON and physical data',()=>{
 const original=captureComparisonView(request(),listing());
 for(const mutate of [a=>a.version=2,a=>a.kind='case-view-bundle',a=>a.extra=true,a=>a.sources[0].caseId='runtime',a=>a.sources[0].revision='old',a=>a.sources.pop(),a=>a.sources[1]=a.sources[0],a=>a.settings.temperature=[20],a=>a.settings.field='unknown',a=>a.settings.camera=null]){
  const archive=structuredClone(original);mutate(archive);assert.throws(()=>validateComparisonViewSettings(archive));
 }
 for(const bad of [null,undefined,new Date(),()=>{},NaN])assert.throws(()=>validateComparisonViewSettings(bad));
 const cyclic=structuredClone(original);cyclic.self=cyclic;assert.throws(()=>validateComparisonViewSettings(cyclic),/Cyclic/);
 const accessor={get version(){assert.fail('Untrusted getter executed');}};assert.throws(()=>validateComparisonViewSettings(accessor),/JSON/);
 assert.deepEqual(validateComparisonViewSettings(original),original);
});

test('camera and options require finite nondegenerate values; optional time remains optional',()=>{
 for(const mutate of [s=>s.deformScale=-1,s=>s.timeSeconds=-1,s=>s.timeSeconds=Infinity,s=>s.toleranceSeconds=-.1,s=>delete s.timeSeconds,s=>s.camera.up=[0,0,0],s=>s.camera.up=[5,5,5],s=>s.camera.target=[5,5,5],s=>s.camera.fov=180,s=>s.camera.position=[NaN,0,0],s=>{s.camera.position=[1e308,1e308,1e308];s.camera.target=[-1e308,-1e308,-1e308];},s=>s.camera.extra=true]){
  const s=settings();mutate(s);assert.throws(()=>validateComparisonSettings(s));
 }
 const s=settings();delete s.timeSeconds;delete s.toleranceSeconds;s.field='stress';assert.deepEqual(validateComparisonSettings(s),s);
});
