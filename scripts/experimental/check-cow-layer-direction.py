import sys,json,itertools,argparse
from pathlib import Path
parser=argparse.ArgumentParser(description='Sample wall-adjacent tetrahedra direction against the source STEP, using discrete wall planes.')
parser.add_argument('--step',required=True,type=Path);parser.add_argument('--mesh-directory',required=True,type=Path);parser.add_argument('--gmsh-python-path',type=Path);args=parser.parse_args()
if args.gmsh_python_path:sys.path.insert(0,str(args.gmsh_python_path.resolve()))
import gmsh
root=args.mesh_directory.resolve();step=args.step.resolve(strict=True)
gmsh.initialize();gmsh.option.setNumber('General.Terminal',0);gmsh.open(str(root/'cow.msh'));tags,xyz,_=gmsh.model.mesh.getNodes();nodes={int(t):list(xyz[i*3:i*3+3]) for i,t in enumerate(tags)};surfaces=gmsh.model.getEntitiesForPhysicalGroup(2,1);faces={}
for surface in surfaces:
 ts,ets,cs=gmsh.model.mesh.getElements(2,int(surface))
 for typ,et,con in zip(ts,ets,cs):
  for i in range(len(et)):
   ids=tuple(int(v) for v in con[i*3:i*3+3]);faces[tuple(sorted(ids))]={'surface':int(surface),'ids':ids,'matches':0}
ts,ets,cs=gmsh.model.mesh.getElements(3)
for typ,et,con in zip(ts,ets,cs):
 for i in range(len(et)):
  ids=[int(v) for v in con[i*4:i*4+4]]
  for tri in itertools.combinations(ids,3):
   key=tuple(sorted(tri))
   if key in faces:faces[key]['tet']=ids;faces[key]['matches']+=1
print('wall faces',len(faces),flush=True);gmsh.model.add('reference');gmsh.option.setString('Geometry.OCCTargetUnit','M');cow=gmsh.model.occ.importShapes(str(step));gmsh.model.occ.synchronize();signs={abs(t):(1 if t>0 else -1) for d,t in gmsh.model.getBoundary(cow,oriented=True)};values=[];bad=[]
for f in faces.values():
 if 'tet' not in f:continue
 center=[sum(nodes[v][k] for v in f['ids'])/3 for k in range(3)];ct=[sum(nodes[v][k] for v in f['tet'])/4 for k in range(3)];pt,uv=gmsh.model.getClosestPoint(2,f['surface'],center);n=gmsh.model.getNormal(f['surface'],uv);a,b,c=[nodes[v] for v in f['ids']];u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)];normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];length=sum(x*x for x in normal)**.5;flip=1 if sum(normal[k]*n[k]*signs[f['surface']] for k in range(3))>0 else -1;dot=sum((ct[k]-center[k])*normal[k]/length*flip for k in range(3));values.append(float(dot))
 if dot<0:bad.append({'center':center,'surface':f['surface'],'normalOffset':float(dot)})
r={'checkedWallAdjacentCells':len(values),'wallFaceCount':len(faces),'nonUniqueAdjacencies':sum(f['matches']!=1 for f in faces.values()),'outward':sum(v>0 for v in values),'inward':sum(v<0 for v in values),'minimumNormalOffsetMetres':min(values),'maximumNormalOffsetMetres':max(values),'bad':bad,'method':'Adjacent-cell displacement dotted with discrete wall-plane normal oriented using signed OCC outward normal; all wall-face direction/adjacency check, not full volume-intersection certification'};print(json.dumps(r));(root/'normal-check.json').write_text(json.dumps(r,indent=2));gmsh.finalize()
if r['inward'] or r['nonUniqueAdjacencies'] or len(values)!=len(faces):raise RuntimeError('Sampled wall direction or adjacency check failed')

