// Orient pressure from solid topology rather than display triangle winding.
export function outwardSurfaceNormals(mesh){
 const faces=new Map(),key=ids=>ids.slice().sort((a,b)=>a-b).join(',');
 for(const t of mesh.tetrahedra)for(let opposite=0;opposite<4;opposite++){const face=t.filter((_,i)=>i!==opposite),id=key(face),prior=faces.get(id);faces.set(id,prior?{count:prior.count+1}:{count:1,opposite:t[opposite]});}
 return mesh.surface.map(s=>{const adjacent=faces.get(key(s.nodes));if(!adjacent||adjacent.count!==1)throw Error('Load surface must bound exactly one solid element');const [a,b,c]=s.nodes.map(i=>mesh.nodes.slice(i*3,i*3+3)),u=b.map((v,k)=>v-a[k]),v=c.map((q,k)=>q-a[k]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal);if(!(length>0))throw Error('Degenerate load surface');const inside=mesh.nodes.slice(adjacent.opposite*3,adjacent.opposite*3+3),sign=normal.reduce((sum,q,k)=>sum+q*(inside[k]-a[k]),0)>0?-1:1;return normal.map(q=>q*sign/length);});
}
