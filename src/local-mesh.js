import {validateProject} from './regions.js';
export function selectedRefinements(project,{size,radius}){
 validateProject(project);if(!(size>0&&radius>0)||![size,radius].every(Number.isFinite))throw Error('Local size and radius must be positive');
 const triangles=[];for(let mi=0;mi<project.meshes.length;mi++)for(const t of project.selection?.[mi]||[]) {const p=project.meshes[mi].positions;if(!Number.isInteger(t)||t<0||t>=p.length/9)throw Error('Invalid refinement selection');triangles.push([0,1,2].map(k=>(p[t*9+k]+p[t*9+k+3]+p[t*9+k+6])/3));}
 if(!triangles.length)throw Error('Select a region to refine');const count=Math.min(80,triangles.length);return Array.from({length:count},(_,i)=>({center:triangles[Math.floor(i*triangles.length/count)],size,radius}));
}
