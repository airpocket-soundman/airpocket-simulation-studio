// Engineering strains: xx, yy, zz, gamma_xy, gamma_yz, gamma_zx.
// nu_ij = -epsilon_j/epsilon_i under a uniaxial stress in direction i.
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const vector=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
export function validateOrthotropic(d){
 if(d===undefined)return;
 const keys=['model','youngModuliPa','poissonRatios','shearModuliPa','axes','source','testConditions'];
 if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).some(k=>!keys.includes(k))||d.model!=='linear-orthotropic'||![d.youngModuliPa,d.shearModuliPa].every(v=>vector(v)&&v.every(x=>x>=1e3&&x<=1e13))||!vector(d.poissonRatios)||!Array.isArray(d.axes)||d.axes.length!==3||d.axes.some(v=>!vector(v)||Math.abs(Math.hypot(...v)-1)>1e-8))throw Error('Orthotropic elasticity requires three Young/shear moduli in Pa, cyclic Poisson ratios and unit material axes');
 const [a,b,c]=d.axes,cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];if(Math.abs(dot(a,b))>1e-8||dot(cross,c)<1-1e-8)throw Error('Orthotropic material axes must be orthogonal and right handed');
 for(const key of ['source','testConditions'])if(typeof d[key]!=='string'||!d[key].trim()||d[key].length>10000)throw Error('Orthotropic elasticity requires source and test conditions');
 const [E1,E2,E3]=d.youngModuliPa,[n12,n23,n31]=d.poissonRatios,x=n12*Math.sqrt(E2/E1),y=n23*Math.sqrt(E3/E2),z=n31*Math.sqrt(E1/E3),second=1-x*x,determinant=1-x*x-y*y-z*z-2*x*y*z;
 if(!Number.isFinite(determinant)||second<=1e-8||determinant<=1e-8)throw Error('Orthotropic compliance must be positive definite and numerically supported');
 return d;
}
export function orthotropicElasticity(d){
 validateOrthotropic(d);if(!d)throw Error('Orthotropic elasticity data is missing');const [E1,E2,E3]=d.youngModuliPa,[n12,n23,n31]=d.poissonRatios,x=n12*Math.sqrt(E2/E1),y=n23*Math.sqrt(E3/E2),z=n31*Math.sqrt(E1/E3),determinant=1-x*x-y*y-z*z-2*x*y*z,inv=[[1-y*y,x+y*z,z+x*y],[x+y*z,1-z*z,y+x*z],[z+x*y,y+x*z,1-x*x]],local=Array.from({length:6},()=>Array(6).fill(0));
 for(let i=0;i<3;i++)for(let j=0;j<3;j++)local[i][j]=Math.sqrt(d.youngModuliPa[i])*Math.sqrt(d.youngModuliPa[j])*inv[i][j]/determinant;for(let i=3;i<6;i++)local[i][i]=d.shearModuliPa[i-3];
 const result=Array.from({length:6},()=>Array(6).fill(0)),R=d.axes;
 for(let column=0;column<6;column++){
  const e=Array.from({length:3},()=>Array(3).fill(0));if(column<3)e[column][column]=1;else{const [i,j]=[[0,1],[1,2],[2,0]][column-3];e[i][j]=e[j][i]=.5;}
  const rotated=R.map(a=>R.map(b=>a.reduce((sum,v,i)=>sum+v*e[i].reduce((s,w,j)=>s+w*b[j],0),0))),strain=[rotated[0][0],rotated[1][1],rotated[2][2],2*rotated[0][1],2*rotated[1][2],2*rotated[2][0]],s=local.map(row=>row.reduce((sum,v,i)=>sum+v*strain[i],0)),tensor=[[s[0],s[3],s[5]],[s[3],s[1],s[4]],[s[5],s[4],s[2]]],global=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>R.reduce((sum,a,k)=>sum+a[i]*R.reduce((v,b,l)=>v+tensor[k][l]*b[j],0),0))),stress=[global[0][0],global[1][1],global[2][2],global[0][1],global[1][2],global[2][0]];
  for(let row=0;row<6;row++)result[row][column]=stress[row];
 }
 for(let i=0;i<6;i++)for(let j=0;j<i;j++){const mean=(result[i][j]+result[j][i])/2;result[i][j]=result[j][i]=mean;}return result;
}
