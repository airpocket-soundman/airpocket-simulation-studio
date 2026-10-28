// Dumbbell measurement specimen and planned-condition 3MF package (work order 74 PRINTMEASURE2).
// Every dimension and process value comes from the caller; no standard dimensions are built in.
// The package is a core 3MF with an attached plan JSON; Bambu Studio acceptance is not verified here.
import {readPrintZip} from './print-zip.js';
import {parsePrint3mf} from './print-3mf.js';

export const SPECIMEN_SCHEMA_VERSION=1;
export const SPECIMEN_PLAN_PATH='Metadata/airpocket_specimen_plan.json';
export const SPECIMEN_ORIENTATIONS=Object.freeze(['flat','on-edge','upright']);
const core='http://schemas.microsoft.com/3dmanufacturing/core/2015/02';
const dimensionKeys=['overallLength','gripWidth','narrowWidth','parallelLength','filletRadius','thickness'];
const processKeys=['layerHeight','wallLoops','infillDensity','infillPattern','topShellLayers','bottomShellLayers'];
// Settings the plan leaves to the user (temperatures, material, printer); they are recorded after slicing, not here.
export const USER_CHOSEN_SETTINGS=Object.freeze(['filament','nozzleTemperature','bedTemperature','drying','printer','nozzleDiameter','lineWidth','speed','cooling']);

const positive=(v,name,max=1e4)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<=0||v>max)throw Error(`Specimen ${name} must be a finite number in (0, ${max}]`);return v;};
const count=(v,name)=>{if(!Number.isSafeInteger(v)||v<0||v>100)throw Error(`Specimen ${name} must be an integer in [0, 100]`);return v;};
const text=(v,name)=>{if(typeof v!=='string'||!/^[A-Za-z0-9._-]{1,64}$/.test(v))throw Error(`Specimen ${name} must be 1-64 characters of A-Z a-z 0-9 . _ -`);return v;};
function exactKeys(o,keys,name){if(!o||typeof o!=='object'||Array.isArray(o))throw Error(`Specimen ${name} must be an object`);const extra=Object.keys(o).filter(k=>!keys.includes(k)),missing=keys.filter(k=>!Object.hasOwn(o,k));if(extra.length||missing.length)throw Error(`Specimen ${name} fields mismatch: missing [${missing}] extra [${extra}]`);}

export function validateSpecimenPlan(plan){
 exactKeys(plan,['specimenId','specimenVersion','shape','dimensionsMm','orientation','process'],'plan');
 text(plan.specimenId,'specimenId');if(!Number.isSafeInteger(plan.specimenVersion)||plan.specimenVersion<1)throw Error('Specimen specimenVersion must be a positive integer');
 if(plan.shape!=='dumbbell')throw Error('Only the dumbbell specimen shape is supported');
 exactKeys(plan.dimensionsMm,dimensionKeys,'dimensionsMm');for(const k of dimensionKeys)positive(plan.dimensionsMm[k],k);
 if(!SPECIMEN_ORIENTATIONS.includes(plan.orientation))throw Error('Specimen orientation must be one of '+SPECIMEN_ORIENTATIONS.join(', '));
 exactKeys(plan.process,processKeys,'process');positive(plan.process.layerHeight,'layerHeight',10);count(plan.process.wallLoops,'wallLoops');count(plan.process.topShellLayers,'topShellLayers');count(plan.process.bottomShellLayers,'bottomShellLayers');
 if(typeof plan.process.infillDensity!=='number'||!(plan.process.infillDensity>=0&&plan.process.infillDensity<=1))throw Error('Specimen infillDensity must be a fraction in [0, 1]');text(plan.process.infillPattern,'infillPattern');
 const {overallLength:L,gripWidth:W,narrowWidth:b,parallelLength:Lc,filletRadius:R}=plan.dimensionsMm;
 if(b>=W)throw Error('Specimen narrowWidth must be smaller than gripWidth');
 if((W-b)/2>R)throw Error('Specimen filletRadius must be at least half the width step for a tangent transition');
 const theta=Math.acos(1-(W-b)/(2*R)),transitionEnd=Lc/2+R*Math.sin(theta);
 if(transitionEnd>=L/2)throw Error('Specimen overallLength leaves no grip length after the parallel section and fillets');
 return {theta,transitionEnd};
}

// Half-width profile y(x) for x in [0, L/2], sampled with arcSegments per fillet.
function profile(plan,arcSegments){
 const {overallLength:L,narrowWidth:b,parallelLength:Lc,filletRadius:R}=plan.dimensionsMm,{theta}=validateSpecimenPlan(plan),pts=[[0,b/2],[Lc/2,b/2]];
 for(let i=1;i<=arcSegments;i++){const a=theta*i/arcSegments;pts.push([Lc/2+R*Math.sin(a),b/2+R-R*Math.cos(a)]);}
 pts.push([L/2,pts.at(-1)[1]]);return pts;
}

export function buildDumbbellSpecimen(plan,{arcSegments=16}={}){
 if(!Number.isSafeInteger(arcSegments)||arcSegments<1||arcSegments>256)throw Error('Specimen arcSegments must be an integer in [1, 256]');
 const half=profile(plan,arcSegments),xs=[...half.slice(1).reverse().map(([x,y])=>[-x,y]),...half],t=plan.dimensionsMm.thickness;
 // Vertex ring per x station: top-bottom (y=+h,-h) at z=0 and z=t.
 const vertices=[],triangles=[],n=xs.length;
 for(const [x,h] of xs)vertices.push([x,-h,0],[x,h,0],[x,-h,t],[x,h,t]);
 const v=(i,k)=>4*i+k,quad=(a,b,c,d)=>triangles.push([a,b,c],[a,c,d]);
 for(let i=0;i<n-1;i++){const j=i+1;
  quad(v(i,0),v(i,1),v(j,1),v(j,0));// bottom z=0, normal -z
  quad(v(i,2),v(j,2),v(j,3),v(i,3));// top z=t, normal +z
  quad(v(i,0),v(j,0),v(j,2),v(i,2));// side y<0
  quad(v(i,1),v(i,3),v(j,3),v(j,1));// side y>0
 }
 quad(v(0,0),v(0,2),v(0,3),v(0,1));quad(v(n-1,0),v(n-1,1),v(n-1,3),v(n-1,2));// end caps
 // Build orientation: flat keeps thickness on Z; on-edge puts width on Z; upright puts length on Z.
 const rotate={flat:p=>p,'on-edge':([x,y,z])=>[x,z,y],upright:([x,y,z])=>[y,z,x]}[plan.orientation];
 const swapsHandedness=plan.orientation==='on-edge';// the single swap is a reflection; the cyclic upright map is a rotation
 let placed=vertices.map(rotate);const min=[0,1,2].map(i=>Math.min(...placed.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...placed.map(p=>p[i])));
 const shift=[-(min[0]+max[0])/2,-(min[1]+max[1])/2,-min[2]];placed=placed.map(p=>p.map((c,i)=>c+shift[i]));
 return {vertices:placed,triangles:swapsHandedness?triangles.map(([a,b,c])=>[a,c,b]):triangles,boundsMm:[...min.map((c,i)=>c+shift[i]),...max.map((c,i)=>c+shift[i])],arcSegments};
}

const strToU8=s=>new TextEncoder().encode(s);
const crcTable=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=bytes=>{let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
// Minimal stored (uncompressed) ZIP writer with a fixed DOS timestamp so identical plans give identical bytes.
function zipStored(files){
 const parts=[],central=[];let offset=0;const time=0,date=((2026-1980)<<9)|(1<<5)|1;
 for(const [name,data] of Object.entries(files)){const n=strToU8(name),crc=crc32(data),h=new DataView(new ArrayBuffer(30)),c=new DataView(new ArrayBuffer(46));
  for(const [view,sig] of [[h,0x04034b50],[c,0x02014b50]])view.setUint32(0,sig,true);
  const fields=(view,base)=>{view.setUint16(base,20,true);view.setUint16(base+2,0x800,true);view.setUint16(base+4,0,true);view.setUint16(base+6,time,true);view.setUint16(base+8,date,true);view.setUint32(base+10,crc,true);view.setUint32(base+14,data.length,true);view.setUint32(base+18,data.length,true);view.setUint16(base+22,n.length,true);};
  fields(h,4);c.setUint16(4,20,true);fields(c,6);c.setUint32(42,offset,true);
  parts.push(new Uint8Array(h.buffer),n,data);central.push(new Uint8Array(c.buffer),n);offset+=30+n.length+data.length;}
 const size=central.reduce((s,b)=>s+b.length,0),end=new DataView(new ArrayBuffer(22)),count=Object.keys(files).length;
 end.setUint32(0,0x06054b50,true);end.setUint16(8,count,true);end.setUint16(10,count,true);end.setUint32(12,size,true);end.setUint32(16,offset,true);
 const all=[...parts,...central,new Uint8Array(end.buffer)],out=new Uint8Array(all.reduce((s,b)=>s+b.length,0));let at=0;for(const b of all){out.set(b,at);at+=b.length;}return out;
}
const num=x=>Number(x.toPrecision(12)).toString();
const escape=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function sha256(bytes){return [...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');}
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);

export async function writeSpecimen3mf(plan,options={}){
 validateSpecimenPlan(plan);const mesh=buildDumbbellSpecimen(plan,options),name=`${plan.specimenId}-v${plan.specimenVersion}`;
 const model=`<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="${core}">\n <metadata name="Title">${escape(name)}</metadata>\n <metadata name="Application">airpocket-simulation-studio printed-measurement-specimen</metadata>\n <resources>\n  <object id="1" type="model" name="${escape(name)}">\n   <mesh>\n    <vertices>\n${mesh.vertices.map(p=>`     <vertex x="${num(p[0])}" y="${num(p[1])}" z="${num(p[2])}"/>`).join('\n')}\n    </vertices>\n    <triangles>\n${mesh.triangles.map(t=>`     <triangle v1="${t[0]}" v2="${t[1]}" v3="${t[2]}"/>`).join('\n')}\n    </triangles>\n   </mesh>\n  </object>\n </resources>\n <build>\n  <item objectid="1" partnumber="${escape(name)}"/>\n </build>\n</model>\n`;
 const modelBytes=strToU8(model),geometrySha256=await sha256(modelBytes),planSha256=await sha256(strToU8(canonical(plan)));
 const record={schemaVersion:SPECIMEN_SCHEMA_VERSION,kind:'airpocket-printed-measurement-specimen',plan,geometry:{part:'3D/3dmodel.model',sha256:geometrySha256,boundsMm:mesh.boundsMm,arcSegments:mesh.arcSegments,triangleCount:mesh.triangles.length},planSha256,
  userChosenSettings:USER_CHOSEN_SETTINGS,slicedSettings:null,
  notes:['Process values are the planned test conditions, not settings verified after slicing.','Temperatures, material and printer settings are chosen by the user in the slicer and must be reconciled afterwards.','No Bambu project_settings.config is written; Bambu Studio acceptance of this package is unverified.']};
 const files={'[Content_Types].xml':strToU8('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="json" ContentType="application/json"/></Types>\n'),
  '_rels/.rels':strToU8('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>\n'),
  '3D/3dmodel.model':modelBytes,[SPECIMEN_PLAN_PATH]:strToU8(JSON.stringify(record,null,1)+'\n')};
 const bytes=zipStored(files);
 return {bytes,fileName:name+'.3mf',record,sha256:await sha256(bytes)};
}

// Re-read a package written above: geometry through the existing 3MF importer, plan through the JSON part, hashes rechecked.
export async function readSpecimen3mf(data,options){
 const zip=readPrintZip(data);if(!zip.names.includes(SPECIMEN_PLAN_PATH))throw Error('3MF package has no measurement specimen plan');
 let record;try{record=JSON.parse(zip.text(SPECIMEN_PLAN_PATH));}catch{throw Error('Invalid measurement specimen plan JSON');}
 if(record?.schemaVersion!==SPECIMEN_SCHEMA_VERSION||record.kind!=='airpocket-printed-measurement-specimen')throw Error('Unsupported measurement specimen plan version');
 validateSpecimenPlan(record.plan);
 if(await sha256(strToU8(canonical(record.plan)))!==record.planSha256)throw Error('Measurement specimen plan hash mismatch');
 if(await sha256(zip.read(record.geometry.part))!==record.geometry.sha256)throw Error('Measurement specimen geometry hash mismatch');
 const parsed=parsePrint3mf(data,options);if(parsed.geometries.length!==1)throw Error('Measurement specimen package must contain one object');
 const p=parsed.geometries[0].positions,bounds=[0,1,2].map(i=>Math.min(...p.filter((_,k)=>k%3===i))).concat([0,1,2].map(i=>Math.max(...p.filter((_,k)=>k%3===i))));
 if(bounds.some((v,i)=>Math.abs(v-record.geometry.boundsMm[i])>1e-6))throw Error('Measurement specimen geometry bounds do not match the plan');
 return {plan:record.plan,record,geometry:parsed.geometries[0],boundsMm:bounds,triangleCount:parsed.triangleCount};
}
