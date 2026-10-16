const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const own=(value,key)=>Object.prototype.hasOwnProperty.call(value,key);
const thermalTypes=['temperature','heatFlux','heatPower','convection','radiation','thermalContact'];
const units={geometry:'mm',conductivity:'W/(m*K)',density:'kg/m3',specificHeat:'J/(kg*K)',temperature:'degC',initialTemperature:'degC',ambientTemperature:'degC',timeStep:'s',volumetricSource:'W/m3',heatFlux:'W/m2',heatPower:'W',heatTransferCoefficient:'W/(m2*K)',contactConductance:'W/(m2*K)',emissivity:'1'};
/** Pure pre-mesh physical-input declaration. It neither authenticates geometry
 * nor establishes component anchors, contact coverage or solution accuracy.
 * Numerical radiation seeds/iteration limits are not physical provenance inputs.
 * Legacy callers retain the existing project and solver validation path. */
export function inspectThermalInputContract(project,options={}, {mode='legacy'}={}){
 const requiredPointers=[],diagnostics=[],result={contract:'thermal-conduction',requiredPointers,diagnostics,units:{...units}};
 if(mode==='legacy')return result;
 const add=(code,target,message,evidence={})=>diagnostics.push({code,severity:'error',target,message,evidence,suggestions:['Provide the intended thermal input and record its source or an explicit exploratory assumption'],requiresUserIntent:true});
 const require=(pointer,value,valid,message,unit=units[pointer.split('/').at(-1)]??null)=>{requiredPointers.push(pointer);if(value===undefined||value===null)add('THERMAL_INPUT_REQUIRED',pointer,'Required explicit thermal input is missing',{unit});else if(!valid(value))add('THERMAL_INPUT_INVALID',pointer,message,{unit});};
 try{
  if(!['quantitative','exploratory'].includes(mode)){add('THERMAL_INPUT_INVALID','/analysisIntent','Invalid thermal contract mode');return result;}
  if(!object(project)||!object(options)){add('THERMAL_INPUT_INVALID','/','Thermal contract requires project and options objects');return result;}
  const study=object(project.study)?project.study:{},material=object(project.materialProperties)?project.materialProperties:{};
  require('/study/kind',study.kind,value=>value==='thermal','Thermal conduction requires study.kind thermal');
  require('/study/transient',study.transient,value=>typeof value==='boolean','Explicit boolean transient setting required');
  require('/study/volumetricSource',study.volumetricSource,Number.isFinite,'Volumetric heat generation must be finite W/m3');
  require('/materialProperties/conductivity',material.conductivity,value=>Number.isFinite(value)&&value>0,'Thermal conductivity must be positive W/(m*K)');
  if(study.transient===true){
   for(const key of ['density','specificHeat'])require('/materialProperties/'+key,material[key],value=>Number.isFinite(value)&&value>0,'Transient thermal material value must be positive');
   require('/study/timeStep',study.timeStep,value=>Number.isFinite(value)&&value>0,'Thermal time step must be positive seconds');
   require('/study/steps',study.steps,value=>Number.isInteger(value)&&value>=1&&value<=100,'Thermal steps must be an integer from 1 to 100');
   if(own(study,'thermalSnapshotCount'))require('/study/thermalSnapshotCount',study.thermalSnapshotCount,value=>Number.isInteger(value)&&value>=2&&value<=61,'Thermal snapshot count must be an integer from 2 to 61 (omit to store no nodal snapshots)');
   require('/study/initialTemperature',study.initialTemperature,value=>Number.isFinite(value)&&value>=-273.15,'Initial temperature must be finite and at least absolute zero in degC');
  }
  for(const key of ['transient','timeStep','steps','initialTemperature','volumetricSource'])if(own(options,key)&&options[key]!==study[key])add('THERMAL_RUNTIME_OVERRIDE','/options/'+key,'Runtime thermal override differs from the provenance-bearing project study',{studyPointer:'/study/'+key});
  const conditions=Array.isArray(project.conditions)?project.conditions:[];
  if(!Array.isArray(project.conditions))add('THERMAL_INPUT_INVALID','/conditions','Expected an explicit boundary condition array');
  let anchored=false;
  conditions.forEach((condition,index)=>{
   const base='/conditions/'+index,c=object(condition)?condition:{};
   require(base+'/type',c.type,value=>thermalTypes.includes(value),'Boundary condition must belong to thermal conduction');
   if(c.type!==undefined&&!thermalTypes.includes(c.type))add('THERMAL_CONDITION_DISCIPLINE_MISMATCH',base+'/type','Boundary condition belongs to another discipline');
   const physicalValue=value=>Number.isFinite(value)&&(c.type!=='temperature'||value>=-273.15)&&(!['convection','thermalContact','radiation'].includes(c.type)||value>0)&&(c.type!=='radiation'||value<=1);
   const boundaryUnit={temperature:'degC',heatFlux:'W/m2',heatPower:'W',convection:'W/(m2*K)',thermalContact:'W/(m2*K)',radiation:'1'}[c.type]??null;
   require(base+'/value',c.value,physicalValue,'Invalid thermal boundary value or value below absolute zero',boundaryUnit);
   const validRegions=regions=>Array.isArray(regions)&&regions.length>0&&regions.every(region=>object(region)&&Number.isInteger(region.mesh)&&region.mesh>=0&&Array.isArray(project.meshes)&&object(project.meshes[region.mesh])&&Array.isArray(region.triangles)&&region.triangles.length>0&&region.triangles.every(triangle=>Number.isInteger(triangle)&&triangle>=0&&triangle<(project.meshes[region.mesh].faceIds?.length??0)));
   require(base+'/regions',c.regions,validRegions,'Thermal boundary requires valid nonempty display regions');
   for(const key of ['planarRegion','cylindricalRegion'])if(c[key]!==undefined)requiredPointers.push(base+'/'+key);
   if(['convection','radiation'].includes(c.type))require(base+'/ambientTemperature',c.ambientTemperature,value=>Number.isFinite(value)&&value>=-273.15,'Ambient temperature must be finite and at least absolute zero in degC');
   if(c.type==='thermalContact'&&(!validRegions(c.regions)||c.regions.length!==2||c.regions[0].mesh===c.regions[1].mesh))add('THERMAL_CONTACT_INVALID',base+'/regions','Thermal contact requires two distinct part regions');
   if(['temperature','convection','radiation'].includes(c.type)&&physicalValue(c.value)&&validRegions(c.regions)&&!c.cadUpdateRequired&&(!['convection','radiation'].includes(c.type)||Number.isFinite(c.ambientTemperature)&&c.ambientTemperature>=-273.15))anchored=true;
  });
  if(study.transient===false&&!anchored)add('THERMAL_STEADY_ANCHOR_MISSING','/conditions','Steady heat conduction needs a temperature, convection or radiation boundary; each connected component remains a post-mesh check');
 }catch{add('THERMAL_INPUT_INVALID','/','Malformed thermal input cannot be inspected');}
 return result;
}
