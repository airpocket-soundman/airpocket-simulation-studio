// Independent semi-discrete RK4 oracle; no production imports.
export function reference(p){
 const N=p.fluid.cellsY,dy=p.fluid.height/N,rho=p.fluid.density,nu=p.fluid.kinematicViscosity,mu=rho*nu;
 const y=[...(p.initialProfile??new Array(N).fill(0)),p.initialDisplacement,0,0],count=1000,h=p.dt*p.steps/count;
 const rhs=z=>{const out=[],v=z[N+1];let D=2*z[0]**2/dy+2*(v-z[N-1])**2/dy;
  for(let j=0;j<N;j++){out[j]=nu/dy**2*((j?z[j-1]:-z[0])+(j<N-1?z[j+1]:2*v-z[j])-2*z[j]);if(j)D+=(z[j]-z[j-1])**2/dy;}
  out[N]=v;out[N+1]=(-p.plate.stiffness*z[N]-2*mu*(v-z[N-1])/dy)/p.plate.mass;out[N+2]=mu*D;return out;};
 for(let n=0;n<count;n++){const a=rhs(y),b=rhs(y.map((v,j)=>v+h*a[j]/2)),c=rhs(y.map((v,j)=>v+h*b[j]/2)),d=rhs(y.map((v,j)=>v+h*c[j]));for(let j=0;j<y.length;j++)y[j]+=h*(a[j]+2*b[j]+2*c[j]+d[j])/6;}
 return y;
}
