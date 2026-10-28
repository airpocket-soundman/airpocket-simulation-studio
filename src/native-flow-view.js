import * as T from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export function sliceTetrahedra(volume,{y=0,xmin=-3,xmax=3,zmin=-.35,zmax=2.35}={}){
 const positions=[],pressure=[],velocity=[];const edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
 let begin=0;for(let cell=0;cell<volume.cellCount;cell++){
  const end=volume.offsets[cell];if(volume.types[cell]!==10){begin=end;continue;}const ids=volume.connectivity.slice(begin,end);begin=end;
  const points=ids.map(i=>volume.points.slice(i*3,i*3+3));if(points.every(p=>p[1]>y)||points.every(p=>p[1]<y))continue;
  const intersections=[];for(const [a,b] of edges){const pa=points[a],pb=points[b];if((pa[1]-y)*(pb[1]-y)>0||Math.abs(pa[1]-pb[1])<1e-12)continue;const t=(y-pa[1])/(pb[1]-pa[1]);if(t<0||t>1)continue;const p=pa.map((v,k)=>v+t*(pb[k]-v));if(intersections.some(q=>Math.hypot(...q.p.map((v,k)=>v-p[k]))<1e-8))continue;
   const value=volume.fields.Pressure.values[ids[a]]*(1-t)+volume.fields.Pressure.values[ids[b]]*t;
   const v=[0,1,2].map(k=>volume.fields.Velocity.values[ids[a]*3+k]*(1-t)+volume.fields.Velocity.values[ids[b]*3+k]*t);intersections.push({p,value,v});
  }
  if(intersections.length<3)continue;const center=[0,0,0];for(const q of intersections)for(let k=0;k<3;k++)center[k]+=q.p[k]/intersections.length;
  intersections.sort((a,b)=>Math.atan2(a.p[2]-center[2],a.p[0]-center[0])-Math.atan2(b.p[2]-center[2],b.p[0]-center[0]));
  let polygon=intersections;for(const [axis,bound,sign] of [[0,xmin,1],[0,xmax,-1],[2,zmin,1],[2,zmax,-1]]){const clipped=[];for(let i=0;i<polygon.length;i++){const a=polygon[i],b=polygon[(i+1)%polygon.length],ia=sign*(a.p[axis]-bound)>=0,ib=sign*(b.p[axis]-bound)>=0;if(ia)clipped.push(a);if(ia!==ib){const t=(bound-a.p[axis])/(b.p[axis]-a.p[axis]);clipped.push({p:a.p.map((v,k)=>v+t*(b.p[k]-v)),value:a.value+t*(b.value-a.value),v:a.v.map((v,k)=>v+t*(b.v[k]-v))});}}polygon=clipped;}
  for(let i=1;i<polygon.length-1;i++)for(const q of [polygon[0],polygon[i],polygon[i+1]]){positions.push(...q.p);pressure.push(q.value);velocity.push(...q.v);}
 }return {positions,pressure,velocity};
}
const pressureColor=(value,min,max)=>{const c=new T.Color();if(value>=0)c.setRGB(1,1-Math.min(1,value/max)*.87,1-Math.min(1,value/max)*.95);else c.setRGB(1-Math.min(1,value/min)*.94,1-Math.min(1,value/min)*.55,1);return c;};
const speedColor=(v,max)=>new T.Color().setHSL((1-Math.min(1,v/max))*.67,.85,.48);
export function createNativeFlowView(container,{width=1100,height=650}={}){
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(width,height);renderer.setPixelRatio(1);container.append(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color('#edf1f3');const camera=new T.PerspectiveCamera(33,width/height,.01,100);camera.up.set(0,0,1);camera.position.set(3.7,-6,3.1);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(.05,0,.85);controls.update();scene.add(new T.HemisphereLight(0xffffff,0x7c8792,2));const light=new T.DirectionalLight(0xffffff,2);light.position.set(4,-5,8);scene.add(light);
 const group=new T.Group();scene.add(group);let output,field='pressure',range;const caption=document.createElement('div');caption.style.cssText='padding:8px;background:#fff;font:14px system-ui';container.append(caption);
 function geometry(positions,values,color){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));const colors=[];for(const value of values){const c=color(value);colors.push(c.r,c.g,c.b);}g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;}
 function clear(){for(const object of [...group.children]){group.remove(object);object.geometry?.dispose();object.material?.dispose();}}
 function draw(){if(!output)return;clear();const {surface,volume}=output,slice=sliceTetrahedra(volume);const min=range?.minimum??-35,max=range?.maximum??35;
  const points=[],pvalues=[];for(const id of surface.connectivity){points.push(...surface.points.slice(id*3,id*3+3));pvalues.push(surface.fields.Pressure.values[id]);}
  const cow=new T.Mesh(geometry(points,pvalues,p=>field==='pressure'?pressureColor(p,min,max):new T.Color('#e4e0d6')),new T.MeshStandardMaterial({vertexColors:true,side:T.DoubleSide,roughness:.9,transparent:field==='speed',opacity:field==='speed'?.36:1,depthWrite:field!=='speed'}));group.add(cow);
  const values=field==='pressure'?slice.pressure:slice.pressure.map((_,i)=>Math.hypot(...slice.velocity.slice(i*3,i*3+3)));
  const mesh=new T.Mesh(geometry(slice.positions,values,v=>field==='pressure'?pressureColor(v,min,max):speedColor(v,7)),new T.MeshBasicMaterial({vertexColors:true,side:T.DoubleSide,transparent:true,opacity:.85,depthWrite:false}));group.add(mesh);
  const used=new Set();if(field==='speed')for(let i=0;i<slice.positions.length;i+=9){const p=new T.Vector3(...slice.positions.slice(i,i+3)),key=`${Math.floor(p.x/.28)},${Math.floor(p.z/.25)}`;if(used.has(key))continue;used.add(key);const v=new T.Vector3(...slice.velocity.slice(i,i+3));v.y=0;const speed=v.length();if(speed<.1)continue;group.add(new T.ArrowHelper(v.normalize(),p.add(new T.Vector3(0,-.015,0)),.10+Math.min(speed/5,1)*.10,0x273843,.05,.025));}
  const time=output.frames?.[output.displayedFrame]?.timeSeconds;
  caption.textContent=`${time==null?'定常':`SU2時刻 ${time.toFixed(3)} s`} | SU2 8.5.0 | 空気 5 m/s → 顔から尾 | ${field==='pressure'?`ゲージ圧力 ${min}〜${max} Pa`:'流速 0〜7 m/s'} | 中央断面 y=0 | 暫定：粗いメッシュ・精度未検証`;
  renderer.render(scene,camera);
 }
 controls.addEventListener('change',()=>renderer.render(scene,camera));
 return {setResult(value){output=value;draw();},setField(value){if(!['pressure','speed'].includes(value))throw Error('Unsupported flow display');field=value;draw();},setRange(value){range=value;draw();},render(){renderer.render(scene,camera);},capture(){renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');},dispose(){controls.dispose();clear();renderer.dispose();renderer.domElement.remove();caption.remove();}};
}
