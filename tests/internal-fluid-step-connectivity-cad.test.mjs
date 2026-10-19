import {test} from 'node:test';
import assert from 'node:assert/strict';
import load from '@loumalouomega/gmsh-wasm';
import {assertFluidSeed,selectInternalFluid} from '../src/internal-fluid.js';

// CAD-only references: no mesh, solver, or new volume-joining implementation.
// Separate cavities and edge/point-only contacts are deliberately not evaluated.
const modes=['adjacent-voids','fragmented-shell','six-wall-assembly'];
const walls=[[-5,-5,-5,1,10,10],[4,-5,-5,1,10,10],[-4,-5,-5,8,1,10],[-4,4,-5,8,1,10],[-4,-4,-5,8,8,1],[-4,-4,4,8,8,1]];
function makeReference(g,mode){
 const o=g.model.occ;
 if(mode==='six-wall-assembly'){for(const b of walls)o.addBox(...b);return;}
 const outer=o.addBox(-5,-5,-5,10,10,10),left=o.addBox(-4,-4,-4,4,8,8),right=o.addBox(0,-4,-4,4,8,8);
 const shell=o.cut([3,outer],[3,left,3,right],-1,true,true);
 if(mode==='fragmented-shell'){
  // Rectangle rotated into x=0 splits the shell without introducing a wall.
  const face=o.addRectangle(-6,-6,0,12,12);
  o.rotate([2,face],0,0,0,0,1,0,Math.PI/2);
  o.fragment(shell.outDimTags,[2,face],-1,true,true);
 }
}

test('STEP reimport and enclosure subtraction already retain one connected 512 mm3 cavity for three solid representations',async()=>{
 const g=await load({print:()=>{},printErr:()=>{}});g.initialize();
 try{
  g.option.setNumber('General.Terminal',0);
  for(const [index,mode] of modes.entries()){
   g.model.add(mode);makeReference(g,mode);g.model.occ.synchronize();
   const path=`/connectivity-${index}.step`;g.write(path);
   const bytes=g.FS.readFile(path);assert.ok(bytes.length>0);
   g.model.add(`${mode}-reimport`);g.FS.writeFile('/connectivity-reimport.step',bytes);
   g.model.occ.importShapes('/connectivity-reimport.step');g.model.occ.synchronize();
   const tools=g.model.getEntities(3).dimTags;
   assert.equal(tools.length/2,[1,2,6][index],`${mode}: imported solid count`);
   const source={kind:'fluidDomain',mode:'internal',solid:{kind:'step',data:Buffer.from(bytes).toString('base64')},enclosure:[-6,-6,-6,12,12,12],seedPoint:[-2,0,0],portPlanes:[]};
   assertFluidSeed(g,tools,source);
   const enclosure=g.model.occ.addBox(...source.enclosure);
   const cut=g.model.occ.cut([3,enclosure],tools,-1,true,true);g.model.occ.synchronize();
   assert.equal(cut.outDimTags.length,4,`${mode}: exterior plus cavity`);
   const volumes=[];
   for(let i=0;i<cut.outDimTags.length;i+=2){
    const tag=cut.outDimTags[i+1];assert.equal(cut.outDimTags[i],3);
    volumes.push({tag,mass:g.model.occ.getMass(3,tag).mass,inside:g.model.isInside(3,tag,source.seedPoint),faces:g.model.getBoundary([3,tag],false,false,false).outDimTags.filter((_,j)=>j%2).map(Math.abs)});
   }
   const selected=volumes.filter(v=>v.inside);assert.equal(selected.length,1,`${mode}: unique seed candidate`);
   assert.ok(Math.abs(selected[0].mass-512)<1e-9,`${mode}: exact cavity volume`);
   assert.ok(Math.abs(volumes.find(v=>!v.inside).mass-728)<1e-9,`${mode}: exterior volume`);
   assert.equal(volumes[0].faces.filter(f=>volumes[1].faces.includes(f)).length,0,`${mode}: no shared CAD face between cut volumes`);
   const result=selectInternalFluid(g,cut.outDimTags,source);
   assert.ok(Math.abs(result.cadVolumeMm3-512)<1e-9);assert.equal(result.excludedVolumes,1);assert.deepEqual(result.ports,[]);
   assert.equal(g.model.getEntities(3).dimTags.length,2,`${mode}: current selector retains one volume`);
  }
 }finally{g.finalize();}
});
