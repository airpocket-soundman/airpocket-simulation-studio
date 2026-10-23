"""Second/final work-order60 launch: N144 mesh only; no downloads or retries."""
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[3]
spec = importlib.util.spec_from_file_location('reference', ROOT/'scripts/qa-cfd-reference.py')
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
SAVED = Path(__file__).resolve().parent
OUT = ROOT/'.qa/cfd-grid144-20261023'
PLAN = SAVED/'plan.json'
RESULT = SAVED/'run.json'


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, allow_nan=False)+'\n', encoding='utf-8', newline='\n')


def prepare():
    if OUT.exists() or PLAN.exists() or RESULT.exists():
        raise RuntimeError('Refusing to overwrite a prior planned experiment')
    if qa.sha(qa.EXE.read_bytes()) != qa.EXE_SHA:
        raise RuntimeError('Pinned executable mismatch')
    old_dir = ROOT/'docs/evidence/cfd-iteration-audit-20261023'
    prior = json.loads((old_dir/'run.json').read_text())
    old_plan = json.loads((old_dir/'plan.json').read_text())
    if prior['exitCode'] != 0 or not prior['checks']['allRequiredResidualsAtQaTarget']:
        raise RuntimeError('Prior N128 comparison did not pass its residual gate')
    mesh, geometry = qa.mesh_bytes(144, 50.5)
    OUT.mkdir(parents=True)
    (OUT/'mesh.su2').write_bytes(mesh)
    for name in ['case.cfg','input.json']:
        shutil.copyfile(old_dir/name, OUT/name)
        if qa.sha((OUT/name).read_bytes()) != old_plan['files'][name]:
            raise RuntimeError('Unchanged predecessor bytes differ: '+name)
    plan = dict(schemaVersion=1, task='60 CFD1', sourceSha=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(), harnessSha256=qa.sha(Path(__file__).read_bytes()), helperSha256=qa.sha((ROOT/'scripts/qa-cfd-reference.py').read_bytes()), executableSha256=qa.EXE_SHA, executableVersion='8.5.0', geometry=geometry, changedNumericalCondition={'angularResolution':{'before':128,'after':144},'derivedChanges':'first radial step pi/N and resulting radial count follow the unchanged O-grid rule'}, unchangedConfiguration='Exact previous ITER2400 config and input bytes; no restart', priorResultSha256=qa.sha((old_dir/'run.json').read_bytes()), priorFineDrag=prior['dragCoefficient'], files={name:qa.sha((OUT/name).read_bytes()) for name in ['mesh.su2','case.cfg','input.json']}, limits={'seconds':240,'rssBytes':1073741824,'threads':1,'launches':1,'workOrderAdditionalLaunchOrdinal':2,'workOrderAdditionalLaunchMaximum':2}, acceptance=old_plan['acceptance'], reference=old_plan['reference'], interpretation='Report N128-to144 separately. Small refinement ratio cannot erase failed N64-to128 comparison or establish asymptotic/general grid convergence. No extra launch if timed out or failed.')
    write(PLAN, plan)
    for name in ['mesh.su2','case.cfg','input.json']:
        shutil.copyfile(OUT/name, SAVED/name)


def run():
    import psutil
    plan = json.loads(PLAN.read_text())
    if RESULT.exists() or (OUT/'solver.log').exists():
        raise RuntimeError('Single launch already consumed')
    if qa.sha(qa.EXE.read_bytes()) != plan['executableSha256'] or qa.sha(Path(__file__).read_bytes()) != plan['harnessSha256'] or qa.sha((ROOT/'scripts/qa-cfd-reference.py').read_bytes()) != plan['helperSha256']:
        raise RuntimeError('Execution identity changed')
    for name, expected in plan['files'].items():
        if qa.sha((OUT/name).read_bytes()) != expected:
            raise RuntimeError('Prepared bytes changed: '+name)
    started, peak, reason = time.monotonic(), 0, None
    with (OUT/'solver.log').open('wb') as log:
        process = subprocess.Popen([str(qa.EXE),'case.cfg','-t','1'],cwd=OUT,stdout=log,stderr=subprocess.STDOUT,env={**os.environ,'OMP_NUM_THREADS':'1'},creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        monitored = psutil.Process(process.pid)
        while process.poll() is None:
            try:
                peak = max(peak, monitored.memory_info().rss)
            except psutil.NoSuchProcess:
                break
            if time.monotonic()-started > plan['limits']['seconds']:
                reason = 'wall-clock-limit'
            if peak > plan['limits']['rssBytes']:
                reason = 'memory-rss-limit'
            if reason:
                process.kill()
                break
            time.sleep(.1)
        code = process.wait(timeout=10)
    elapsed = time.monotonic()-started
    parse_error, rows = None, []
    try:
        rows = qa.read_history(OUT/'history.csv') if (OUT/'history.csv').exists() else []
        if any(not math.isfinite(v) for row in rows for v in row.values()):
            raise ValueError('Nonfinite history')
    except (ValueError, OSError) as error:
        parse_error = type(error).__name__
        rows = []
    final = rows[-1] if rows else {}
    cd = final.get('CD')
    residuals = {k:v for k,v in final.items() if k.startswith('rms[')}
    tail = [r['CD'] for r in rows[-100:] if 'CD' in r]
    spread = (max(tail)-min(tail))/abs(cd) if len(tail)==100 and cd else None
    baseline = json.loads((ROOT/'docs/evidence/2026-10-22-cfd-reference-run.json').read_text())['results'][0]['dragCoefficient']
    original_fine = json.loads((ROOT/'docs/evidence/cfd-iteration-audit-20261023/run.json').read_text())
    log = (OUT/'solver.log').read_text(errors='replace')
    previous_delta = abs(cd/plan['priorFineDrag']-1) if cd else None
    baseline_delta = abs(cd/baseline-1) if cd else None
    for name in ['history.csv','solver.log']:
        if (OUT/name).exists():
            shutil.copyfile(OUT/name,SAVED/name)
    write(RESULT, dict(schemaVersion=1, planSha256=qa.sha(PLAN.read_bytes()), executableSha256=plan['executableSha256'], command=[str(qa.EXE),'case.cfg','-t','1'], elapsedSeconds=elapsed, peakRssBytes=peak, exitCode=code, processSettled=process.poll() is not None, stopReason=reason or ('configured-pressure-criterion' if 'All convergence criteria satisfied.' in log else 'iteration-budget-or-other-see-log'), historyParseError=parse_error, finalHistory=final, residuals=residuals, dragCoefficient=cd, dragReferenceRelativeError=abs(cd/plan['reference']['dragCoefficient']-1) if cd else None, priorFineDrag=plan['priorFineDrag'], priorFineAngular=128, currentAngular=144, angularRefinementRatio=144/128, previousFineToCurrentRelativeDifference=previous_delta, baseline64Drag=baseline, baseline64ToCurrentRelativeDifference=baseline_delta, original64To128RelativeDifference=original_fine['meshRelativeDifference'], last100RelativeDragRange=spread, checks={'exitZero':code==0,'withinLimits':reason is None,'allRequiredResidualsPresent':all(k in residuals for k in ['rms[P]','rms[U]','rms[V]']),'allReportedResidualsAtQaTarget':bool(residuals) and all(v<=-6 for v in residuals.values()),'reference5Percent':cd is not None and abs(cd/plan['reference']['dragCoefficient']-1)<=.05,'last100VariationHalfPercent':spread is not None and spread<=.005,'successive128To144Difference3Percent':previous_delta is not None and previous_delta<=.03,'original64To128Difference3Percent':original_fine['meshRelativeDifference']<=.03}, artifacts={p.name:{'bytes':p.stat().st_size,'sha256':qa.sha(p.read_bytes())} for p in OUT.iterdir() if p.is_file()}, solverLaunches=1, referenceStudyAccepted=False, generalGridConvergenceClaimed=False, discreteMassFluxVerified=False, physicalAccuracyVerified=False, parentReleased=False))


if __name__ == '__main__':
    if sys.argv[1:] == ['prepare']:
        prepare()
    elif sys.argv[1:] == ['run']:
        run()
    else:
        raise SystemExit('Usage: python docs/evidence/cfd-grid144-20261023/driver.py prepare|run')
