import sys,json,math,time,argparse,hashlib
from pathlib import Path
parser=argparse.ArgumentParser(description='Experimental fixed cow geometry boundary-layer meshing; SI metres only, not a general mesher.')
parser.add_argument('--step',required=True,type=Path);parser.add_argument('--output-directory',required=True,type=Path);parser.add_argument('--gmsh-python-path',type=Path)
args=parser.parse_args()
if args.gmsh_python_path:sys.path.insert(0,str(args.gmsh_python_path.resolve()))
import gmsh
step=args.step.resolve(strict=True);out=args.output_directory.resolve();out.mkdir(exist_ok=False)
if gmsh.__version__!='4.14.1':raise RuntimeError('This experiment is pinned to Gmsh 4.14.1')
gmsh.initialize();gmsh.option.setNumber('General.NumThreads',1);gmsh.option.setNumber('General.Terminal',1);gmsh.logger.start();gmsh.model.add('cow-boundary-layer');gmsh.option.setString('Geometry.OCCTargetUnit','M')
try:
 cow=gmsh.model.occ.importShapes(str(step));gmsh.model.occ.synchronize()
 if len(cow)!=1 or cow[0][0]!=3:raise RuntimeError('One closed cow STEP volume required')
 bounds=gmsh.model.getBoundingBox(3,cow[0][1])
 if min(bounds[:3])< -3 or max(bounds[3:])>3:raise RuntimeError('This fixed cow recipe requires metre-scale geometry within +/-3 m')
 boundary=gmsh.model.getBoundary(cow,combined=True,oriented=True);walls=[(2,abs(t)) for d,t in boundary if d==2];gmsh.model.occ.remove(cow,recursive=False);gmsh.model.occ.synchronize()
 for d,t in boundary:
  if t<0:gmsh.model.mesh.setReverse(d,-t,True)
 gmsh.option.setNumber('Mesh.MeshSizeMin',.003);gmsh.option.setNumber('Mesh.MeshSizeMax',1);gmsh.option.setNumber('Mesh.MeshSizeFromCurvature',14);gmsh.option.setNumber('Mesh.MeshSizeExtendFromBoundary',0)
 def size(dim,tag,x,y,z,lc):
  dist=math.sqrt(max(-.9-x,0,x-1.5)**2+max(abs(y)-.45,0)**2+max(-z,0,z-1.85)**2)
  local=math.sqrt((x-.84)**2+(abs(y)-.126)**2+(z-1.51)**2)
  crease=math.sqrt((x-.753)**2+(abs(y)-.161)**2+(z-1.458)**2)
  return min(lc,.075+.5*dist,1,.008+.6*local,.003+.4*crease)
 gmsh.model.mesh.setSizeCallback(size)
 gmsh.model.mesh.generate(2)
 nodeTags,nodeXYZ,_=gmsh.model.mesh.getNodes();points={int(t):[float(v) for v in nodeXYZ[i*3:i*3+3]] for i,t in enumerate(nodeTags)};incident={};triangles=[];signs={abs(t):(1 if t>0 else -1) for d,t in boundary}
 for _,surface in walls:
  types2,tags2,conn2=gmsh.model.mesh.getElements(2,surface)
  for typ,ets,con in zip(types2,tags2,conn2):
   for i in range(len(ets)):
    ids=[int(v) for v in con[i*3:i*3+3]];a,b,c=[points[v] for v in ids];u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)];n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];length=math.sqrt(sum(x*x for x in n));n=[x/length for x in n];center=[(a[k]+b[k]+c[k])/3 for k in range(3)];closest,uv=gmsh.model.getClosestPoint(2,surface,center);cad=gmsh.model.getNormal(surface,uv);flip=1 if sum(n[k]*cad[k]*signs[surface] for k in range(3))>0 else -1;n=[x*flip for x in n];triangles.append(ids)
    for tag in ids:incident.setdefault(tag,[]).append(n)
 normals={};minimumMargin=1
 for tag,ns in incident.items():
  direction=[sum(n[k] for n in ns) for k in range(3)];length=math.sqrt(sum(x*x for x in direction));direction=[x/length for x in direction]
  for it in range(300):
   dots=[sum(direction[k]*n[k] for k in range(3)) for n in ns];j=min(range(len(dots)),key=dots.__getitem__)
   if dots[j]>=.1:break
   direction=[direction[k]+(.11-dots[j])*ns[j][k] for k in range(3)];length=math.sqrt(sum(x*x for x in direction));direction=[x/length for x in direction]
  margin=min(sum(direction[k]*n[k] for k in range(3)) for n in ns);minimumMargin=min(minimumMargin,margin);normals[tag]=direction
 print('CUSTOM_NORMAL_MINIMUM_MARGIN',minimumMargin,flush=True)
 if minimumMargin<=0:raise RuntimeError('No common outward extrusion direction')
 data=[]
 for ids in triangles:
  data.extend([points[t][k] for k in range(3) for t in ids]);data.extend([normals[t][k] for t in ids for k in range(3)])
 view=gmsh.view.add('outward normals');gmsh.view.addListData(view,'VT',len(triangles),data);viewIndex=gmsh.view.getIndex(view)
 heights=[];total=0
 for i in range(10):total+=.000003*1.6**i;heights.append(total)
 ext=gmsh.model.geo.extrudeBoundaryLayer(walls,[1]*len(heights),heights,False,False,viewIndex)
 top=[ext[i-1] for i in range(1,len(ext)) if ext[i][0]==3];layers=[t for d,t in ext if d==3];gmsh.model.geo.synchronize();print('LAYERS',len(layers),'TOP',len(top),'thickness',total,flush=True)
 coords=[(-8,-4,-3),(6,-4,-3),(6,4,-3),(-8,4,-3),(-8,-4,5),(6,-4,5),(6,4,5),(-8,4,5)];pts=[gmsh.model.geo.addPoint(*p,1) for p in coords];edges={}
 def edge(a,b):
  if (b,a) in edges:return -edges[b,a]
  if (a,b) not in edges:edges[a,b]=gmsh.model.geo.addLine(pts[a],pts[b])
  return edges[a,b]
 far=[]
 for ids in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
  loop=gmsh.model.geo.addCurveLoop([edge(ids[i],ids[(i+1)%4]) for i in range(4)]);far.append(gmsh.model.geo.addPlaneSurface([loop]))
 outer=gmsh.model.geo.addSurfaceLoop(far);inner=gmsh.model.geo.addSurfaceLoop([t for d,t in top]);air=gmsh.model.geo.addVolume([outer,inner]);gmsh.model.geo.synchronize();gmsh.model.addPhysicalGroup(2,[t for d,t in walls],1,'cow');gmsh.model.addPhysicalGroup(2,far,2,'farfield');gmsh.model.addPhysicalGroup(3,layers+[air],3,'air');gmsh.model.mesh.generate(3)
 tags,xyz,_=gmsh.model.mesh.getNodes();types,et,conn=gmsh.model.mesh.getElements(3);quality=gmsh.model.mesh.getElementQualities([int(t) for group in et for t in group],'minDetJac');info={'nodes':len(tags),'elementTypes':[int(t) for t in types],'counts':[len(v) for v in et],'minimumDetJac':float(min(quality)),'layerSpacingDefinition':'nominal extrusion displacement; wall-normal spacing varies at creases','firstLayerMetres':.000003,'layerCount':10,'cumulativeHeightsMetres':heights,'orientationReversals':sum(t<0 for d,t in boundary),'customOutwardNormalMinimumMargin':float(minimumMargin),'gmshVersion':gmsh.__version__,'stepSha256':hashlib.sha256(step.read_bytes()).hexdigest(),'wallDirectionCheckRequired':True,'nonpositiveElements':int(sum(q<=0 for q in quality)),'nonpositiveByType':{int(typ):int(sum(q<=0 for q in gmsh.model.mesh.getElementQualities([int(t) for t in tags],'minDetJac'))) for typ,tags in zip(types,et)},'physicalValidationComplete':False};(out/'mesh-info.json').write_text(json.dumps(info,indent=2));print(json.dumps(info),flush=True)
 (out/'negative-volumes.json').write_text(json.dumps([{ 'volume':v,'negative':int(sum(q<=0 for q in gmsh.model.mesh.getElementQualities([int(t) for group in gmsh.model.mesh.getElements(3,v)[1] for t in group],'minDetJac')))} for v in layers]));
 if min(quality)<=0:raise RuntimeError('Nonpositive element Jacobian; refusing solver run')
 gmsh.write(str(out/'cow.su2'));gmsh.write(str(out/'cow.msh'));info['exportedNodes']=int(next(line.split('=')[1] for line in (out/'cow.su2').read_text().splitlines() if line.startswith('NPOIN=')));(out/'mesh-info.json').write_text(json.dumps(info,indent=2))
finally:
 (out/'gmsh.log').write_text('\n'.join(gmsh.logger.get()),encoding='utf-8');gmsh.finalize()
