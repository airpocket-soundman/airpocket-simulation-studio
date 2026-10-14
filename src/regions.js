import {validateStlSource} from './stl-source.js';
import {validatePendingCadCondition} from './cad-update-state.js';
import {validateStokesStudy} from './stokes-study.js';
import {validatePlanarRegion,planarTriangles} from './planar-region.js';
import {validateVibrationStudy} from './vibration-source.js';
import {validateTransientAcousticStudy} from './acoustic-transient.js';
import {validateFarFieldStudy} from './acoustic-far-field.js';
import {validateFluidDomain,validateSphere,validateTube} from './fluid-domain.js';
import {validateChannelStudy} from './channel-flow.js';
import {cylindricalFrame} from './cylindrical-region.js';
import {validateImpedance} from './acoustic-impedance.js';
import {validateTemperatureSource} from './temperature-transfer.js';
import {validateFrame} from './constraints.js';
import {validateMaterialProperties} from './materials.js';
export function areaOfTriangle(p, t) {
  const i=t*9, ax=p[i+3]-p[i], ay=p[i+4]-p[i+1], az=p[i+5]-p[i+2], bx=p[i+6]-p[i], by=p[i+7]-p[i+1], bz=p[i+8]-p[i+2];
  return Math.hypot(ay*bz-az*by,az*bx-ax*bz,ax*by-ay*bx)/2;
}
export function brushTriangles(p, center, radius) {
  const found=[];
  for(let t=0;t<p.length/9;t++) {
    const i=t*9;
    const x=(p[i]+p[i+3]+p[i+6])/3, y=(p[i+1]+p[i+4]+p[i+7])/3,z=(p[i+2]+p[i+5]+p[i+8])/3;
    if(Math.hypot(x-center.x,y-center.y,z-center.z)<=radius) found.push(t);
  }
  return found;
}
export function validatePlasticLoadFractions(study={}) {
 const fractions=study.plasticLoadFractions;
 if(fractions===undefined)return;
 if(!Array.isArray(fractions)||fractions.length<1||fractions.length>30||!fractions.every(v=>Number.isFinite(v)&&v>=0&&v<=1)||fractions[0]<=0||Math.max(...fractions)!==1||fractions.at(-1)<=0||study.nonlinearLoadSteps!==undefined&&study.nonlinearLoadSteps!==fractions.length)throw Error('Invalid plastic load fractions: use 1–30 fractions in [0,1], positive first/final fractions, maximum 1 and matching load steps');
}
export function validateProject(project) {
  if(project?.version!==1 || !Array.isArray(project.meshes) || !Array.isArray(project.conditions)) throw Error('対応するプロジェクトではありません。');
  if(!project.meshes.length || project.meshes.length>500) throw Error('形状数が不正です。');
  let total=0;
  if(project.meshSettings){const r=project.meshSettings.refinements;if(!Array.isArray(r)||r.length>160||r.some(v=>!Array.isArray(v.center)||v.center.length!==3||!v.center.every(Number.isFinite)||![v.size,v.radius].every(x=>Number.isFinite(x)&&x>0)))throw Error("Invalid local mesh settings");}
  if(project.materialProperties!==undefined)validateMaterialProperties(project.materialProperties);
  validatePlasticLoadFractions(project.study);
  if(project.study?.kind==='creepingFlow'){
   validateStokesStudy(project.study);
   if(project.sourceModel?.kind!=='fluidDomain'||project.sourceModel.mode==='internal'||!Array.isArray(project.sourceModel.enclosure))throw Error('Stokes requires an external fluid domain with a box enclosure');
   if(project.conditions.length)throw Error('Stokes uses automatic outer velocity and no-slip boundaries; remove manual conditions');
  }
  if(project.study?.plasticLoadFractions!==undefined&&(project.study.kind!=='structural'||!project.materialProperties?.plasticity))throw Error('Plastic load fractions require a structural plasticity model');
  if(project.study){const s=project.study;if(s.modalAnalysis!==undefined&&typeof s.modalAnalysis!=='boolean')throw Error('Invalid modal setting');if(s.modalAnalysis&&s.kind!=='structural')throw Error('Modal analysis requires structural discipline');for(const [key,max]of [['modeCount',6],['modalIterations',100]])if(s[key]!==undefined&&(!Number.isInteger(s[key])||s[key]<1||s[key]>max))throw Error('Invalid modal iteration settings');validateFarFieldStudy(s);validateTransientAcousticStudy(s);validateVibrationStudy(s);for(const [key,max]of [['nonlinearLoadSteps',30],['maxNewtonIterations',50]])if(s[key]!==undefined&&(!Number.isInteger(s[key])||s[key]<1||s[key]>max))throw Error('Invalid nonlinear iteration settings');if(s.kind==='channelFlow')validateChannelStudy(s);if(s.maxRadiationIterations!==undefined&&(!Number.isInteger(s.maxRadiationIterations)||s.maxRadiationIterations<1||s.maxRadiationIterations>60))throw Error('Invalid radiation iteration limit');if(s.temperatureSource)validateTemperatureSource(s.temperatureSource);if(s.thermalStress!==undefined&&typeof s.thermalStress!=='boolean')throw Error('Invalid thermal stress setting');if(s.thermalStress&&(!Number.isFinite(s.temperature)||!Number.isFinite(s.referenceTemperature)))throw Error('Thermal stress temperatures required');for(const key of ['temperature','referenceTemperature','materialTemperature'])if(s[key]!==undefined&&(!Number.isFinite(s[key])||s[key]<-273.15))throw Error('Invalid thermal stress temperature');if(s.gravityEnabled!==undefined&&typeof s.gravityEnabled!=='boolean')throw Error('Invalid gravity setting');if(s.gravity!==undefined&&(!Array.isArray(s.gravity)||s.gravity.length!==3||!s.gravity.every(Number.isFinite)))throw Error('Invalid gravity acceleration');if(!['structural','thermal','acoustic','channelFlow','creepingFlow','fluidDomain'].includes(s.kind))throw Error('Unsupported analysis discipline');if(s.timeStep!==undefined&&(!Number.isFinite(s.timeStep)||s.timeStep<=0))throw Error('Invalid time step');if(s.steps!==undefined&&(!Number.isInteger(s.steps)||s.steps<1||s.steps>100))throw Error('Invalid time step count');if(s.initialTemperature!==undefined&&(!Number.isFinite(s.initialTemperature)||s.initialTemperature<-273.15))throw Error('Invalid initial temperature');if(s.volumetricSource!==undefined&&!Number.isFinite(s.volumetricSource))throw Error('Invalid volumetric heat source');for(const k of ['frequency','soundSpeed','airDensity','referencePressurePa','sweepStart','sweepEnd'])if(s[k]!==undefined&&(!(s[k]>0)||!Number.isFinite(s[k])))throw Error('Invalid acoustic parameter: '+k);if(s.lossFactor!==undefined&&(!(s.lossFactor>=0)||!Number.isFinite(s.lossFactor)))throw Error('Invalid acoustic damping');if(s.sweepCount!==undefined&&(!Number.isInteger(s.sweepCount)||s.sweepCount<1||s.sweepCount>20))throw Error('Invalid sweep count');if(s.receiverPoint!==undefined&&(!Array.isArray(s.receiverPoint)||s.receiverPoint.length!==3||!s.receiverPoint.every(Number.isFinite)))throw Error('Invalid receiver point');}
  if(project.sourceModel){const s=project.sourceModel;if(s.kind==='fluidDomain')validateFluidDomain(s);if(s.kind==='sphere')validateSphere(s);if(s.kind==='tube')validateTube(s);if(!['step','stl','box','cylinder','boxes','sphere','tube','fluidDomain'].includes(s.kind))throw Error('Invalid solid source');if(s.kind==='boxes'&&(!Array.isArray(s.boxes)||!s.boxes.length||s.boxes.length>10||s.boxes.some(b=>!Array.isArray(b)||b.length!==6||!b.every(Number.isFinite)||b.slice(3).some(v=>v<=0))))throw Error('Invalid independent box solids');if(s.kind==='step'&&(typeof s.data!=='string'||s.data.length>70000000||!/^[A-Za-z0-9+/]*={0,2}$/.test(s.data)))throw Error('Invalid STEP source');if(s.kind==='box'&&(!Array.isArray(s.bounds)||s.bounds.length!==6||!s.bounds.every(Number.isFinite)||s.bounds.slice(3).some(v=>v<=0)))throw Error('Invalid box dimensions');}
  if(project.sourceModel?.kind==='stl'){
   const source=project.sourceModel;validateStlSource(source);const display=project.meshes[0];
   if(project.meshes.length!==1||!display||!['stl','gmsh-surface'].includes(display.kind))throw Error('STL source requires one matching display surface');
   if(display.kind==='stl'&&(!Array.isArray(display.positions)||display.positions.length!==source.positions.length||display.positions.some((v,i)=>v!==source.positions[i])||!Array.isArray(display.faceIds)||display.faceIds.length!==source.positions.length/9||display.faceIds.some((v,i)=>v!==i)))throw Error('STL display triangles do not match the original source');
   if(display.kind==='gmsh-surface'&&(!Array.isArray(display.faceIds)||display.faceIds.some(v=>!Number.isInteger(v)||v<=0)))throw Error('Invalid STL mesh surface identity');
  }
  for(const m of project.meshes) {
    if(m.kind==='gmsh-surface'&&(typeof m.sourceHash!=='string'||!/^[a-f0-9]{64}$/.test(m.sourceHash)))throw Error('Invalid Gmsh surface CAD identity');
    if(!Array.isArray(m.positions)||m.positions.length%9||!m.positions.length||!m.positions.every(Number.isFinite)) throw Error('形状データが不正です。');
    total+=m.positions.length;
    if(total>18000000) throw Error('形状が大きすぎます。');
    if(!Array.isArray(m.faceIds)||m.faceIds.length!==m.positions.length/9||!m.faceIds.every(Number.isInteger)) throw Error('面データが不正です。');
  }
  if(project.planarRegion){const d=validatePlanarRegion(project.planarRegion);if(!Number.isInteger(d.mesh)||!project.meshes[d.mesh])throw Error('Invalid planar mesh');planarTriangles(project.meshes[d.mesh].positions,d);}
  for(const c of project.conditions) {
    if(c.cadUpdateRequired!==undefined){validatePendingCadCondition(c,validateProject);continue;}
    if(!Array.isArray(c.regions)||!c.regions.length||c.regions.some(r=>!Array.isArray(r.triangles)||!r.triangles.length))throw Error('Condition has no selected region');
    if(c.planarRegion){const d=validatePlanarRegion(c.planarRegion);if(!Number.isInteger(d.mesh)||!project.meshes[d.mesh]||c.regions.length!==1||c.regions[0].mesh!==d.mesh)throw Error('Invalid planar condition mesh');const expected=planarTriangles(project.meshes[d.mesh].positions,d),actual=new Set(c.regions[0].triangles);if(actual.size!==expected.length||!expected.every(t=>actual.has(t)))throw Error('Planar dimensions do not match the saved region');if(c.type==='thermalContact')throw Error('Exact planar thermal contact patches are not yet supported');}
    if(c.cylindricalRegion){const d=c.cylindricalRegion;if(d.exactCad&&c.type==='thermalContact')throw Error('Exact cylindrical thermal contact patches are not yet supported');cylindricalFrame(d);if(!Number.isInteger(d.mesh)||!project.meshes[d.mesh])throw Error('Invalid condition cylindrical mesh');}
    if(!['fixed','displacement','force','pressure','normalTraction','temperature','heatFlux','heatPower','convection','radiation','thermalContact','acousticPressure','acousticImpedance'].includes(c.type)||!Array.isArray(c.regions)||!Number.isFinite(c.value)||!Array.isArray(c.direction)||c.direction.length!==3||!c.direction.every(Number.isFinite)) throw Error('条件データが不正です。');
    if(c.type==='displacement'){if(Math.hypot(...c.direction)<1e-12)throw Error('Invalid constraint direction');if(c.frame){validateFrame(c.frame);if(c.direction.some((v,k)=>Math.abs(v-c.frame.axes[c.frame.axis][k])>1e-7))throw Error('Constraint direction does not match local frame');}}
    if(c.type==='acousticImpedance')validateImpedance(c);if(c.type==='thermalContact'&&(!(c.value>0)||c.regions.length!==2||c.regions[0].mesh===c.regions[1].mesh))throw Error('Thermal contact requires two separate part regions and positive conductance');if(c.type==='radiation'&&(!(c.value>0&&c.value<=1)||!Number.isFinite(c.ambientTemperature)||c.ambientTemperature<-273.15))throw Error('Invalid radiation parameters');if(c.type==='convection'&&(!(c.value>0)||!Number.isFinite(c.ambientTemperature)||c.ambientTemperature<-273.15))throw Error('Invalid convection parameters');
    if(c.type==='temperature'&&c.value<-273.15)throw Error('Temperature is below absolute zero');
    if(c.type==='force' && Math.hypot(...c.direction)===0) throw Error('荷重方向が不正です。');
    for(const r of c.regions) if(!Number.isInteger(r.mesh)||!project.meshes[r.mesh]||!Array.isArray(r.triangles)||!r.triangles.every(t=>Number.isInteger(t)&&t>=0&&t<project.meshes[r.mesh].faceIds.length)) throw Error('領域データが不正です。');
  }
  return project;
}
