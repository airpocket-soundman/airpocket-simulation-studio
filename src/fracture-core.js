// Mode-I LEFM screening using an uncracked nominal stress field.
// Ranges are deterministic bounds, not statistical confidence intervals.
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const record=(v,keys)=>object(v)&&Object.keys(v).every(k=>keys.includes(k));
const text=v=>typeof v==='string'&&!!v.trim()&&v.length<=10000;
const interval=(v,positive=true)=>Array.isArray(v)&&v.length===2&&v.every(Number.isFinite)&&v[0]<=v[1]&&(!positive||v[0]>0);
export function validateFractureData(d){
 if(d===undefined)return;
 if(!record(d,['model','toughnessRangePaSqrtM','source','testConditions','surfaceCondition','temperatureRangeC'])||d.model!=='lefm-mode-i'||!interval(d.toughnessRangePaSqrtM)||!interval(d.temperatureRangeC,false)||d.temperatureRangeC[0]<-273.15||!['source','testConditions','surfaceCondition'].every(k=>text(d[k])))throw Error('Fracture data requires mode-I toughness bounds, temperature range, source, test conditions and surface state');
}
export function validateFractureOptions(o){
 if(!record(o,['flawSizeRangeMm','geometryFactorRange','geometrySource','crackNormal','residualNormalStressRangePa','stressAssumption'])||!interval(o.flawSizeRangeMm)||!interval(o.geometryFactorRange)||!interval(o.residualNormalStressRangePa,false)||!text(o.geometrySource)||!text(o.stressAssumption)||!Array.isArray(o.crackNormal)||o.crackNormal.length!==3||!o.crackNormal.every(Number.isFinite)||Math.abs(Math.hypot(...o.crackNormal)-1)>1e-8)throw Error('Fracture assessment requires positive flaw/geometry bounds, a unit crack normal and documented nominal stress assumptions');
}
export function evaluateFracture(r,properties,options){
 const d=properties?.fractureData;validateFractureData(d);if(!d)throw Error('Fracture assessment requires registered toughness and surface data');validateFractureOptions(options);
 if(r?.kind!=='elastic'||r.orthotropic||properties.orthotropic||r.plasticity||r.hyperelastic||properties.plasticity||properties.hyperelastic||r.thermalStress||r.temperature!==undefined||r.referenceTemperature!=null||r.thermalStrains?.some(row=>!Array.isArray(row)||row.some(v=>!Number.isFinite(v)||v!==0)))throw Error('Fracture assessment requires linear elasticity without thermal stress or nonlinear materials');
 if(!Array.isArray(r.stresses)||!r.stresses.length||r.stresses.length>30000||r.stresses.some(s=>!Array.isArray(s)||s.length!==6||!s.every(Number.isFinite)))throw Error('Fracture assessment requires finite six-component element stresses in Pa');
 const temperature=r.materialEvaluation;if(!temperature||![temperature.temperatureMin,temperature.temperatureMax].every(Number.isFinite)||temperature.temperatureMin<d.temperatureRangeC[0]||temperature.temperatureMax>d.temperatureRangeC[1])throw Error('Fracture toughness does not cover the result temperature');
 const normalStressPa=[],intensityRangePaSqrtM=[],utilizationRange=[],criticalFlawRangeMm=[],classification=[],n=options.crackNormal;
 for(const s of r.stresses){
  const scale=Math.max(...s.map(Math.abs)),v=scale?s.map(x=>x/scale):s,t=[v[0]*n[0]+v[3]*n[1]+v[5]*n[2],v[3]*n[0]+v[1]*n[1]+v[4]*n[2],v[5]*n[0]+v[4]*n[1]+v[2]*n[2]],normal=t.reduce((sum,x,i)=>sum+x*n[i],0),shear=Math.hypot(...t.map((x,i)=>x-normal*n[i]));
  if(shear>1e-5)throw Error('Fracture assessment rejects mixed-mode shear on the specified crack plane');
  const stress=normal*scale,opening=options.residualNormalStressRangePa.map(x=>Math.max(0,stress+x)),k=opening.map((x,i)=>options.geometryFactorRange[i]*x*Math.sqrt(Math.PI*options.flawSizeRangeMm[i]*.001)),u=[k[0]/d.toughnessRangePaSqrtM[1],k[1]/d.toughnessRangePaSqrtM[0]];
  const critical=[opening[1]>0?1000/Math.PI*(d.toughnessRangePaSqrtM[0]/(options.geometryFactorRange[1]*opening[1]))**2:null,opening[0]>0?1000/Math.PI*(d.toughnessRangePaSqrtM[1]/(options.geometryFactorRange[0]*opening[0]))**2:null];
  if(![stress,...opening,...k,...u,...critical.filter(x=>x!==null)].every(Number.isFinite))throw Error('Fracture assessment exceeded the numerical range');
  normalStressPa.push(stress);intensityRangePaSqrtM.push(k);utilizationRange.push(u);criticalFlawRangeMm.push(critical);classification.push(u[0]>=1?'reaches-toughness':u[1]>=1?'uncertain':'below-toughness');
 }
 const maxUtilizationRange=[Math.max(...utilizationRange.map(x=>x[0])),Math.max(...utilizationRange.map(x=>x[1]))],counts=Object.fromEntries(['below-toughness','uncertain','reaches-toughness'].map(k=>[k,classification.filter(x=>x===k).length]));
 return {kind:'fracture',model:'lefm-mode-i',options:structuredClone(options),fractureData:structuredClone(d),normalStressPa,intensityRangePaSqrtM,utilizationRange,criticalFlawRangeMm,classification,maxUtilizationRange,counts};
}
export function validateFractureResult(mesh,r,input,calculation){
 const f=r?.fracture,requested=calculation?.options?.fractureAssessment;if(f===undefined){if(requested!==undefined)throw Error('Saved fracture request has no assessment');return;}
 if(input?.study?.kind!=='structural'||input.study.modalAnalysis||input.study.thermalStress||!Array.isArray(mesh?.tetrahedra)||r.stresses?.length!==mesh.tetrahedra.length)throw Error('Invalid saved fracture scope');
 if(r.materialEvaluation?.temperatureMin!==(input.study.materialTemperature??20)||r.materialEvaluation?.temperatureMax!==(input.study.materialTemperature??20))throw Error('Saved fracture temperature does not match its input');
 const expected=evaluateFracture(r,input.materialProperties,requested??f.options);
 // The snapshot preserves its exact registered data; derived values may round.
 function equal(a,b,path=''){
  if(typeof b==='number')return Number.isFinite(a)&&(path.startsWith('.options')||path.startsWith('.fractureData')||b===0?a===b:Math.abs(a-b)<=Math.abs(b)*1e-8);
  if(Array.isArray(b))return Array.isArray(a)&&a.length===b.length&&b.every((v,i)=>equal(a[i],v,path+'.'+i));
  if(object(b))return object(a)&&Object.keys(a).length===Object.keys(b).length&&Object.keys(b).every(k=>Object.hasOwn(a,k)&&equal(a[k],b[k],path+'.'+k));
  return a===b;
 }
 if(!equal(f,expected))throw Error('Saved fracture assessment does not match stresses, flaw assumptions or toughness data');
}
