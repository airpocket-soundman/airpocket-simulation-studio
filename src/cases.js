import {validateProject} from './regions.js';
const metrics={channelFlow:[['maxSpeedMs','m/s'],['outletFlowM3s','m³/s']],elastic:[['maxDisplacementMm','mm'],['maxVonMisesPa','Pa']],thermal:[['minTemperature','°C'],['maxTemperature','°C']],acoustic:[['maxPressurePa','Pa peak'],['maxSplDb','dB RMS']]};
export function createCaseStore(){
 let cases=[];
 function validate(c){
  if(!c||typeof c.name!=='string'||!c.name.trim()||c.name.length>100)throw Error('Invalid case name');
  validateProject(c.output?.input);
  const o=c.output?.calculation?.options;
  if(c.output.calculation.operation!=='elastic'||!o||!Number.isFinite(o.size)||o.size<=0||!['pcg','pcg-strict','wasm-pcg','webgpu-pcg','mfem-wasm'].includes(o.method)||typeof o.adaptive!=='boolean'||!Number.isInteger(o.maxRounds)||o.maxRounds<1||o.maxRounds>5)throw Error('Invalid case calculation settings');
  for(const k of ['tolerance','stressTolerance'])if(o[k]!==undefined&&(!Number.isFinite(o[k])||o[k]<=0||o[k]>=1))throw Error('Invalid adaptive tolerance');
  if(o.maxAdaptiveElements!==undefined&&(!Number.isInteger(o.maxAdaptiveElements)||o.maxAdaptiveElements<1||o.maxAdaptiveElements>30000))throw Error('Invalid adaptive element limit');
  if(o.maxAdaptiveSeconds!==undefined&&(!Number.isFinite(o.maxAdaptiveSeconds)||o.maxAdaptiveSeconds<=0||o.maxAdaptiveSeconds>110))throw Error('Invalid adaptive time limit');
  const r=c.output.result;validateComputeMetadata(r);if(r?.hyperelastic&&(o.adaptive||!['pcg','pcg-strict','wasm-pcg'].includes(o.method)))throw Error('Saved hyperelastic cases require CPU and no adaptation');if(r?.kind!=='elastic'&&(o.adaptive||['webgpu-pcg','mfem-wasm'].includes(o.method)))throw Error('GPU and adaptive cases require structural results');
  if(!metrics[r?.kind]||metrics[r.kind].some(([k])=>!Number.isFinite(r[k])))throw Error('Invalid case result');
  if(c.output.input.study&&c.output.input.study.kind!==({elastic:'structural',thermal:'thermal',acoustic:'acoustic',channelFlow:'channelFlow'}[r.kind]))throw Error('Case discipline does not match result');
  if((r.kind==='channelFlow'&&r.maxSpeedMs<0)||(r.kind==='elastic'&&(r.maxDisplacementMm<0||r.maxVonMisesPa<0))||(r.kind==='thermal'&&(r.minTemperature<-273.15||r.minTemperature>r.maxTemperature))||(r.kind==='acoustic'&&r.maxPressurePa<0))throw Error('Invalid case result range');
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

export function validateComputeMetadata(result){if(result?.hyperelastic!==undefined){const h=result.hyperelastic;if(result.kind!=='elastic'||h?.model!=='neo-hookean-log'||h.stressMeasure!=='Cauchy'||h.strainMeasure!=='Green-Lagrange'||!Number.isInteger(h.loadSteps)||h.loadSteps<1||h.loadSteps>30||!Number.isInteger(h.newtonIterations)||h.newtonIterations<0||h.newtonIterations>h.loadSteps*50||!Number.isFinite(h.minJ)||h.minJ<=1e-8||!Array.isArray(h.history)||h.history.length!==h.loadSteps||h.history.some((v,i)=>v.step!==i+1||!Number.isFinite(v.loadFraction)||Math.abs(v.loadFraction-(i+1)/h.loadSteps)>1e-10||!Number.isInteger(v.newtonIterations)||v.newtonIterations<0||v.newtonIterations>50||!Number.isFinite(v.residual)||v.residual<0||v.residual>2e-8||!Number.isFinite(v.minJ)||v.minJ<=1e-8||!Number.isFinite(v.energyJ)))throw Error('Invalid saved hyperelastic convergence history');}if(result?.materialEvaluation!==undefined){const m=result.materialEvaluation;if(result.kind!=='elastic'||typeof m?.interpolated!=='boolean'||!Number.isFinite(m.temperatureMin)||m.temperatureMin<-273.15||!Number.isFinite(m.temperatureMax)||m.temperatureMax<m.temperatureMin||m.interpolated&&(!(m.youngModulus>0)||!Number.isFinite(m.youngModulus)||!Number.isFinite(m.poissonRatio)||m.poissonRatio<=-1||m.poissonRatio>=.49))throw Error('Invalid saved material evaluation');}const nonnegative=v=>Number.isFinite(v)&&v>=0;if(result?.performance!==undefined&&!nonnegative(result.performance?.solveMs))throw Error('Invalid saved compute timing');if(result?.native!==undefined){const n=result.native;if(result.kind!=='elastic'||n?.name!=='MFEM'||!Number.isInteger(n.version)||n.version<=0||!['nativeResidual','verifiedResidual'].every(k=>nonnegative(n[k])&&n[k]<=2e-8))throw Error('Invalid saved native solver verification');}const g=result?.gpu;if(g===undefined)return;if(result.kind!=='elastic'||typeof g?.used!=='boolean'||!nonnegative(g.totalMs))throw Error('Invalid saved GPU status');if(!g.used){if(typeof g.fallbackReason!=='string'||!g.fallbackReason)throw Error('Invalid saved GPU fallback');return;}if(!g.adapter||typeof g.adapter.description!=='string'||!g.adapter.description||![true,false,null].includes(g.adapter.isFallbackAdapter)||!['setupMs','gpuPhaseMs','cpuCorrectionMs','approximateResidual','initialExactResidual','verifiedResidual'].every(k=>nonnegative(g[k]))||!['gpuIterations','cpuCorrectionIterations'].every(k=>Number.isInteger(g[k])&&g[k]>=0&&g[k]<=2500)||g.verifiedResidual>2e-8||g.initialExactResidual>.01)throw Error('Invalid saved GPU verification');}
