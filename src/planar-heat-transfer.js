// Conservative heat-flux transfer between two overlapping, non-matching planar
// triangular interfaces (COUPLE3 limited acceptance).
//
// Sign convention (fixed, not auto-detected):
//   * The winding order of each triangle defines its outward normal.
//   * The heat flux density q [W/m^2] on side A is positive along A's outward normal,
//     so positive q leaves A (sourceW > 0).
//   * Side B is positive along B's inward normal, so positive heat entering B gives
//     targetW > 0. For an accepted interface A-outward and B-inward are the same
//     physical direction, therefore sourceW == targetW and targetOutwardW == -targetW
//     ("both recorded outward" sums to zero).
//   * A and B outward normals must be opposite. Same-facing interfaces are rejected,
//     never silently flipped.
//
// Units: mesh coordinates are millimetres (like thermal-contact.js). Areas are
// computed in mm^2 in the projected interface plane and converted to m^2 exactly once
// with the 1e-6 factor. Returned nodeHeatW values are nodal heat loads in W, NOT W/m^2.
// This module only builds the operator; it does not run a temperature/heat-flux
// coupling iteration and does not claim a finished fluid advection solver.
import {cross2,sub2,clipPolygon,barycentric2} from './triangle-overlap.js';

const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{const n=Math.hypot(...v);if(n<1e-12)throw Error('Degenerate planar heat transfer face');return v.map(x=>x/n);};
const MM2_TO_M2=1e-6,MM_TO_M=1e-3;
// 1e-6 in (1 + nA.nB): faces must be anti-parallel to within ~0.08 degrees.
const ORIENTATION_TOLERANCE=1e-6;

function fluxField(flux){
  let base,gradient;
  if(typeof flux==='number'){base=flux;gradient=[0,0,0];}
  else if(flux&&typeof flux==='object'){base=flux.base;gradient=flux.gradient??[0,0,0];}
  else throw Error('Planar heat transfer requires a constant or linear heat flux density');
  if(!Number.isFinite(base)||!Array.isArray(gradient)||gradient.length!==3||!gradient.every(Number.isFinite))throw Error('Planar heat transfer requires a finite heat flux density');
  return metres=>{const q=base+dot(gradient,metres);if(!Number.isFinite(q))throw Error('Planar heat transfer requires a finite heat flux density');return q;};
}

export function planarHeatTransfer(mesh,facesA,facesB,flux,{toleranceMm=1e-6,coverageTolerance=1e-6}={}){
  const q=fluxField(flux);
  if(!mesh||!Array.isArray(mesh.nodes)||!mesh.nodes.length||mesh.nodes.length%3||!mesh.nodes.every(Number.isFinite))throw Error('Planar heat transfer requires finite mesh nodes');
  if(!Number.isFinite(toleranceMm)||toleranceMm<=0)throw Error('Planar heat transfer requires a positive plane tolerance');
  if(!Number.isFinite(coverageTolerance)||coverageTolerance<=0)throw Error('Planar heat transfer requires a positive coverage tolerance');
  if(!Array.isArray(facesA)||!Array.isArray(facesB)||!facesA.length||!facesB.length||facesA.length>5000||facesB.length>5000)throw Error('Planar heat transfer requires at most 5000 faces per side');
  const points=f=>{if(!Array.isArray(f?.nodes)||f.nodes.length!==3||new Set(f.nodes).size!==3||!f.nodes.every(i=>Number.isInteger(i)&&i>=0&&i<mesh.nodes.length/3))throw Error('Invalid planar heat transfer nodes');return f.nodes.map(i=>mesh.nodes.slice(3*i,3*i+3));};
  const nodesA=new Set(facesA.flatMap(f=>Array.isArray(f?.nodes)?f.nodes:[]));
  if(facesB.some(f=>Array.isArray(f?.nodes)&&f.nodes.some(i=>nodesA.has(i))))throw Error('Planar heat transfer requires separate nodes on the two sides');
  const first=points(facesA[0]),origin=first[0],u=unit(sub(first[1],origin)),normalA=unit(cross(sub(first[1],origin),sub(first[2],origin))),v=cross(normalA,u);
  const pb=points(facesB[0]),normalB=unit(cross(sub(pb[1],pb[0]),sub(pb[2],pb[0])));
  if(dot(normalA,normalB)>-1+ORIENTATION_TOLERANCE)throw Error('Planar heat transfer requires opposite outward face normals; same-facing interfaces are not auto-flipped');
  const project=(f,referenceNormal)=>{const p=points(f);if(dot(unit(cross(sub(p[1],p[0]),sub(p[2],p[0]))),referenceNormal)<=0)throw Error('Planar heat transfer requires an explicit outward face orientation');if(p.some(pt=>Math.abs(dot(sub(pt,origin),normalA))>toleranceMm))throw Error('Planar heat transfer currently requires coincident planar interfaces');const xy=p.map(pt=>[dot(sub(pt,origin),u),dot(sub(pt,origin),v)]),area=Math.abs(cross2(sub2(xy[1],xy[0]),sub2(xy[2],xy[0])))/2;if(!(area>1e-12))throw Error('Degenerate planar heat transfer face');return {nodes:f.nodes,xy,area,lo:[0,1].map(k=>Math.min(...xy.map(pt=>pt[k]))),hi:[0,1].map(k=>Math.max(...xy.map(pt=>pt[k]))),covered:0};};
  const sideA=facesA.map(f=>project(f,normalA)),sideB=facesB.map(f=>project(f,normalB));
  const areaA=sideA.reduce((s,f)=>s+f.area,0),areaB=sideB.reduce((s,f)=>s+f.area,0);
  if(Math.abs(areaA/areaB-1)>coverageTolerance)throw Error('Planar heat transfer requires matching coverage; gaps or overlaps detected');
  const lo=[0,1].map(k=>Math.min(...sideB.map(f=>f.lo[k]))),hi=[0,1].map(k=>Math.max(...sideB.map(f=>f.hi[k]))),cellSize=Math.max(...hi.map((x,k)=>x-lo[k]))/Math.ceil(Math.sqrt(sideB.length)),cells=new Map();
  const cellBounds=f=>({low:f.lo.map((x,k)=>Math.floor((x-lo[k])/cellSize)),high:f.hi.map((x,k)=>Math.floor((x-lo[k])/cellSize))});
  sideB.forEach((f,index)=>{const {low,high}=cellBounds(f);for(let x=low[0];x<=high[0];x++)for(let y=low[1];y<=high[1];y++){const key=x+','+y;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(index);}});
  // Rebuild the physical (metre) position of a projected interface point to evaluate q.
  const qAtXY=xy=>q([origin[0]+u[0]*xy[0]+v[0]*xy[1],origin[1]+u[1]*xy[0]+v[1]*xy[1],origin[2]+u[2]*xy[0]+v[2]*xy[1]].map(c=>c*MM_TO_M));
  const nodeHeatW=new Map();for(const node of facesB.flatMap(f=>f.nodes))nodeHeatW.set(node,0);
  let sourceW=0;
  for(const a of sideA){
    const {low,high}=cellBounds(a),candidates=new Set();
    for(let x=low[0];x<=high[0];x++)for(let y=low[1];y<=high[1];y++)for(const index of cells.get(x+','+y)||[])candidates.add(index);
    for(const index of candidates){
      const b=sideB[index];
      if(a.lo.some((x,k)=>x>b.hi[k]+toleranceMm)||b.lo.some((x,k)=>x>a.hi[k]+toleranceMm))continue;
      const polygon=clipPolygon(a.xy,b.xy,1e-10);
      for(let i=1;i+1<polygon.length;i++){
        const tri=[polygon[0],polygon[i],polygon[i+1]],areaMm2=Math.abs(cross2(sub2(tri[1],tri[0]),sub2(tri[2],tri[0])))/2;
        if(areaMm2<1e-12)continue;
        a.covered+=areaMm2;b.covered+=areaMm2;
        const areaM2=areaMm2*MM2_TO_M2;
        // Centroid rule is exact for the affine q field; the 3 edge-midpoint rule is
        // exact for the quadratic q*N_j integrand that distributes heat to B's nodes.
        sourceW+=areaM2*qAtXY([0,1].map(k=>(tri[0][k]+tri[1][k]+tri[2][k])/3));
        for(const [p0,p1] of [[tri[0],tri[1]],[tri[1],tri[2]],[tri[2],tri[0]]]){
          const midpoint=[(p0[0]+p1[0])/2,(p0[1]+p1[1])/2],weights=barycentric2(midpoint,b.xy),heatW=areaM2/3*qAtXY(midpoint);
          for(let j=0;j<3;j++)nodeHeatW.set(b.nodes[j],nodeHeatW.get(b.nodes[j])+heatW*weights[j]);
        }
      }
    }
  }
  if([...sideA,...sideB].some(f=>Math.abs(f.covered/f.area-1)>coverageTolerance))throw Error('Planar heat transfer requires matching coverage; gaps or overlaps detected');
  const targetW=[...nodeHeatW.values()].reduce((s,v)=>s+v,0);
  return {coveredAreaM2:sideA.reduce((s,f)=>s+f.covered,0)*MM2_TO_M2,sourceW,targetW,targetOutwardW:-targetW,balanceErrorW:sourceW-targetW,nodeHeatW};
}
