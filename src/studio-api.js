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
  function summary(){const p=read();if(!p)return {loaded:false};let area=0,count=0;p.selection.forEach((s,i)=>{for(const t of new Set(s)){area+=areaOfTriangle(p.meshes[i].positions,t);count++;}});return {loaded:true,name:p.name,meshCount:p.meshes.length,selectedTriangles:count,selectedAreaMm2:area,conditionCount:p.conditions.length,material:p.material};}
  return Object.freeze({
    version:1,
    getSummary:summary,
    exportProject:()=>current(),
    loadProject(project){const p=clone(project);p.selection??=p.meshes?.map(()=>[]);return write(p,'load');},
    selectTriangles(mesh,triangles,{replace=true,erase=false}={}){const p=current();if(!Number.isInteger(mesh)||!p.meshes[mesh]||!Array.isArray(triangles))throw Error('選択対象が不正です。');if(!triangles.every(t=>Number.isInteger(t)&&t>=0&&t<p.meshes[mesh].faceIds.length))throw Error('三角形番号が不正です。');if(replace)p.selection=p.meshes.map(()=>[]);const s=new Set(p.selection[mesh]);triangles.forEach(t=>erase?s.delete(t):s.add(t));p.selection[mesh]=[...s];return write(p,'selection');},
    clearSelection(){const p=current();p.selection=p.meshes.map(()=>[]);return write(p,'selection');},
    addCondition({type,value=0,direction=[1,0,0]}){const p=current(),regions=p.selection.map((s,mesh)=>({mesh,triangles:[...new Set(s)]})).filter(r=>r.triangles.length);if(!regions.length)throw Error('領域を選んでください。');if(!['fixed','force'].includes(type)||!Number.isFinite(value)||value<0)throw Error('条件が不正です。');const c={type,value:type==='fixed'?0:value,direction:type==='fixed'?[1,0,0]:direction,regions};p.conditions.push(c);p.selection=p.meshes.map(()=>[]);return write(p,'condition');},
    removeCondition(index){const p=current();if(!Number.isInteger(index)||!p.conditions[index])throw Error('条件番号が不正です。');p.conditions.splice(index,1);return write(p,'condition');},
    selectCondition(index){const p=current(),c=p.conditions[index];if(!Number.isInteger(index)||!c)throw Error('条件番号が不正です。');p.selection=p.meshes.map(()=>[]);for(const r of c.regions)p.selection[r.mesh]=[...new Set([...p.selection[r.mesh],...r.triangles])];return write(p,'selection');},
    setMaterial(material){if(!['金属','樹脂','ガラス','ゴム'].includes(material))throw Error('材料カテゴリが不正です。');const p=current();p.material=material;p.materialProperties={};return write(p,'material');},
    setMaterialProperties(properties){const p=current();p.materialProperties=clone(properties);return write(p,'material');}
  });
}
