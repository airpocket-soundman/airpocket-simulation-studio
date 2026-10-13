import {validateProject} from './regions.js';
const metrics={elastic:[['maxDisplacementMm','mm'],['maxVonMisesPa','Pa']],thermal:[['minTemperature','°C'],['maxTemperature','°C']],acoustic:[['maxPressurePa','Pa peak'],['maxSplDb','dB RMS']]};
export function createCaseStore(){
 let cases=[];
 function validate(c){
  if(!c||typeof c.name!=='string'||!c.name.trim()||c.name.length>100)throw Error('Invalid case name');
  validateProject(c.output?.input);
  const o=c.output?.calculation?.options;
  if(!o||!Number.isFinite(o.size)||o.size<=0||!['pcg','pcg-strict','wasm-pcg'].includes(o.method)||typeof o.adaptive!=='boolean'||!Number.isInteger(o.maxRounds)||o.maxRounds<1||o.maxRounds>5)throw Error('Invalid case calculation settings');
  const r=c.output.result;
  if(!metrics[r?.kind]||metrics[r.kind].some(([k])=>!Number.isFinite(r[k])))throw Error('Invalid case result');
  return structuredClone(c);
 }
 return Object.freeze({
  list:()=>structuredClone(cases),
  add(name,output){if(cases.length>=8)throw Error('Maximum 8 cases');const c=validate({name,output});cases.push(c);return structuredClone(c);},
  remove(index){if(!Number.isInteger(index)||!cases[index])throw Error('Unknown case');cases.splice(index,1);},
  export:()=>({version:1,cases:structuredClone(cases)}),
  import(archive){if(archive?.version!==1||!Array.isArray(archive.cases)||archive.cases.length>8)throw Error('Invalid case archive');const next=archive.cases.map(validate);cases=next;},
  compare:()=>cases.map(c=>({name:c.name,kind:c.output.result.kind,metrics:metrics[c.output.result.kind].map(([key,unit])=>({key,unit,value:c.output.result[key]}))}))
 });
}
