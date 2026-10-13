export function validateFatigueData(p){
 if(p===undefined)return;
 const allowed=['model','stressRatio','snCurve','ultimateStrengthPa','yieldStressPa','testConditions','source'];
 if(!p||typeof p!=='object'||Array.isArray(p)||p.model!=='stress-life'||Object.keys(p).some(k=>!allowed.includes(k)))throw Error('Invalid fatigue data model or unknown field');
 if(p.stressRatio!==-1)throw Error('Fatigue S-N data requires fully reversed stress ratio -1');
 if(!Number.isFinite(p.yieldStressPa)||p.yieldStressPa<=0||!Number.isFinite(p.ultimateStrengthPa)||p.ultimateStrengthPa<=p.yieldStressPa)throw Error('Fatigue data requires ultimate strength greater than positive yield stress in Pa');
 for(const key of ['source','testConditions'])if(typeof p[key]!=='string'||!p[key].trim()||p[key].length>10000)throw Error('Fatigue data requires nonempty source and test conditions (maximum 10000 characters each)');
 const curve=p.snCurve;
 if(!Array.isArray(curve)||curve.length<2||curve.length>100)throw Error('Fatigue S-N curve requires 2–100 measured points');
 for(let i=0;i<curve.length;i++){
  const point=curve[i];
  if(!point||typeof point!=='object'||Array.isArray(point)||Object.keys(point).some(k=>!['stressAmplitudePa','cycles'].includes(k))||!Number.isFinite(point.stressAmplitudePa)||point.stressAmplitudePa<=0||!Number.isFinite(point.cycles)||point.cycles<=0||i>0&&(point.stressAmplitudePa>=curve[i-1].stressAmplitudePa||point.cycles<=curve[i-1].cycles))throw Error('Fatigue S-N points require strictly decreasing positive stress amplitudes in Pa and strictly increasing positive cycles');
 }
}
