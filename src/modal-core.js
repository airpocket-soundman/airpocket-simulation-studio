import {prepareElasticSystem,pcg,elementGeometry} from './fem-core.js';
import {toGlobal} from './constraints.js';

// Small symmetric Rayleigh-Ritz eigenproblem; columns are orthonormal vectors.
function symmetricEigen(matrix){
 const a=matrix.map(r=>[...r]),n=a.length,v=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?1:0));
 for(let sweep=0;sweep<100*n*n;sweep++){let p=0,q=1,max=0;for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(Math.abs(a[i][j])>max){max=Math.abs(a[i][j]);p=i;q=j;}if(max<1e-13*Math.max(1,...a.map((r,i)=>Math.abs(r[i]))))break;
 const theta=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(theta),s=Math.sin(theta),app=c*c*a[p][p]-2*s*c*a[p][q]+s*s*a[q][q],aqq=s*s*a[p][p]+2*s*c*a[p][q]+c*c*a[q][q];for(let i=0;i<n;i++)if(i!==p&&i!==q){const x=a[i][p],y=a[i][q];a[i][p]=a[p][i]=c*x-s*y;a[i][q]=a[q][i]=s*x+c*y;}a[p][p]=app;a[q][q]=aqq;a[p][q]=a[q][p]=0;for(let i=0;i<n;i++){const x=v[i][p],y=v[i][q];v[i][p]=c*x-s*y;v[i][q]=s*x+c*y;}}
 return a.map((r,i)=>({value:r[i],vector:v.map(row=>row[i])})).sort((a,b)=>a.value-b.value);
}

export function solveModal(mesh,properties,boundary,{modeCount=2,maxIterations=60,matvecFactory,onProgress=()=>{}}={}){
 if(!Number.isInteger(modeCount)||modeCount<1||modeCount>6||!Number.isInteger(maxIterations)||maxIterations<1||maxIterations>100)throw Error('Invalid modal iteration settings');
 if(properties.orthotropic)throw Error('Orthotropic modal analysis is not yet validated');
 if(properties.hyperelastic||!(properties.density>0)||!Number.isFinite(properties.density))throw Error('Modal analysis requires linear elasticity and positive density');
 if((boundary.forces||[]).some(f=>f.value.some(v=>v!==0))||(boundary.displacements||[]).some(f=>f.valueMm!==0))throw Error('Modal analysis accepts homogeneous supports only; remove loads and prescribed motion');
 if(mesh.nodes.length>6000||mesh.tetrahedra.length>8000)throw Error('Modal prototype limit: 2000 nodes / 8000 tetrahedra');
 const system=prepareElasticSystem(mesh,properties,boundary,{gravity:[0,0,0]}),{n,entries,dirichlet,bases}=system;
 const free=n-dirichlet.size;if(free<modeCount)throw Error('Not enough free degrees of freedom for the requested modes');
 const mass=new Float64Array(n);for(const t of mesh.tetrahedra){const m=properties.density*elementGeometry(mesh,t).volume/4;for(const i of t)for(let k=0;k<3;k++)mass[3*i+k]+=m;}if(mass.some(v=>!(v>0)||!Number.isFinite(v)))throw Error('Invalid modal mass');
 const fixed=new Map([...dirichlet.keys()].map(i=>[i,0])),dotM=(x,y)=>x.reduce((s,v,i)=>s+v*mass[i]*y[i],0),count=Math.min(modeCount+2,free),apply=matvecFactory?matvecFactory(entries,n):x=>{const out=new Float64Array(n);for(const {ids,k}of entries)for(let a=0;a<ids.length;a++)for(let b=0;b<ids.length;b++)out[ids[a]]+=k[a*ids.length+b]*x[ids[b]];return out;};
 function orthonormalize(vectors){const q=[];for(const vector of vectors){const x=Float64Array.from(vector,(v,i)=>fixed.has(i)?0:v);for(let pass=0;pass<2;pass++)for(const y of q){const d=dotM(x,y);for(let i=0;i<n;i++)x[i]-=d*y[i];}const norm=Math.sqrt(dotM(x,x));if(!(norm>1e-20)||!Number.isFinite(norm))throw Error('Modal subspace lost independence');for(let i=0;i<n;i++)x[i]/=norm;q.push(x);}return q;}
 let seed=1947;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296-.5;};let q=orthonormalize(Array.from({length:count},()=>Float64Array.from({length:n},random))),eigen,residuals,iterations=0,linearIterations=0;
 for(let iter=1;iter<=maxIterations;iter++){q=orthonormalize(q.map(x=>{const rhs=Float64Array.from(x,(v,i)=>v*mass[i]),r=pcg(n,entries,rhs,fixed,{tolerance:1e-10,matvecFactory:()=>apply});linearIterations+=r.iterations;return r.solution;}));
 const reduced=Array.from({length:count},()=>Array(count).fill(0));for(let i=0;i<count;i++){const kq=apply(q[i]);for(let j=0;j<count;j++)reduced[j][i]=q[j].reduce((s,v,k)=>s+v*kq[k],0);}for(let i=0;i<count;i++)for(let j=0;j<i;j++)reduced[i][j]=reduced[j][i]=(reduced[i][j]+reduced[j][i])/2;
 eigen=symmetricEigen(reduced);q=eigen.map(e=>Float64Array.from({length:n},(_,i)=>e.vector.reduce((s,v,j)=>s+v*q[j][i],0)));
 residuals=q.slice(0,modeCount).map((x,a)=>{const kx=apply(x);let err=0,scale=0;for(let i=0;i<n;i++)if(!fixed.has(i)){const m=eigen[a].value*mass[i]*x[i];err+=(kx[i]-m)**2;scale+=m*m;}return Math.sqrt(err/scale);});iterations=iter;onProgress(`Modal subspace ${iter}: ${Math.max(...residuals).toExponential(2)}`);if(residuals.every(v=>Number.isFinite(v)&&v<=1e-5))break;
 }
 if(!residuals.every(v=>Number.isFinite(v)&&v<=1e-5)||eigen.slice(0,modeCount).some(e=>!Number.isFinite(e.value)||e.value<=0))throw Error('Modal subspace did not converge; no unverified modes returned');
 const modes=q.slice(0,modeCount).map((x,i)=>{const global=toGlobal(x,bases),max=Math.max(...Array.from({length:n/3},(_,i)=>Math.hypot(...global.slice(3*i,3*i+3)))),displacement=Array.from(global,v=>v/max),magnitudes=Array.from({length:n/3},(_,i)=>Math.hypot(...displacement.slice(3*i,3*i+3)));return {frequencyHz:Math.sqrt(eigen[i].value)/(2*Math.PI),eigenvalue:eigen[i].value,residual:residuals[i],displacement,magnitudes};});
 return {kind:'modal',engine:matvecFactory?'Airpocket Modal Tet4 / WASM CPU':'Airpocket Modal Tet4 / JavaScript CPU',massModel:'lumped Tet4',modeNormalization:'maximum displacement = 1 mm, arbitrary eigenvector sign',modes,iterations,linearIterations,lowestFrequencyHz:modes[0].frequencyHz,highestFrequencyHz:modes.at(-1).frequencyHz,totalMassKg:mass.reduce((s,v)=>s+v,0)/3};
}
