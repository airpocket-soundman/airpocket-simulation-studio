"""One predeclared 240-second retry of the fixed Re40 fine mesh; no restart."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('reference', ROOT/'scripts/qa-cfd-reference.py')
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
OUT = ROOT/'.qa/cfd-finemesh-followup-20261022'
SAVED = ROOT/'docs/evidence/cfd-finemesh-followup-20261022'
PLAN = SAVED/'plan.json'
RECORD = SAVED/'run.json'


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False)+'\n', encoding='utf-8', newline='\n')


def prepare():
    if OUT.exists() or PLAN.exists() or RECORD.exists():
        raise RuntimeError('Refusing to overwrite this one-shot follow-up')
    previous_path = ROOT/'docs/evidence/2026-10-22-cfd-reference-plan.json'
    previous = json.loads(previous_path.read_text(encoding='utf-8'))
    fixed = next(s for s in previous['scenarios'] if s['name'] == 'mesh')
    if qa.sha(qa.EXE.read_bytes()) != qa.EXE_SHA:
        raise RuntimeError('Pinned SU2 executable does not match')
    mesh, geometry = qa.mesh_bytes(128, 50.5)
    if qa.sha(mesh) != fixed['files']['mesh.su2']:
        raise RuntimeError('Deterministic mesh differs from the original fine mesh')
    OUT.mkdir(parents=True)
    (OUT/'mesh.su2').write_bytes(mesh)
    original = ROOT/'docs/evidence/cfd-reference-20261022/mesh'
    for name in ['case.cfg', 'input.json']:
        shutil.copyfile(original/name, OUT/name)
    for name, expected in fixed['files'].items():
        if qa.sha((OUT/name).read_bytes()) != expected:
            raise RuntimeError(f'Fixed historical input differs: {name}')
    write_json(PLAN, dict(schemaVersion=1, date='2026-10-22', taskId='CFD1', status='fixed-before-execution', sourceSha=subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip(), harnessSha256=qa.sha(Path(__file__).read_bytes()), helpersSha256={p:qa.sha((ROOT/p).read_bytes()) for p in ['scripts/qa-cfd-reference.py','scripts/qa-cfd-reference-mass.mjs']}, previousPlanSha256=qa.sha(previous_path.read_bytes()), previousScenario='mesh', unchangedFiles=fixed['files'], geometry=geometry, input=fixed['input'], changedCondition={'timeoutSeconds':{'before':90,'after':240}}, limits=dict(timeoutSeconds=240, memoryRssLimitBytes=1073741824, threads=1, solverLaunchesMaximum=1, maxIterations=fixed['maxIterations'], restart=False), acceptance=previous['acceptance'], reference=previous['reference'], previousFailures=['Coarse baseline Cd error 5.2714% exceeds 5% tolerance', 'Previous fine mesh stopped at 90s', 'Mesh sensitivity was 4.1226%, beyond 3% tolerance'], parentTaskReleased=False))
    print(json.dumps({'plan':str(PLAN),'prepared':True}))


def run():
    import psutil
    plan = json.loads(PLAN.read_text())
    if RECORD.exists() or (OUT/'solver.log').exists():
        raise RuntimeError('This one-shot experiment has already started; no retry')
    if qa.sha(Path(__file__).read_bytes()) != plan['harnessSha256'] or qa.sha(qa.EXE.read_bytes()) != qa.EXE_SHA:
        raise RuntimeError('Harness or executable changed since preparation')
    for name, expected in {**plan['unchangedFiles'],**plan['helpersSha256']}.items():
        actual = OUT/name if name in plan['unchangedFiles'] else ROOT/name
        if qa.sha(actual.read_bytes()) != expected:
            raise RuntimeError(f'Prepared input/helper changed: {name}')
    start, peak, reason = time.monotonic(), 0, None
    with (OUT/'solver.log').open('wb') as log:
        process = subprocess.Popen([str(qa.EXE),'case.cfg','-t','1'], cwd=OUT, stdout=log, stderr=subprocess.STDOUT, env={**os.environ,'OMP_NUM_THREADS':'1'}, creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        monitored = psutil.Process(process.pid)
        while process.poll() is None:
            try:
                peak = max(peak, monitored.memory_info().rss)
            except psutil.NoSuchProcess:
                break
            if time.monotonic()-start > plan['limits']['timeoutSeconds']:
                reason='wall-clock-limit'
            if peak > plan['limits']['memoryRssLimitBytes']:
                reason='memory-rss-limit'
            if reason:
                process.kill()
                break
            time.sleep(0.1)
        exit_code = process.wait(timeout=10)
    elapsed = time.monotonic()-start
    log = (OUT/'solver.log').read_text(encoding='utf-8',errors='replace')
    rows = qa.read_history(OUT/'history.csv') if (OUT/'history.csv').exists() else []
    final = rows[-1] if rows else {}
    cd = final.get('CD')
    residuals = {k:v for k,v in final.items() if k.startswith('rms[')}
    window = [r['CD'] for r in rows[-100:]] if rows and 'CD' in final else []
    drag_range = (max(window)-min(window))/abs(cd) if window and cd else None
    mass = None
    if exit_code == 0 and (OUT/'flow.vtu').exists():
        mass=json.loads(subprocess.check_output(['node','scripts/qa-cfd-reference-mass.mjs',str(OUT/'flow.vtu'),'50.5'],cwd=ROOT,text=True))
    code="import {assessSu2Run} from './scripts/su2-native.mjs'; console.log(JSON.stringify(assessSu2Run(JSON.parse(process.argv[1]),-10,'',{dimension:2,kind:'steady-incompressible-laminar'})))"
    adapter=json.loads(subprocess.check_output(['node','--input-type=module','-e',code,json.dumps(final)],cwd=ROOT,text=True))
    acceptance=plan['acceptance']
    checks=dict(exitZero=exit_code==0, withinLimits=reason is None, allRequiredResidualsPresent=all(k in residuals for k in ['rms[P]','rms[U]','rms[V]']), allReportedResidualsAtQaTarget=bool(residuals) and all(v<=acceptance['allReportedResidualsLog10Maximum'] for v in residuals.values()), dragReference=cd is not None and abs(cd/plan['reference']['dragCoefficient']-1)<=acceptance['dragRelativeErrorMaximum'], dragSettled=len(window)==100 and drag_range<=acceptance['last100DragRelativeRangeMaximum'], massBalance=mass is not None and mass['relativeImbalance']<=acceptance['nodalFarfieldMassImbalanceRelativeMaximum'], noWallWarning='did not converge' not in log.lower())
    artifacts={p.name:dict(bytes=p.stat().st_size,sha256=qa.sha(p.read_bytes())) for p in OUT.iterdir() if p.is_file()}
    baseline=json.loads((ROOT/'docs/evidence/2026-10-22-cfd-reference-run.json').read_text())['results'][0]['dragCoefficient']
    sensitivity=None if cd is None else abs(cd/baseline-1)
    for name in ['case.cfg','input.json','history.csv','solver.log']:
        if (OUT/name).exists():
            shutil.copyfile(OUT/name,SAVED/name)
    write_json(RECORD,dict(schemaVersion=1,date='2026-10-22',taskId='CFD1',planSha256=qa.sha(PLAN.read_bytes()),command=[str(qa.EXE),'case.cfg','-t','1'],executableVersion='8.5.0' if '8.5.0' in log[:10000] else None,executableSha256=qa.sha(qa.EXE.read_bytes()),elapsedSeconds=elapsed,peakRssBytes=peak,exitCode=exit_code,executionSettled=True,solverLaunches=1,stopReason=reason or ('pressure-stopping-criterion' if 'All convergence criteria satisfied.' in log else 'iteration-budget' if final.get('Inner_Iter',-1)>=1199 else 'other-see-log'),finalHistory=final,residuals=residuals,dragCoefficient=cd,dragRelativeError=None if cd is None else abs(cd/plan['reference']['dragCoefficient']-1),last100DragRelativeRange=drag_range,mass=mass,solverStoppingResidualTarget=-10,qaAcceptanceResidualTarget=-6,adapterAssessmentAtSolverTarget=adapter,checks=checks,fineMeshScenarioAccepted=all(checks.values()),meshRelativeDragDifference=sensitivity,meshDependencyAccepted=sensitivity is not None and sensitivity<=acceptance['meshAndDomainRelativeDragDifferenceMaximum'],referenceStudyAccepted=False,parentTaskReleased=False,physicalAccuracyVerified=False,artifacts=artifacts,limitations=['One fine-mesh run only. A passing fine-mesh scenario does not cure the coarse baseline or mesh-dependence failure.','All SU2 configured convergence fields refers only to RMS_PRESSURE in this fixed config. QA tests pressure/U/V separately at the prior -6 target.','Nodal farfield mass quadrature is not discrete solver flux.','Cow wall116 and velocity/turbulence residual deficiencies remain.']))
    print(json.dumps({'elapsedSeconds':elapsed,'CD':cd,'fineMeshScenarioAccepted':all(checks.values()),'stopReason':reason,'referenceStudyAccepted':False}))


if __name__=='__main__':
    if sys.argv[1:]==['prepare']:
        prepare()
    elif sys.argv[1:]==['run']:
        run()
    else:
        raise SystemExit('Usage: python scripts/qa-cfd-finemesh.py prepare|run')
