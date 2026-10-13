import {tetraVolume} from './mesh-core.js';
import {meshComponents} from './components.js';
export function invert(a){const n=a.length,m=a.map((r,i)=>[...r,...Array.from({length:n},(_,j)=>i===j?1:0)]);for(let k=0;k<n;k++){let p=k;for(let i=k+1;i<n;i++)if(Math.abs(m[i][k])>Math.abs(m[p][k]))p=i;if(Math.abs(m[p][k])<1e-20)throw Error('Singular element');[m[k],m[p]]=[m[p],m[k]];const d=m[k][k];for(let j=0;j<2*n;j++)m[k][j]/=d;for(let i=0;i<n;i++)if(i!==k){const q=m[i][k];for(let j=0;j<2*n;j++)m[i][j]-=q*m[k][j];}}return m.map(r=>r.slice(n));}
export function elementGeometry(mesh,t){const p=t.map(i=>mesh.nodes.slice(i*3,i*3+3).map(v=>v*.001));const inv=invert(p.map(v=>[1,...v]));return {grad:t.map((_,i)=>[inv[1][i],inv[2][i],inv[3][i]]),volume:Math.abs(tetraVolume(mesh.nodes,t))*1e-9};}
function dot(a,b){let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s;}
export function pcg(n,entries,rhs,dirichlet,{tolerance=1e-8,maxIterations=2500,matvecFactory}={}){
 const mask=new Uint8Array(n),g=new Float64Array(n),diagonal=new Float64Array(n);for(const [i,v]of dirichlet){mask[i]=1;g[i]=v;}
 const apply=matvecFactory?matvecFactory(entries,n):x=>{const y=new Float64Array(n);for(const {ids,k}of entries)for(let i=0;i<ids.length;i++)for(let j=0;j<ids.length;j++)y[ids[i]]+=k[i*ids.length+j]*x[ids[j]];return y;};
 for(const {ids,k}of entries)ids.forEach((id,i)=>diagonal[id]+=k[i*ids.length+i]);
 const kg=apply(g),b=Float64Array.from(rhs,(v,i)=>mask[i]?0:v-kg[i]),x=new Float64Array(n),r=b.slice(),z=Float64Array.from(r,(v,i)=>mask[i]?0:v/diagonal[i]);
 for(let i=0;i<n;i++)if(!mask[i]&&(!(diagonal[i]>0)||!Number.isFinite(z[i])))throw Error('Disconnected or invalid mesh');
 const norm=Math.sqrt(dot(b,b));if(norm===0)return {solution:g,iterations:0,residual:0,apply};let p=z.slice(),rz=dot(r,z),residual=1,iteration=0;
 for(;iteration<maxIterations;iteration++){const ap=apply(p);for(let i=0;i<n;i++)if(mask[i])ap[i]=0;const pap=dot(p,ap);if(!(pap>0)||!Number.isFinite(pap))throw Error('Unconstrained or ill-conditioned system');const alpha=rz/pap;for(let i=0;i<n;i++){x[i]+=alpha*p[i];r[i]-=alpha*ap[i];}residual=Math.sqrt(dot(r,r))/norm;if(residual<tolerance)break;for(let i=0;i<n;i++)z[i]=mask[i]?0:r[i]/diagonal[i];const next=dot(r,z),beta=next/rz;for(let i=0;i<n;i++)p[i]=z[i]+beta*p[i];rz=next;}
 if(residual>=tolerance||!Number.isFinite(residual))throw Error('Solver did not converge');return {solution:Float64Array.from(x,(v,i)=>v+g[i]),iterations:iteration+1,residual,apply};
}
function elasticity(E,nu){const lambda=E*nu/((1+nu)*(1-2*nu)),mu=E/(2*(1+nu)),d=Array.from({length:6},()=>Array(6).fill(0));for(let i=0;i<3;i++)for(let j=0;j<3;j++)d[i][j]=lambda+(i===j?2*mu:0);for(let i=3;i<6;i++)d[i][i]=mu;return d;}
function strainMatrix(grad){const b=Array.from({length:6},()=>Array(12).fill(0));for(let a=0;a<4;a++){const [x,y,z]=grad[a],i=a*3;b[0][i]=x;b[1][i+1]=y;b[2][i+2]=z;b[3][i]=y;b[3][i+1]=x;b[4][i+1]=z;b[4][i+2]=y;b[5][i]=z;b[5][i+2]=x;}return b;}
function elementK(b,d,v){const n=b[0].length,k=new Float64Array(n*n);for(let i=0;i<n;i++)for(let j=0;j<n;j++)for(let a=0;a<b.length;a++)for(let c=0;c<b.length;c++)k[i*n+j]+=v*b[a][i]*d[a][c]*b[c][j];return k;}
export function principalStresses(s){const a=[[s[0],s[3],s[5]],[s[3],s[1],s[4]],[s[5],s[4],s[2]]];for(let k=0;k<20;k++){let p=0,q=1;for(const [i,j]of [[0,2],[1,2]])if(Math.abs(a[i][j])>Math.abs(a[p][q])){p=i;q=j;}if(Math.abs(a[p][q])<1e-12)break;const angle=.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]),c=Math.cos(angle),d=Math.sin(angle);const app=c*c*a[p][p]-2*d*c*a[p][q]+d*d*a[q][q],aqq=d*d*a[p][p]+2*d*c*a[p][q]+c*c*a[q][q];for(let i=0;i<3;i++)if(i!==p&&i!==q){const x=a[i][p],y=a[i][q];a[i][p]=a[p][i]=c*x-d*y;a[i][q]=a[q][i]=d*x+c*y;}a[p][p]=app;a[q][q]=aqq;a[p][q]=a[q][p]=0;}return [a[0][0],a[1][1],a[2][2]].sort((a,b)=>b-a);}
export function solveElastic(mesh,{youngModulus:E,poissonRatio:nu},boundary,{method='pcg',matvecFactory}={}){
 if(!(E>0)||!Number.isFinite(E)||!Number.isFinite(nu)||nu<=-1||nu>=.49)throw Error('Valid elastic constants required; nearly incompressible models need a different element formulation');
 const n=mesh.nodes.length,force=new Float64Array(n),fixed=boundary.fixed||[];
 const fixedSet=new Set(fixed);for(const component of meshComponents(mesh))if(component.filter(i=>fixedSet.has(i)).length<3)throw Error('Every disconnected solid requires sufficient constraints; contact is not supported');
 if(fixed.length<3)throw Error('Fix at least three non-collinear nodes');
 let nonCollinear=false;const a=mesh.nodes.slice(fixed[0]*3,fixed[0]*3+3);for(let i=1;i<fixed.length&&!nonCollinear;i++)for(let j=i+1;j<fixed.length&&!nonCollinear;j++){const b=mesh.nodes.slice(fixed[i]*3,fixed[i]*3+3).map((v,k)=>v-a[k]),c=mesh.nodes.slice(fixed[j]*3,fixed[j]*3+3).map((v,k)=>v-a[k]);nonCollinear=Math.hypot(b[1]*c[2]-b[2]*c[1],b[2]*c[0]-b[0]*c[2],b[0]*c[1]-b[1]*c[0])>1e-10;}if(!nonCollinear)throw Error('Fixed nodes are collinear');
 for(const {node,value}of boundary.forces||[])for(let k=0;k<3;k++)force[node*3+k]+=value[k];
 const d=elasticity(E,nu),entries=[],matrices=[];
 for(const t of mesh.tetrahedra){const geo=elementGeometry(mesh,t),b=strainMatrix(geo.grad);entries.push({ids:t.flatMap(i=>[i*3,i*3+1,i*3+2]),k:elementK(b,d,geo.volume)});matrices.push(b);}
 const constrained=new Map(fixed.flatMap(i=>[ [i*3,0],[i*3+1,0],[i*3+2,0] ]));
 const result=pcg(n,entries,force,constrained,{tolerance:method==='pcg-strict'?1e-10:1e-8,matvecFactory}),u=result.solution,stresses=[],strains=[],vonMises=[],principal=[];
 for(let e=0;e<entries.length;e++){const local=entries[e].ids.map(i=>u[i]),strain=matrices[e].map(row=>dot(row,local)),s=d.map(row=>dot(row,strain));strains.push(strain);stresses.push(s);vonMises.push(Math.sqrt(.5*((s[0]-s[1])**2+(s[1]-s[2])**2+(s[2]-s[0])**2)+3*(s[3]**2+s[4]**2+s[5]**2)));principal.push(principalStresses(s));}
 const ku=result.apply(u),reaction=[0,0,0],applied=[0,0,0];for(let i=0;i<n;i++){applied[i%3]+=force[i];if(constrained.has(i))reaction[i%3]+=ku[i]-force[i];}
 const displacement=Array.from(u,v=>v*1000),magnitudes=Array.from({length:n/3},(_,i)=>Math.hypot(...displacement.slice(i*3,i*3+3)));
 return {kind:'elastic',engine:matvecFactory?'Airpocket Tet4 / WASM CPU':'Airpocket Tet4 / JavaScript CPU',method,displacement,magnitudes,stresses,strains,vonMises,principal,reaction,applied,iterations:result.iterations,residual:result.residual,maxDisplacementMm:Math.max(...magnitudes),maxVonMisesPa:Math.max(...vonMises)};
}
