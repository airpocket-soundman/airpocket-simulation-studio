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
    if(!Array.isArray(p.selection)||p.selection.length!==p.meshes.length||!p.selection.every((s,i)=>Array.isArray(s)&&s.every(t=>Number.isInteger(t)&&t>=0&&t<p.meshes[i].faceIds.length)))throw Error('選択データが不正です。');
    return p;
  }
  function write(p,reason){check(p);if(adapter)adapter.set(clone(p),reason);else state=clone(p);return summary();}
  function current(){const p=read();if(!p)throw Error('モデルがありません。');return clone(p);}
  function selectedRegions(p){const regions=p.selection.map((s,mesh)=>({mesh,triangles:[...new Set(s)]})).filter(r=>r.triangles.length);if(!regions.length)throw Error('領域を選んでください。');return regions;}
  function rememberDimensions(p,c){delete c.cylindricalRegion;delete c.planarRegion;if(p.planarRegion){const d=p.planarRegion,actual=new Set(c.regions.length===1&&c.regions[0].mesh===d.mesh?c.regions[0].triangles:[]),expected=planarTriangles(p.meshes[d.mesh].positions,d);if(expected.length===actual.size&&expected.every(t=>actual.has(t))){c.planarRegion=clone(d);return;}}const d=p.cylindricalRegion;if(!d||c.regions.length!==1||c.regions[0].mesh!==d.mesh)return;const expected=cylindricalTriangles(p.meshes[d.mesh].positions,d),actual=new Set(c.regions[0].triangles);if(expected.length===actual.size&&expected.every(t=>actual.has(t)))c.cylindricalRegion=clone(d);}
  function summary(){const p=read();if(!p)return {loaded:false};let area=0,count=0;p.selection.forEach((s,i)=>{for(const t of new Set(s)){area+=areaOfTriangle(p.meshes[i].positions,t);count++;}});if(p.planarRegion&&count)area=planarArea(p.planarRegion);return {loaded:true,name:p.name,meshCount:p.meshes.length,selectedTriangles:count,selectedAreaMm2:area,conditionCount:p.conditions.length,material:p.material};}
  return Object.freeze({
    version:1,
    frameFromEuler,
    getSummary:summary,
    inspectGeometry(options){const p=current();return p.meshes.map((m,mesh)=>({mesh,...inspectSurface(m.positions,options)}));},
    exportProject:()=>current(),
    loadProject(project){const p=clone(project);p.selection??=p.meshes?.map(()=>[]);return write(p,'load');},
    selectTriangles(mesh,triangles,{replace=true,erase=false}={}){const p=current();if(!Number.isInteger(mesh)||!p.meshes[mesh]||!Array.isArray(triangles))throw Error('選択対象が不正です。');if(!triangles.every(t=>Number.isInteger(t)&&t>=0&&t<p.meshes[mesh].faceIds.length))throw Error('三角形番号が不正です。');if(replace)p.selection=p.meshes.map(()=>[]);const s=new Set(p.selection[mesh]);triangles.forEach(t=>erase?s.delete(t):s.add(t));p.selection[mesh]=[...s];delete p.planarRegion;return write(p,'selection');},
    selectPlanarRegion(mesh,spec){const p=current();if(!Number.isInteger(mesh)||!p.meshes[mesh])throw Error('Invalid planar mesh');const triangles=planarTriangles(p.meshes[mesh].positions,spec);p.selection=p.meshes.map(()=>[]);p.selection[mesh]=triangles;p.planarRegion={...clone(spec),mesh};delete p.cylindricalRegion;return write(p,'selection');},
    selectCylindricalRegion(mesh,spec){const p=current();if(!Number.isInteger(mesh)||!p.meshes[mesh])throw Error('Invalid cylindrical mesh');delete p.planarRegion;const triangles=cylindricalTriangles(p.meshes[mesh].positions,spec);p.selection=p.meshes.map(()=>[]);p.selection[mesh]=triangles;p.cylindricalRegion={...clone(spec),mesh};return write(p,'selection');},
    clearSelection(){const p=current();delete p.planarRegion;p.selection=p.meshes.map(()=>[]);return write(p,'selection');},
    addCondition({type,value=0,direction=[1,0,0],ambientTemperature,frame,reactance=0,impedanceTable}){const p=current(),regions=p.selection.map((s,mesh)=>({mesh,triangles:[...new Set(s)]})).filter(r=>r.triangles.length);if(!regions.length)throw Error('領域を選んでください。');if(!['fixed','displacement','force','pressure','normalTraction','temperature','heatFlux','heatPower','convection','radiation','thermalContact','acousticPressure','acousticImpedance'].includes(type)||!Number.isFinite(value)||(type==='force'&&value<0))throw Error('条件が不正です。');const c={type,value:type==='fixed'?0:value,direction:type==='displacement'&&frame?frame.axes?.[frame.axis]:['force','displacement'].includes(type)?direction:[1,0,0],regions};if(type==='acousticImpedance'){c.reactance=reactance;if(impedanceTable!==undefined)c.impedanceTable=clone(impedanceTable);}if(type==='displacement'&&frame)c.frame=clone(frame);if(['convection','radiation'].includes(type))c.ambientTemperature=ambientTemperature;rememberDimensions(p,c);p.conditions.push(c);p.selection=p.meshes.map(()=>[]);return write(p,'condition');},
    removeCondition(index){const p=current();if(!Number.isInteger(index)||!p.conditions[index])throw Error('条件番号が不正です。');p.conditions.splice(index,1);return write(p,'condition');},
    selectCondition(index){const p=current(),c=p.conditions[index];if(!Number.isInteger(index)||!c)throw Error('条件番号が不正です。');p.selection=p.meshes.map(()=>[]);for(const r of c.regions)p.selection[r.mesh]=[...new Set([...p.selection[r.mesh],...r.triangles])];delete p.planarRegion;if(c.planarRegion)p.planarRegion=clone(c.planarRegion);if(c.cylindricalRegion)p.cylindricalRegion=clone(c.cylindricalRegion);return write(p,'selection');},
    replaceConditionRegion(index){const p=current(),c=p.conditions[index];if(!Number.isInteger(index)||!c)throw Error('条件番号が不正です。');c.regions=selectedRegions(p);rememberDimensions(p,c);return write(p,'condition');},
    reapplyConditionRegion(index){const p=current(),c=p.conditions[index];if(Number.isInteger(index)&&c?.planarRegion){const d=c.planarRegion,triangles=planarTriangles(p.meshes[d.mesh].positions,d);c.regions=[{mesh:d.mesh,triangles}];p.selection=p.meshes.map(()=>[]);p.selection[d.mesh]=triangles;p.planarRegion=clone(d);return write(p,'condition');}if(!Number.isInteger(index)||!c?.cylindricalRegion)throw Error('Condition has no saved cylindrical dimensions');const d=c.cylindricalRegion,triangles=cylindricalTriangles(p.meshes[d.mesh].positions,d);if(!triangles.length)throw Error('Saved cylindrical region no longer matches the surface');c.regions=[{mesh:d.mesh,triangles}];p.selection=p.meshes.map(()=>[]);p.selection[d.mesh]=triangles;p.cylindricalRegion=clone(d);return write(p,'condition');},
    setMaterial(material){if(!['金属','樹脂','ガラス','ゴム'].includes(material))throw Error('材料カテゴリが不正です。');const p=current();p.material=material;p.materialProperties={};return write(p,'material');},
    setMaterialProperties(properties){const p=current();p.materialProperties=clone(properties);return write(p,'material');},
    setMeshSettings(settings){const p=current();p.meshSettings=clone(settings);return write(p,'meshSettings');},
    setStudy(study){const p=current();p.study=clone(study);return write(p,'study');}
  });
}
