import {canonicalJson} from './project-revision.js';

const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keys=(v,required,optional=[])=>plain(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const revision=v=>typeof v==='string'&&/^sha256:[a-f0-9]{64}$/.test(v);
const id=v=>typeof v==='string'&&v.length>0&&v.length<=200;
const fields=['displacement','stress','plasticStrain','temperature','heatFlux','instantPressure','pressure','spl','phase','speed','fluidPressure'];
const required=['field','deformScale','camera'],optional=['timeSeconds','toleranceSeconds'];
const clone=value=>JSON.parse(canonicalJson(value));

/** Presentation settings only. Shared time selects existing frames; it never creates solved data. */
export function validateComparisonSettings(raw){
 const s=clone(raw);
 if(!keys(s,required,optional)||!fields.includes(s.field)||!Number.isFinite(s.deformScale)||s.deformScale<0)throw Error('Invalid comparison settings');
 for(const key of optional)if(Object.hasOwn(s,key)&&(!Number.isFinite(s[key])||s[key]<0))throw Error('Invalid comparison '+key);
 if(Object.hasOwn(s,'toleranceSeconds')&&!Object.hasOwn(s,'timeSeconds'))throw Error('Comparison tolerance requires timeSeconds');
 const c=s.camera,vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
 if(!keys(c,['position','target','up','fov'])||![c.position,c.target,c.up].every(vector)||!Number.isFinite(c.fov)||c.fov<=0||c.fov>=180)throw Error('Invalid comparison camera');
 const d=c.target.map((v,i)=>v-c.position[i]),a=Math.hypot(...d),b=Math.hypot(...c.up),u=c.up,cross=Math.hypot(d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]);
 if(![...d,a,b,cross,a*b].every(Number.isFinite)||a<=1e-9||b<=1e-9||cross<=a*b*1e-9)throw Error('Degenerate comparison camera');
 return s;
}

export function validateComparisonViewSettings(raw){
 const archive=clone(raw);
 if(!keys(archive,['version','kind','sources','settings'])||archive.version!==1||archive.kind!=='comparison-view'||!Array.isArray(archive.sources)||archive.sources.length!==2||archive.sources.some(s=>!keys(s,['revision'])||!revision(s.revision))||archive.sources[0].revision===archive.sources[1].revision)throw Error('Invalid comparison view archive');
 archive.settings=validateComparisonSettings(archive.settings);return archive;
}

function rows(listing){
 const list=listing?.cases;
 if(!Array.isArray(list)||list.some(r=>!plain(r)||!id(r.caseId)||!revision(r.revision))||new Set(list.map(r=>r.caseId)).size!==list.length)throw Error('Invalid current comparison case listing');
 return list;
}

function match(sources,list){
 return sources.map(source=>{
  const matches=list.filter(row=>row.revision===source.revision);
  if(matches.length===0)throw Error('Comparison source revision is missing; restore the unchanged saved cases');
  if(matches.length!==1)throw Error('Comparison source revision is ambiguous');
  return {caseId:matches[0].caseId,expectedRevision:source.revision};
 });
}

/** Capture from current stable references; hashes include the saved name and all case content. */
export function captureComparisonView(raw,listing){
 const request=clone(raw);
 if(!keys(request,['references',...required],optional)||!Array.isArray(request.references)||request.references.length!==2||request.references.some(r=>!keys(r,['caseId','expectedRevision'])||!id(r.caseId)||!revision(r.expectedRevision))||request.references[0].caseId===request.references[1].caseId)throw Error('Invalid comparison view references');
 const list=rows(listing);
 for(const ref of request.references)if(!list.some(row=>row.caseId===ref.caseId&&row.revision===ref.expectedRevision))throw Error('Comparison case reference is stale');
 const {references,...settings}=request;
 const archive=validateComparisonViewSettings({version:1,kind:'comparison-view',sources:references.map(r=>({revision:r.expectedRevision})),settings});
 match(archive.sources,list);return archive;
}

/** Resolve portable hashes after case import/reordering; never guess between duplicate saved cases. */
export function resolveComparisonView(raw,listing){
 const archive=validateComparisonViewSettings(raw),references=match(archive.sources,rows(listing));
 return {references,...archive.settings};
}
