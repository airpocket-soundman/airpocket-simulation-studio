import {inspectProjectSurface} from './project-surface-inspection.js';
import {catalogVersion,createCatalogMaterial} from './material-catalog.js';
import {getCapabilities,diagnoseExecution} from './capabilities.js';
import {validateInputProvenance} from './input-provenance.js';
import {preflightProject} from './analysis-preflight.js';
import {cylinderPatchArea} from './cylindrical-cad.js';
import {planCadUpdate} from './cad-update.js';
import {planarTriangles,planarArea} from './planar-region.js';
import {inspectSurface} from './surface-inspection.js';
import {cylindricalTriangles} from './cylindrical-region.js';
import {frameFromEuler} from './constraints.js';
import {validateProject,areaOfTriangle} from './regions.js';

// The browser and headless tests use the same commands and validation.
export function createStudioApi(adapter) {
  let state=null;
  const read=()=>adapter?adapter.get():state;
  const clone=p=>structuredClone(p);
  function check(p){
    validateProject(p);
    if(p.inputProvenance!==undefined)validateInputProvenance(p.inputProvenance);
    if(p.analysisIntent!==undefined&&(!p.analysisIntent||typeof p.analysisIntent!=='object'||Array.isArray(p.analysisIntent)||Object.keys(p.analysisIntent).some(k=>k!=='mode')||!['quantitative','exploratory'].includes(p.analysisIntent.mode)))throw Error('Invalid analysis intent');
    if(!Array.isArray(p.selection)||p.selection.length!==p.meshes.length||!p.selection.every((s,i)=>Array.isArray(s)&&s.every(t=>Number.isInteger(t)&&t>=0&&t<p.meshes[i].faceIds.length)))throw Error('選択データが不正です。');
    return p;
  }
  function write(p,reason){check(p);if(adapter)adapter.set(clone(p),reason);else state=clone(p);return summary();}
  function current(){const p=read();if(!p)throw Error('モデルがありません。');return clone(p);}
  function selectedRegions(p){const regions=p.selection.map((s,mesh)=>({mesh,triangles:[...new Set(s)]})).filter(r=>r.triangles.length);if(!regions.length)throw Error('領域を選んでください。');return regions;}
  function rememberDimensions(p,c){delete c.cylindricalRegion;delete c.planarRegion;if(p.planarRegion){const d=p.planarRegion,actual=new Set(c.regions.length===1&&c.regions[0].mesh===d.mesh?c.regions[0].triangles:[]),expected=planarTriangles(p.meshes[d.mesh].positions,d);if(expected.length===actual.size&&expected.every(t=>actual.has(t))){c.planarRegion=clone(d);return;}}const d=p.cylindricalRegion;if(!d||c.regions.length!==1||c.regions[0].mesh!==d.mesh)return;const expected=cylindricalTriangles(p.meshes[d.mesh].positions,d),actual=new Set(c.regions[0].triangles);if(expected.length===actual.size&&expected.every(t=>actual.has(t)))c.cylindricalRegion=clone(d);}
  function summary(){const p=read();if(!p)return {loaded:false};let area=0,count=0;p.selection.forEach((s,i)=>{for(const t of new Set(s)){area+=areaOfTriangle(p.meshes[i].positions,t);count++;}});if(p.planarRegion&&count)area=planarArea(p.planarRegion);if(p.cylindricalRegion?.exactCad&&count)area=cylinderPatchArea(p.cylindricalRegion);return {loaded:true,name:p.name,meshCount:p.meshes.length,selectedTriangles:count,selectedAreaMm2:area,conditionCount:p.conditions.length,...(p.conditions.some(c=>c.cadUpdateRequired)?{unresolvedCadConditions:p.conditions.filter(c=>c.cadUpdateRequired).length}:{}),material:p.material};}
  return Object.freeze({
    version:1,
    getCapabilities,
    diagnoseExecution:(options={},target='browser')=>diagnoseExecution(current(),options,target),
    preflight:(options={},runtime={})=>preflightProject(current(),options,runtime),
    setInputProvenance(document){const p=current();p.inputProvenance=clone(document);return write(p,'provenance');},
    setAnalysisIntent(intent){const p=current();p.analysisIntent=clone(intent);return write(p,'analysisIntent');},
    async getRevision(){const snapshot=current();const {getProjectRevision}=await import('./project-operations.js');return getProjectRevision(snapshot);},
    async applyOperations(operations,options={}){const snapshot=current(),commands=clone(operations),editOptions=clone(options);const {applyProjectOperations}=await import('./project-operations.js');const result=await applyProjectOperations(snapshot,commands,editOptions);if(JSON.stringify(current())!==JSON.stringify(snapshot))throw Error('Project revision conflict.');const updated=write(result.project,'batch');return {schemaVersion:result.schemaVersion,previousRevision:result.previousRevision,revision:result.revision,results:result.results,summary:updated};},
    frameFromEuler,
    getSummary:summary,
    inspectSurfaceDiagnostics(options){return inspectProjectSurface(current(),options);},
    inspectGeometry(options){const p=current();return p.meshes.map((m,mesh)=>({mesh,...inspectSurface(m.positions,options)}));},
    async inspectGeometrySummary(options={}){const snapshot=current();const {inspectProjectGeometry}=await import('./geometry-inspection.js');return inspectProjectGeometry(snapshot,options);},
    exportProject:()=>current(),
    previewCadUpdate(replacement){const {reports,matched,pending}=planCadUpdate(current(),replacement);return {reports,matched,pending};},
    applyCadUpdate(replacement){const result=planCadUpdate(current(),replacement);write(result.project,'load');return {reports:result.reports,matched:result.matched,pending:result.pending};},
    loadProject(project){const p=clone(project);p.selection??=p.meshes?.map(()=>[]);return write(p,'load');},
    selectCadFace(mesh,faceId){const p=current();if(!Number.isInteger(mesh)||!p.meshes[mesh]||!Number.isInteger(faceId)||faceId<0)throw Error('Invalid CAD face selection');const triangles=p.meshes[mesh].faceIds.flatMap((id,i)=>id===faceId?[i]:[]);if(!triangles.length)throw Error('Unknown face in the current display mesh');p.selection=p.meshes.map(()=>[]);p.selection[mesh]=triangles;delete p.planarRegion;delete p.cylindricalRegion;return write(p,'selection');},
    selectTriangles(mesh,triangles,{replace=true,erase=false}={}){const p=current();if(!Number.isInteger(mesh)||!p.meshes[mesh]||!Array.isArray(triangles))throw Error('選択対象が不正です。');if(!triangles.every(t=>Number.isInteger(t)&&t>=0&&t<p.meshes[mesh].faceIds.length))throw Error('三角形番号が不正です。');if(replace)p.selection=p.meshes.map(()=>[]);const s=new Set(p.selection[mesh]);triangles.forEach(t=>erase?s.delete(t):s.add(t));p.selection[mesh]=[...s];delete p.planarRegion;if(p.cylindricalRegion?.exactCad)delete p.cylindricalRegion;return write(p,'selection');},
    selectPlanarRegion(mesh,spec){const p=current();if(!Number.isInteger(mesh)||!p.meshes[mesh])throw Error('Invalid planar mesh');const triangles=planarTriangles(p.meshes[mesh].positions,spec);p.selection=p.meshes.map(()=>[]);p.selection[mesh]=triangles;p.planarRegion={...clone(spec),mesh};delete p.cylindricalRegion;return write(p,'selection');},
    selectCylindricalRegion(mesh,spec){const p=current();if(!Number.isInteger(mesh)||!p.meshes[mesh])throw Error('Invalid cylindrical mesh');delete p.planarRegion;const triangles=cylindricalTriangles(p.meshes[mesh].positions,spec);p.selection=p.meshes.map(()=>[]);p.selection[mesh]=triangles;p.cylindricalRegion={...clone(spec),mesh};return write(p,'selection');},
    clearSelection(){const p=current();delete p.planarRegion;if(p.cylindricalRegion?.exactCad)delete p.cylindricalRegion;p.selection=p.meshes.map(()=>[]);return write(p,'selection');},
    addCondition({type,value=0,direction=[1,0,0],ambientTemperature,frame,reactance=0,impedanceTable}){const p=current(),regions=p.selection.map((s,mesh)=>({mesh,triangles:[...new Set(s)]})).filter(r=>r.triangles.length);if(!regions.length)throw Error('領域を選んでください。');if(!['fixed','displacement','force','pressure','normalTraction','temperature','heatFlux','heatPower','convection','radiation','thermalContact','acousticPressure','acousticImpedance'].includes(type)||!Number.isFinite(value)||(type==='force'&&value<0))throw Error('条件が不正です。');const c={type,value:type==='fixed'?0:value,direction:type==='displacement'&&frame?frame.axes?.[frame.axis]:['force','displacement'].includes(type)?direction:[1,0,0],regions};if(type==='acousticImpedance'){c.reactance=reactance;if(impedanceTable!==undefined)c.impedanceTable=clone(impedanceTable);}if(type==='displacement'&&frame)c.frame=clone(frame);if(['convection','radiation'].includes(type))c.ambientTemperature=ambientTemperature;rememberDimensions(p,c);p.conditions.push(c);p.selection=p.meshes.map(()=>[]);return write(p,'condition');},
    removeCondition(index){const p=current();if(!Number.isInteger(index)||!p.conditions[index])throw Error('条件番号が不正です。');p.conditions.splice(index,1);return write(p,'condition');},
    selectCondition(index){const p=current(),c=p.conditions[index];if(!Number.isInteger(index)||!c)throw Error('条件番号が不正です。');p.selection=p.meshes.map(()=>[]);for(const r of c.regions)p.selection[r.mesh]=[...new Set([...p.selection[r.mesh],...r.triangles])];delete p.planarRegion;if(c.planarRegion)p.planarRegion=clone(c.planarRegion);if(c.cylindricalRegion)p.cylindricalRegion=clone(c.cylindricalRegion);return write(p,'selection');},
    replaceConditionRegion(index){const p=current(),c=p.conditions[index];if(!Number.isInteger(index)||!c)throw Error('条件番号が不正です。');c.regions=selectedRegions(p);delete c.cadUpdateRequired;rememberDimensions(p,c);return write(p,'condition');},
    reapplyConditionRegion(index){const p=current(),c=p.conditions[index];if(Number.isInteger(index)&&c?.planarRegion){const d=c.planarRegion,triangles=planarTriangles(p.meshes[d.mesh].positions,d);c.regions=[{mesh:d.mesh,triangles}];p.selection=p.meshes.map(()=>[]);p.selection[d.mesh]=triangles;p.planarRegion=clone(d);return write(p,'condition');}if(!Number.isInteger(index)||!c?.cylindricalRegion)throw Error('Condition has no saved cylindrical dimensions');const d=c.cylindricalRegion,triangles=cylindricalTriangles(p.meshes[d.mesh].positions,d);if(!triangles.length)throw Error('Saved cylindrical region no longer matches the surface');c.regions=[{mesh:d.mesh,triangles}];p.selection=p.meshes.map(()=>[]);p.selection[d.mesh]=triangles;p.cylindricalRegion=clone(d);return write(p,'condition');},
    setMaterial(material){if(!['金属','樹脂','ガラス','ゴム'].includes(material))throw Error('材料カテゴリが不正です。');const p=current();p.material=material;p.materialProperties={};return write(p,'material');},
    setMaterialProperties(properties){const p=current();p.materialProperties=clone(properties);return write(p,'material');},
    applyCatalogMaterial(options){if(!options||typeof options!=='object'||Array.isArray(options)||Object.keys(options).some(key=>!['id','expectedCatalogVersion','poissonRatio','isotropicApproximation','allowExperimental','applicability'].includes(key)))throw Error('Invalid catalog material application');if(typeof options.id!=='string'||options.expectedCatalogVersion!==catalogVersion)throw Error('Material catalog version conflict or invalid ID');if(options.isotropicApproximation!==true||options.allowExperimental!==undefined&&typeof options.allowExperimental!=='boolean')throw Error('Explicit catalog approximation and experimental choices are required');if(typeof options.applicability!=='string'||!options.applicability.trim()||options.applicability.length>2000)throw Error('Record catalog material applicability in up to 2000 characters');const properties=createCatalogMaterial(options.id,options),p=current();p.material='樹脂';p.materialProperties=clone(properties);for(const entry of p.inputProvenance?.entries??[]){if(/^\/(?:material|materialProperties)(?:\/|$)/.test(entry.pointer)){entry.status='unconfirmed';entry.assumption=null;delete entry.confirmation;}}if(p.study?.plasticLoadFractions!==undefined)delete p.study.plasticLoadFractions;return write(p,'material');},
    setMaterialPreset(material,properties){if(!['金属','樹脂','ガラス','ゴム'].includes(material))throw Error('材料カテゴリが不正です。');const p=current();p.material=material;p.materialProperties=clone(properties);if(!properties?.plasticity&&p.study?.plasticLoadFractions!==undefined)delete p.study.plasticLoadFractions;return write(p,'material');},
    setMeshSettings(settings){const p=current();p.meshSettings=clone(settings);return write(p,'meshSettings');},
    setStudy(study){const p=current();p.study=clone(study);return write(p,'study');}
  });
}
