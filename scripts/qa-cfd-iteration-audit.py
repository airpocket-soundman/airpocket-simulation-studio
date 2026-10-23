"""One bounded, predeclared iteration-only follow-up. Uses pinned existing SU2; no downloads."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('reference', ROOT/'scripts/qa-cfd-reference.py')
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)
OUT = ROOT/'.qa/cfd-iteration-audit-20261023'
SAVED = ROOT/'docs/evidence/cfd-iteration-audit-20261023'
PLAN = SAVED/'plan.json'
RESULT = SAVED/'run.json'


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2)+'\n', encoding='utf-8', newline='\n')


def prepare():
    if OUT.exists() or PLAN.exists():
        raise RuntimeError('Refusing to replace a prior experiment')
    if qa.sha(qa.EXE.read_bytes()) != qa.EXE_SHA:
        raise RuntimeError('Pinned executable mismatch')
    old = json.loads((ROOT/'docs/evidence/cfd-finemesh-followup-20261022/run.json').read_text())
    original = ROOT/'docs/evidence/cfd-reference-20261022/mesh'
    mesh, geometry = qa.mesh_bytes(128, 50.5)
    cfg = (original/'case.cfg').read_text().replace('\r\n','\n')
    if cfg.count('ITER= 1200\n') != 1:
        raise RuntimeError('Expected one fixed iteration limit')
    cfg = cfg.replace('ITER= 1200\n', 'ITER= 2400\n')
    inp = json.loads((original/'input.json').read_text())
    inp['maxIterations'] = 2400
    OUT.mkdir(parents=True)
    (OUT/'mesh.su2').write_bytes(mesh)
    (OUT/'case.cfg').write_text(cfg, encoding='utf-8', newline='\n')
    write(OUT/'input.json', inp)
    original_plan = json.loads((ROOT/'docs/evidence/cfd-finemesh-followup-20261022/plan.json').read_text())
    if qa.sha(mesh) != original_plan['unchangedFiles']['mesh.su2']:
        raise RuntimeError('Mesh changed')
    write(PLAN, dict(schemaVersion=1, baseSha='5647a6f', sourceSha=subprocess.check_output(['git','rev-parse','HEAD'], cwd=ROOT, text=True).strip(), harnessSha256=qa.sha(Path(__file__).read_bytes()), executableSha256=qa.EXE_SHA, geometry=geometry, changedNumericalCondition={'maxIterations': {'before':1200, 'after':2400}}, files={name:qa.sha((OUT/name).read_bytes()) for name in ['mesh.su2','case.cfg','input.json']}, limits={'seconds':240,'rssBytes':1073741824,'threads':1,'launches':1}, acceptance=original_plan['acceptance'], reference=original_plan['reference'], priorFineDrag=old['dragCoefficient'], question='Does iteration truncation explain the 4.1227% baseline/fine drag discrepancy?', decision='Run only one fine-mesh iteration extension. Preserve original converged baseline. Spatial convergence remains unaccepted unless its unchanged 3% threshold is met. No second launch or mesh substitution.'))


def run():
    import psutil
    plan = json.loads(PLAN.read_text())
    if RESULT.exists() or (OUT/'solver.log').exists():
        raise RuntimeError('Single launch already consumed')
    if plan['harnessSha256'] != qa.sha(Path(__file__).read_bytes()) or qa.sha(qa.EXE.read_bytes()) != plan['executableSha256']:
        raise RuntimeError('Execution identity changed')
    for name, digest in plan['files'].items():
        if qa.sha((OUT/name).read_bytes()) != digest:
            raise RuntimeError('Prepared file changed: '+name)
    start, peak, reason = time.monotonic(), 0, None
    with (OUT/'solver.log').open('wb') as log:
        p = subprocess.Popen([str(qa.EXE),'case.cfg','-t','1'],cwd=OUT,stdout=log,stderr=subprocess.STDOUT,env={**os.environ,'OMP_NUM_THREADS':'1'},creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        proc = psutil.Process(p.pid)
        while p.poll() is None:
            try:
                peak = max(peak, proc.memory_info().rss)
            except psutil.NoSuchProcess:
                break
            if time.monotonic()-start > plan['limits']['seconds']:
                reason = 'wall-clock-limit'
            if peak > plan['limits']['rssBytes']:
                reason = 'memory-rss-limit'
            if reason:
                p.kill()
                break
            time.sleep(.1)
        code = p.wait(timeout=10)
    rows = qa.read_history(OUT/'history.csv') if (OUT/'history.csv').exists() else []
    final = rows[-1] if rows else {}
    cd = final.get('CD')
    baseline = json.loads((ROOT/'docs/evidence/2026-10-22-cfd-reference-run.json').read_text())['results'][0]['dragCoefficient']
    residuals = {k:v for k,v in final.items() if k.startswith('rms[')}
    tail = [r['CD'] for r in rows[-100:]]
    spread = (max(tail)-min(tail))/abs(cd) if len(tail)==100 and cd else None
    log = (OUT/'solver.log').read_text(errors='replace')
    for name in ['case.cfg','input.json','history.csv','solver.log']:
        if (OUT/name).exists():
            (SAVED/name).write_bytes((OUT/name).read_bytes())
    mesh_delta = abs(cd/baseline-1) if cd else None
    iteration_delta = abs(cd/plan['priorFineDrag']-1) if cd else None
    mass = json.loads(subprocess.check_output(['node','scripts/qa-cfd-reference-mass.mjs',str(OUT/'flow.vtu'),'50.5'],cwd=ROOT,text=True)) if code==0 and (OUT/'flow.vtu').exists() else None
    write(RESULT, dict(planSha256=qa.sha(PLAN.read_bytes()), executableSha256=qa.EXE_SHA, elapsedSeconds=time.monotonic()-start, peakRssBytes=peak, exitCode=code, stopReason=reason or ('configured-pressure-criterion' if 'All convergence criteria satisfied.' in log else 'iteration-budget'), finalHistory=final, residuals=residuals, dragCoefficient=cd, priorFineDrag=plan['priorFineDrag'], baselineDrag=baseline, meshRelativeDifference=mesh_delta, iterationRelativeDifference=iteration_delta, last100RelativeDragRange=spread, nodalFarfieldMass=mass, checks={'withinLimits':reason is None,'exitZero':code==0,'allRequiredResidualsAtQaTarget':all(k in residuals and residuals[k]<=-6 for k in ['rms[P]','rms[U]','rms[V]']),'dragReference5Percent':cd is not None and abs(cd/plan['reference']['dragCoefficient']-1)<=.05,'meshDifference3Percent':mesh_delta is not None and mesh_delta<=.03,'iterationDifference1Percent':iteration_delta is not None and iteration_delta<=.01,'tailVariationHalfPercent':spread is not None and spread<=.005}, artifacts={p.name:{'bytes':p.stat().st_size,'sha256':qa.sha(p.read_bytes())} for p in OUT.iterdir() if p.is_file()}, parentReleased=False, discreteMassFluxVerified=False, physicalAccuracyVerified=False))


if __name__ == '__main__':
    if sys.argv[1:] == ['prepare']:
        prepare()
    elif sys.argv[1:] == ['run']:
        run()
    else:
        raise SystemExit('Usage: python scripts/qa-cfd-iteration-audit.py prepare|run')
