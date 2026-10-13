import catalog from './polymer-catalog.json' with {type:'json'};
import {validateMaterialProperties} from './materials.js';
export const catalogVersion=catalog.version;
export function validateMaterialCatalog(data){
 if(data?.schemaVersion!==1||typeof data.version!=='string'||!Array.isArray(data.materials)||!data.materials.length)throw Error('Invalid polymer catalog');const ids=new Set();
 for(const m of data.materials){if(typeof m.id!=='string'||ids.has(m.id)||!m.manufacturer||!m.grade||!m.family||!m.polymer||!['manufacturer-tds','experimental'].includes(m.kind)||!m.filler||!['unfilled','glassFiber','longGlassFiber','glassBead','talc'].includes(m.filler.type)||!Number.isFinite(m.filler.contentPercent)||m.filler.contentPercent<0||m.filler.contentPercent>100||!['none','not-stated','weight-percent'].includes(m.filler.basis)||(m.filler.type==='unfilled')!==(m.filler.contentPercent===0)||!m.source?.url?.startsWith('https://')||!m.source.document||!m.source.revision||!Number.isFinite(Date.parse(m.source.retrievedAt))||m.source.sha256!==null&&!/^[a-f0-9]{64}$/.test(m.source.sha256)||m.kind==='manufacturer-tds'&&m.source.sha256===null||!m.properties||!m.conditions||!Array.isArray(m.missing))throw Error('Invalid polymer catalog entry');ids.add(m.id);
  for(const [key,p]of Object.entries(m.properties)){const units={tensileModulus:'Pa',tensileStrength:'Pa',tensileStrengthAtBreak:'Pa',flexuralModulus:'Pa',flexuralStrength:'Pa',density:'kg/m3',expansionFlow:'1/K',vicatTemperature:'degC'};if(!(key in units)||p.unit!==units[key]||!Number.isFinite(p.value)||p.value<=0||!p.method||key==='density'&&(p.value<100||p.value>5000)||key.endsWith('Modulus')&&(p.value<1e6||p.value>1e12))throw Error('Invalid published polymer property');}
 }return data;
}
validateMaterialCatalog(catalog);
export function catalogEntries({family='',filler='',contentPercent,search='',includeExperimental=false}={}){
 const q=String(search).trim().toLowerCase();return catalog.materials.filter(m=>(includeExperimental||m.kind!=='experimental')&&(!family||m.family===family)&&(!filler||m.filler.type===filler)&&(contentPercent===undefined||m.filler.contentPercent===contentPercent)&&(!q||[m.grade,m.manufacturer,m.polymer,m.family,String(m.filler.contentPercent)].join(' ').toLowerCase().includes(q))).map(m=>structuredClone(m));
}
export function catalogEntry(id){const m=catalog.materials.find(m=>m.id===id);if(!m)throw Error('Unknown material catalog entry');return structuredClone(m);}
export function catalogFamilies(){return [...new Set(catalog.materials.map(m=>m.family))];}
export function createCatalogMaterial(id,{poissonRatio,isotropicApproximation=false,allowExperimental=false}={}){
 const m=catalogEntry(id);if(!isotropicApproximation)throw Error('Confirm the isotropic linear approximation before using specimen data');
 if(m.kind==='experimental'&&!allowExperimental)throw Error('Experimental formulations require explicit selection');
 if(!Number.isFinite(poissonRatio)||poissonRatio<=-1||poissonRatio>=.5)throw Error('Specify a user-assumed Poisson ratio between -1 and 0.5');
 const p={youngModulus:m.properties.tensileModulus?.value??null,density:m.properties.density?.value??null,strength:m.properties.tensileStrength?.value??null,poissonRatio,grade:m.grade,source:m.manufacturer+' | '+m.source.url+' | '+m.source.revision+' | checked '+m.source.retrievedAt,notes:'Catalog '+m.id+'; '+m.polymer+'; '+m.filler.type+' '+m.filler.contentPercent+'% ('+m.filler.basis+'). Tensile modulus: '+(m.properties.tensileModulus?.method||'not published')+'. Typical specimen values; not a failure model. Isotropic linear approximation; Poisson ratio '+poissonRatio+' is a user assumption. Temperature/rate/directional dependence, creep and nonlinear behavior are not calibrated. '+(m.kind==='experimental'?'Experimental formulation, not a commercial grade. ':'')+m.notes};
 p.catalogSelection={version:1,id:m.id,catalogVersion,grade:m.grade,manufacturer:m.manufacturer,polymer:m.polymer,kind:m.kind,filler:structuredClone(m.filler),source:structuredClone(m.source),approximation:'isotropic-linear',poissonRatioOrigin:'user-assumption',appliedProperties:Object.fromEntries(['youngModulus','density','strength','poissonRatio'].map(key=>[key,p[key]])),overrides:{}};
 return validateMaterialProperties(p);
}
