"""Independent shoelace check of the retained fixed N144 quadrilateral grid."""
from pathlib import Path
import hashlib
import json
import math

folder=Path(__file__).resolve().parent
data=(folder/'mesh.su2').read_bytes()
lines=data.decode('ascii').splitlines()
assert lines[0]=='NDIME= 2'
cells=int(lines[1].split('=')[1])
elements=[list(map(int,line.split())) for line in lines[2:2+cells]]
point_start=2+cells
count=int(lines[point_start].split('=')[1])
points=[list(map(float,line.split()[:2])) for line in lines[point_start+1:point_start+1+count]]
areas=[]
for element in elements:
    assert element[0]==9 and len(element)==5 and len(set(element[1:]))==4
    polygon=[points[index] for index in element[1:]]
    area=sum(polygon[i][0]*polygon[(i+1)%4][1]-polygon[(i+1)%4][0]*polygon[i][1] for i in range(4))/2
    assert math.isfinite(area) and area>0
    areas.append(area)
total=math.fsum(areas)
expected=144/2*math.sin(2*math.pi/144)*(50.5**2-.5**2)
relative_error=abs(total/expected-1)
assert relative_error<1e-12
record={'meshSha256':hashlib.sha256(data).hexdigest(),'points':count,'quadrilaterals':cells,'allSignedAreasPositive':True,'minimumCellAreaM2':min(areas),'totalAreaM2':total,'analyticAnnularPolygonAreaM2':expected,'relativeAreaError':relative_error,'boundaryPolygonQualification':'144-sided polygon, not an exact circular boundary; its geometric discretization changes with N'}
(folder/'mesh-check.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8',newline='\n')
