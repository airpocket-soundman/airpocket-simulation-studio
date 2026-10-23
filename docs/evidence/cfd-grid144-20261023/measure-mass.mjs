// N144-only nodal farfield quadrature; never solver discrete face flux.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseSu2Vtu} from '../../../src/su2-vtu.js';
const folder=new URL('./',import.meta.url),result=JSON.parse(readFileSync(new URL('run.json',folder))),vtu=readFileSync(new URL('../../../.qa/cfd-grid144-20261023/flow.vtu',folder));
if(result.exitCode!==0||!result.processSettled)throw Error('Only a successfully settled final result can be integrated');
const mesh=parseSu2Vtu(vtu),boundary=[];
for(let i=0;i<mesh.pointCount;i++){
 const [x,y]=mesh.points.slice(3*i,3*i+2);
 if(Math.abs(Math.hypot(x,y)-50.5)<50.5e-6)boundary.push({x,y,angle:Math.atan2(y,x),u:mesh.fields.Velocity.values[3*i],v:mesh.fields.Velocity.values[3*i+1]});
}
if(boundary.length!==144)throw Error('Expected exactly 144 farfield vertices');
boundary.sort((a,b)=>a.angle-b.angle);
let inward=0,outward=0;
for(let i=0;i<boundary.length;i++){
 const a=boundary[i],b=boundary[(i+1)%boundary.length],flux=(a.u+b.u)/2*(b.y-a.y)-(a.v+b.v)/2*(b.x-a.x);
 if(!Number.isFinite(flux))throw Error('Nonfinite nodal mass contribution');if(flux>=0)outward+=flux;else inward-=flux;
}
const record={method:'nodal-trapezoid-outer-boundary',discreteSolverFlux:false,densityKgM3:1,unit:'kg/(s*m span)',vertices:144,inward,outward,net:outward-inward,relativeImbalance:Math.abs(outward-inward)/Math.max(outward,inward),sourceVtuSha256:createHash('sha256').update(vtu).digest('hex'),historyFinalIteration:result.finalHistory.Inner_Iter,association:'same exit0 process final VTU/history pair; no solver-supplied result revision',qaRelativeMaximum:.001};
writeFileSync(new URL('nodal-mass.json',folder),JSON.stringify(record,null,2)+'\n');
