"""Evaluate retained bytes without launching a solver or rewriting raw records."""
from pathlib import Path
import hashlib
import json

folder=Path(__file__).resolve().parent
read=lambda name:json.loads((folder/name).read_text())
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
plan,result,mass=read('plan.json'),read('run.json'),read('nodal-mass.json')
assert result['planSha256']==sha(folder/'plan.json')
assert plan['harnessSha256']==sha(folder/'driver.py')
for name in ['mesh.su2','case.cfg','input.json','history.csv','solver.log']:
    assert sha(folder/name)==result['artifacts'][name]['sha256']
log=(folder/'solver.log').read_text(errors='replace')
checks={**result['checks'],'noWallWarning':'did not converge' not in log.lower(),'nodalFarfieldMassRelativeMaximum':mass['relativeImbalance']<=plan['acceptance']['nodalFarfieldMassImbalanceRelativeMaximum']}
single_grid=[key for key in checks if key!='original64To128Difference3Percent']
evaluation={'rawResultSha256':sha(folder/'run.json'),'planSha256':sha(folder/'plan.json'),'checks':checks,'singleGridAndSmallStepQaAccepted':all(checks[key] for key in single_grid),'originalBaselineCriterionStillFailed':not checks['original64To128Difference3Percent'],'pressureSolverTargetReached':result['residuals']['rms[P]']<=-10,'allVelocitySolverTargetsReached':all(result['residuals'][key]<=-10 for key in ['rms[U]','rms[V]']),'workOrderAdditionalLaunchBudgetConsumed':2,'additionalLaunchBudgetMaximum':2,'noFurtherRetryPerformed':True,'interpretation':'N128-to144 ratio 1.125 gives only local sensitivity evidence. N64-to128 failure remains; no Richardson order, GCI, general grid convergence, discrete mass conservation, or experimental accuracy established.','parentReleased':False}
(folder/'evaluation.json').write_text(json.dumps(evaluation,indent=2)+'\n',encoding='utf-8',newline='\n')
