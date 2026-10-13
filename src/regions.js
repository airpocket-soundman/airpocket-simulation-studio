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
export function validateProject(project) {
  if(project?.version!==1 || !Array.isArray(project.meshes) || !Array.isArray(project.conditions)) throw Error('対応するプロジェクトではありません。');
  if(!project.meshes.length || project.meshes.length>500) throw Error('形状数が不正です。');
  let total=0;
  if(project.materialProperties!==undefined)validateMaterialProperties(project.materialProperties);
  for(const m of project.meshes) {
    if(!Array.isArray(m.positions)||m.positions.length%9||!m.positions.length||!m.positions.every(Number.isFinite)) throw Error('形状データが不正です。');
    total+=m.positions.length;
    if(total>18000000) throw Error('形状が大きすぎます。');
    if(!Array.isArray(m.faceIds)||m.faceIds.length!==m.positions.length/9||!m.faceIds.every(Number.isInteger)) throw Error('面データが不正です。');
  }
  for(const c of project.conditions) {
    if(!['fixed','force'].includes(c.type)||!Array.isArray(c.regions)||!Number.isFinite(c.value)||!Array.isArray(c.direction)||c.direction.length!==3||!c.direction.every(Number.isFinite)) throw Error('条件データが不正です。');
    if(c.type==='force' && Math.hypot(...c.direction)===0) throw Error('荷重方向が不正です。');
    for(const r of c.regions) if(!Number.isInteger(r.mesh)||!project.meshes[r.mesh]||!Array.isArray(r.triangles)||!r.triangles.every(t=>Number.isInteger(t)&&t>=0&&t<project.meshes[r.mesh].faceIds.length)) throw Error('領域データが不正です。');
  }
  return project;
}
