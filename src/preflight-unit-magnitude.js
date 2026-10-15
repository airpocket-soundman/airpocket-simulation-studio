const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
/** Unit-magnitude plausibility rules (WARNING only, never converting).
 * Fixed input units are those of the shared preflight/input contracts:
 * E Pa, density kg/m3, conductivity W/(m*K), specific heat J/(kg*K), force N,
 * pressure Pa, sound speed m/s, frequency Hz, reference pressure Pa.
 * A value is flagged when |value| is nonzero, finite and outside [min,max] for
 * the declared unit. Bounds are deliberately wide (soft foam .. diamond) so a
 * flag means "probably another unit prefix", e.g. 210 (GPa) or 2.1e5 (MPa) given
 * as Pa for Young's modulus. The value is never changed and is not an error. */
export const UNIT_MAGNITUDE_RULES=Object.freeze([
 {pointer:'/materialProperties/youngModulus',unit:'Pa',min:1e5,max:1e13,hint:'Values near 1e2 look like GPa and near 1e5 like MPa; convert to Pa'},
 {pointer:'/materialProperties/density',unit:'kg/m3',min:.01,max:3e4,hint:'Values above 3e4 may be g/m3 or a mass per different volume'},
 {pointer:'/materialProperties/conductivity',unit:'W/(m*K)',min:.005,max:5000,hint:'Check W/(m*K) versus mW/(m*K) or W/(cm*K)'},
 {pointer:'/materialProperties/specificHeat',unit:'J/(kg*K)',min:10,max:3e4,hint:'Values near 1 may be kJ/(kg*K); convert to J/(kg*K)'},
 {pointer:'/study/soundSpeed',unit:'m/s',min:50,max:2e4,hint:'Values near 0.34 look like km/s'},
 {pointer:'/study/airDensity',unit:'kg/m3',min:.01,max:2e4,hint:'Check kg/m3'},
 {pointer:'/study/frequency',unit:'Hz',min:.1,max:1e7,hint:'Values near 1e-3 may be kHz'},
 {pointer:'/study/referencePressurePa',unit:'Pa',min:1e-9,max:1e6,hint:'Check Pa versus bar or kPa'},
]);
/** Boundary rules by condition type; applied to /conditions/<i>/value. */
export const CONDITION_MAGNITUDE_RULES=Object.freeze({
 force:{unit:'N',min:1e-6,max:1e9,hint:'Check N versus kN/MN or mN'},
 pressure:{unit:'Pa',min:1e-3,max:1e11,hint:'Check Pa versus kPa/MPa or bar'},
 normalTraction:{unit:'Pa',min:1e-3,max:1e11,hint:'Check Pa versus kPa/MPa or bar'},
 heatFlux:{unit:'W/m2',min:1e-6,max:1e9,hint:'Check W/m2 versus W/mm2 or W/cm2'},
 convection:{unit:'W/(m2*K)',min:.1,max:1e6,hint:'Check W/(m2*K)'},
 acousticPressure:{unit:'Pa',min:1e-9,max:1e7,hint:'Check Pa versus dB or kPa'},
});
/** @returns warning diagnostics (severity 'warning', code UNIT_MAGNITUDE_SUSPECT) in a stable order. */
export function inspectUnitMagnitude(project){
 const out=[],walk=(value,path)=>path.slice(1).split('/').reduce((v,k)=>object(v)||Array.isArray(v)?v[k]:undefined,value);
 const check=(pointer,value,rule)=>{
  if(typeof value!=='number'||!Number.isFinite(value)||value===0)return;
  const magnitude=Math.abs(value);
  if(magnitude>=rule.min&&magnitude<=rule.max)return;
  out.push({code:'UNIT_MAGNITUDE_SUSPECT',severity:'warning',target:pointer,message:'Value magnitude is unusual for the fixed input unit; no conversion was applied',evidence:{value,unit:rule.unit,plausibleRange:[rule.min,rule.max],hint:rule.hint},suggestions:['Confirm the value is expressed in '+rule.unit+'; convert and record the conversion if it is not'],requiresUserIntent:false});
 };
 if(!object(project))return out;
 for(const rule of UNIT_MAGNITUDE_RULES)check(rule.pointer,walk(project,rule.pointer),rule);
 if(Array.isArray(project.conditions))project.conditions.forEach((condition,index)=>{
  const rule=object(condition)?CONDITION_MAGNITUDE_RULES[condition.type]:undefined;
  if(rule)check('/conditions/'+index+'/value',condition.value,rule);
 });
 return out;
}
