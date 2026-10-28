/** Animate geometry display only. Saved displacements and scalar result values stay fixed. */
export function createComparisonDeformationPlan(outputs,options={}){
 const {field,deformScale}=options;
 if(!Array.isArray(outputs)||outputs.length!==2||!['displacement','stress'].includes(field))throw Error('Deformation comparison requires two linear elastic displacement or stress results');
 if(!Number.isFinite(deformScale)||deformScale<=0)throw Error('Comparison deformation scale must be finite and positive');
 if(['timeSeconds','startTimeSeconds','endTimeSeconds','toleranceSeconds'].some(key=>Object.hasOwn(options,key)))throw Error('Deformation comparison does not accept physical time settings');
 for(const output of outputs){
  const result=output?.result,nodes=output?.mesh?.nodes,displacement=result?.displacement;
  if(result?.kind!=='elastic'||result.hyperelastic!==undefined||result.plasticity!==undefined)throw Error('Deformation comparison supports linear elastic results only');
  if(!Array.isArray(nodes)||nodes.length<3||nodes.length%3||!nodes.every(Number.isFinite)||!Array.isArray(displacement)||displacement.length!==nodes.length||!displacement.every(Number.isFinite)||!displacement.some(v=>v!==0))throw Error('Deformation comparison requires finite nonzero stored nodal displacement in each case');
  if(nodes.some((v,i)=>!Number.isFinite(Math.fround(v))||!Number.isFinite(Math.fround(v+displacement[i]*deformScale))))throw Error('Comparison deformation display coordinates overflow at the requested scale');
  const values=field==='displacement'?result.magnitudes:result.vonMises,count=field==='displacement'?nodes.length/3:output.mesh.tetrahedra?.length;
  if(!Number.isSafeInteger(count)||count<1||!Array.isArray(values)||values.length!==count||!values.every(v=>Number.isFinite(v)&&v>=0))throw Error('Invalid stored deformation comparison field');
 }
 return {atPhase(phase){if(!Number.isFinite(phase)||phase<0||phase>1)throw Error('Invalid comparison deformation phase');return {deformScale:phase===1?deformScale:deformScale*phase};},summary:{kind:'elastic',field,scalePolicy:'linear',startScale:0,endScale:deformScale,visualizationOnly:true,camera:'fixed',resultValues:'fixed-saved-result',loadHistory:false}};
}

/** One entry per encoded comparison GIF frame: the display multiplier actually drawn in both panels. */
export function createComparisonDeformationFrames(plan){
 const entries=[];
 return {
  reset(){entries.length=0;},
  record(phase){if(entries.length>=24)throw Error('Comparison deformation frames exceed the GIF frame count');entries.push({renderIndex:entries.length,phase,deformScale:plan.atPhase(phase).deformScale});},
  snapshot(){return structuredClone({schemaVersion:1,mapping:'One entry per encoded GIF frame, in output order. Both panels use the same display multiplier; saved displacement and scalar values are unchanged.',scalePolicy:plan.summary.scalePolicy,endScale:plan.summary.endScale,entries});}
 };
}
