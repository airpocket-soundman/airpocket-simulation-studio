"""Bounded, fixed Re=40 cylinder QA. No host/API configuration is broadened.

python scripts/qa-cfd-reference.py prepare
python scripts/qa-cfd-reference.py run
Requires local SU2 8.5.0 and psutil; never downloads or changes PATH.
"""
import csv
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / '.qa/cfd-reference-20261022'
PLAN = ROOT / 'docs/evidence/2026-10-22-cfd-reference-plan.json'
EVIDENCE = ROOT / 'docs/evidence/2026-10-22-cfd-reference-run.json'
EXE = Path(os.environ.get('SU2_EXE', r'C:\Users\yamashita_y00031\.codex\worktrees\external-flow-su2\airpocket-simulation-studio\.native-cache\su2-8.5.0\runtime\bin\SU2_CFD.exe'))
EXE_SHA = '3cb60646b31c08e468441be9f3497601960d4bb31349e6329982bcdeed599248'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def mesh_bytes(angular, outer):
    # Analytic circular O-grid: first radial spacing equals surface arc length,
    # then growth 1.1, clipped at the prescribed far-field radius.
    radii, spacing = [0.5], math.pi / angular
    while radii[-1] < outer:
        radii.append(min(outer, radii[-1] + spacing))
        spacing *= 1.1
    cells = (len(radii) - 1) * angular
    lines = ['NDIME= 2', f'NELEM= {cells}']
    for j in range(len(radii) - 1):
        for i in range(angular):
            k = (i + 1) % angular
            # Counter-clockwise quad: inner(i), outer(i), outer(i+1), inner(i+1).
            lines.append(f'9 {j*angular+i} {(j+1)*angular+i} {(j+1)*angular+k} {j*angular+k}')
    lines.append(f'NPOIN= {len(radii)*angular}')
    for j, radius in enumerate(radii):
        for i in range(angular):
            angle = 2 * math.pi * i / angular
            lines.append(f'{radius*math.cos(angle):.17g} {radius*math.sin(angle):.17g} {j*angular+i}')
    lines.extend(['NMARK= 2', 'MARKER_TAG= cylinder', f'MARKER_ELEMS= {angular}'])
    for i in range(angular):
        lines.append(f'3 {(i+1)%angular} {i}')
    lines.extend(['MARKER_TAG= farfield', f'MARKER_ELEMS= {angular}'])
    start = (len(radii) - 1) * angular
    for i in range(angular):
        lines.append(f'3 {start+i} {start+(i+1)%angular}')
    return ('\n'.join(lines) + '\n').encode(), {'angular': angular, 'radialLayers': len(radii)-1, 'points': len(radii)*angular, 'quadrilaterals': cells, 'outerRadiusM': outer, 'wallRadiusM': 0.5, 'firstCellHeightM': math.pi/angular, 'growth': 1.1}


def prepare():
    if OUT.exists():
        raise RuntimeError('Refusing to overwrite existing QA directory')
    if not EXE.is_file() or sha(EXE.read_bytes()) != EXE_SHA:
        raise RuntimeError('Pinned local SU2 executable missing or SHA mismatch')
    OUT.mkdir(parents=True)
    scenarios = []
    for name, angular, outer, iterations in [('baseline', 64, 50.5, 1200), ('mesh', 128, 50.5, 1200), ('domain', 64, 100.5, 1200), ('iterations', 64, 50.5, 2400)]:
        directory = OUT / name
        directory.mkdir()
        mesh, geometry = mesh_bytes(angular, outer)
        input_data = dict(schemaVersion=1, kind='steady-incompressible-laminar', meshUnits='m', densityKgM3=1, dynamicViscosityPaS=0.1, velocityMps=[4, 0, 0], wallMarker='cylinder', farfieldMarker='farfield', cflNumber=10, multigridLevels=0, maxIterations=iterations, residualLog10Target=-10)
        (directory / 'mesh.su2').write_bytes(mesh)
        write_json(directory / 'input.json', input_data)
        code = "import {buildSu2Config} from './scripts/su2-native.mjs'; console.log(buildSu2Config(JSON.parse(process.argv[1])))"
        config = subprocess.check_output(['node', '--input-type=module', '-e', code, json.dumps(input_data)], cwd=ROOT).decode().strip() + '\n'
        # Fixed diagnostic options only, never accepted from a browser/MCP request.
        config += 'REF_AREA= 1.0\nREF_LENGTH= 1.0\nHISTORY_OUTPUT= (ITER, RMS_RES, AERO_COEFF)\n'
        (directory / 'case.cfg').write_text(config, encoding='utf-8', newline='\n')
        scenarios.append(dict(name=name, geometry=geometry, maxIterations=iterations, timeoutSeconds=90, memoryRssLimitBytes=1073741824, threads=1, input=input_data, files={name: sha((directory/name).read_bytes()) for name in ['mesh.su2', 'input.json', 'case.cfg']}))
    cow = json.loads((ROOT/'docs/evidence/2026-10-15-cow-flow-equivalence.json').read_text())
    write_json(PLAN, dict(schemaVersion=1, taskId='CFD1', date='2026-10-22', status='planned-before-execution', sourceSha=subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(), harnessSha256=sha(Path(__file__).read_bytes()), executable=dict(version='8.5.0', sha256=EXE_SHA, localPath=str(EXE), archiveSha256='4466fe21aedb5e0bad57afd45f829acbdec6ec79fe8c3f8954ddea06a4b4bc11'), reference=dict(url='https://economon.github.io/docs/AIAA-2018-3111.pdf', doi='10.2514/6.2018-3111', section='IV.G, printed pp.19-20', kind='published SU2 numerical reference, not an experiment or analytic solution', reynoldsNumber=40, machNumber=None, machReason='Incompressible constant-density solver; no acoustic Mach input', diameterM=1, densityKgM3=1, speedMps=4, dynamicViscosityPaS=0.1, dragCoefficient=1.507, wall='adiabatic no-slip', farfield='circular freestream boundary 50 diameters from wall; QA outer radius 50.5m', grid='O-grid quadrilaterals, first radial step pi/N, growth 1.1'), acceptance=dict(dragRelativeErrorMaximum=0.05, allReportedResidualsLog10Maximum=-6, last100DragRelativeRangeMaximum=0.005, nodalFarfieldMassImbalanceRelativeMaximum=0.001, meshAndDomainRelativeDragDifferenceMaximum=0.03, iterationBudgetRelativeDragDifferenceMaximum=0.01, requireNoWallWarning=True, qualification='Engineering QA tolerances selected before execution, not uncertainty bounds from the reference. Coarse grids may fail; preserve failures.', massQualification='Trapezoidal integral of nodal farfield velocity, not SU2 discrete face-flux conservation.'), scenarios=scenarios, limits=dict(totalWallClockSecondsMaximum=360, maxSimultaneousSolvers=1, newDownloads=False, arbitraryConfigOrCommands=False), existingCow=dict(source='docs/evidence/2026-10-15-cow-flow-equivalence.json', assessment=cow['assessment'], physicalAccuracyVerified=False), unexecuted=['No new cow simulation', 'No host/MCP comparison for this reference', 'No full CFD1 physical validation'], parentTaskReleased=False))
    print(json.dumps({'plan': str(PLAN), 'scenarios': len(scenarios)}))


def run():
    import psutil
    plan = json.loads(PLAN.read_text(encoding='utf-8'))
    if EVIDENCE.exists():
        raise RuntimeError('Refusing to overwrite an existing run evidence record')
    if sha(EXE.read_bytes()) != plan['executable']['sha256'] or sha(Path(__file__).read_bytes()) != plan['harnessSha256']:
        raise RuntimeError('Executable or harness differs from pre-run plan')
    results = []
    for scenario in plan['scenarios']:
        directory = OUT / scenario['name']
        for name, expected in scenario['files'].items():
            if sha((directory/name).read_bytes()) != expected:
                raise RuntimeError(f'Pre-run input changed: {scenario["name"]}/{name}')
        log_path = directory / 'solver.log'
        if log_path.exists():
            raise RuntimeError('Refusing to rerun a populated scenario')
        started, peak, reason = time.monotonic(), 0, None
        with log_path.open('wb') as log:
            process = subprocess.Popen([str(EXE), 'case.cfg', '-t', '1'], cwd=directory, stdout=log, stderr=subprocess.STDOUT, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), env={**os.environ, 'OMP_NUM_THREADS': '1'})
            monitored = psutil.Process(process.pid)
            while process.poll() is None:
                try:
                    rss = monitored.memory_info().rss
                    peak = max(peak, rss)
                except psutil.NoSuchProcess:
                    break
                if time.monotonic()-started > scenario['timeoutSeconds']:
                    reason = 'wall-clock-limit'
                if rss > scenario['memoryRssLimitBytes']:
                    reason = 'memory-rss-limit'
                if reason:
                    process.kill()
                    break
                time.sleep(0.1)
            exit_code = process.wait(timeout=10)
        elapsed = time.monotonic()-started
        log = log_path.read_text(encoding='utf-8', errors='replace')
        rows = []
        history = directory / 'history.csv'
        if history.exists():
            with history.open() as stream:
                rows = [{k.strip(): float(v) for k, v in row.items()} for row in csv.DictReader(stream) if all(v.strip() for v in row.values())]
        last = rows[-1] if rows else {}
        cd_key = next((k for k in last if k in ['CD', 'Drag_Coefficient']), None)
        cd = last.get(cd_key) if cd_key else None
        residuals = {k: v for k, v in last.items() if k.startswith('rms[')}
        window = [row[cd_key] for row in rows[-100:]] if cd_key else []
        drag_range = (max(window)-min(window))/abs(cd) if window and cd else None
        mass = None
        if (directory/'flow.vtu').exists():
            mass = json.loads(subprocess.check_output(['node', 'scripts/qa-cfd-reference-mass.mjs', str(directory/'flow.vtu'), str(scenario['geometry']['outerRadiusM'])], cwd=ROOT, text=True))
        checks = dict(exitZero=exit_code == 0, withinLimits=reason is None, expectedVersion='8.5.0' in log[:10000], allResiduals=bool(residuals) and all(v <= -6 for v in residuals.values()), dragReference=cd is not None and abs(cd/1.507-1) <= 0.05, dragSettled=len(window) == 100 and drag_range <= 0.005, massBalance=mass is not None and mass['relativeImbalance'] <= 0.001, noWallWarning='did not converge' not in log.lower())
        artifacts = {p.name: dict(bytes=p.stat().st_size, sha256=sha(p.read_bytes())) for p in directory.iterdir() if p.is_file()}
        result = dict(name=scenario['name'], command=[str(EXE), 'case.cfg', '-t', '1'], elapsedSeconds=elapsed, peakRssBytes=peak, exitCode=exit_code, executionSettled=True, stopReason=reason or ('iteration-budget' if last.get('Inner_Iter', 0) >= scenario['maxIterations']-1 else 'solver-termination-see-history'), finalHistory=last, residuals=residuals, dragCoefficient=cd, dragRelativeError=None if cd is None else abs(cd/1.507-1), last100DragRelativeRange=drag_range, mass=mass, checks=checks, accepted=all(checks.values()), artifacts=artifacts, logHeader=log[:3000], logTail=log[-3000:])
        results.append(result)
        write_json(EVIDENCE, dict(schemaVersion=1, date='2026-10-22', taskId='CFD1', status='in-progress' if len(results)<4 else 'completed-with-assessment', planSha256=sha(PLAN.read_bytes()), results=results, parentTaskReleased=False, physicalAccuracyVerified=False))
        print(json.dumps({'scenario': result['name'], 'elapsedSeconds': elapsed, 'dragCoefficient': cd, 'accepted': result['accepted'], 'stopReason': result['stopReason']}), flush=True)
    baseline = results[0]['dragCoefficient']
    dependencies = {r['name']: None if not baseline or r['dragCoefficient'] is None else abs(r['dragCoefficient']/baseline-1) for r in results[1:]}
    record = json.loads(EVIDENCE.read_text())
    record['relativeDragDependencies'] = dependencies
    record['allScenariosAccepted'] = all(r['accepted'] for r in results)
    record['dependencyChecks'] = {k: v is not None and v <= (0.01 if k == 'iterations' else 0.03) for k, v in dependencies.items()}
    record['referenceStudyAccepted'] = record['allScenariosAccepted'] and all(record['dependencyChecks'].values())
    record['limitations'] = plan['unexecuted'] + ['Nodal farfield mass quadrature is not discrete solver mass-flux verification.', 'The older cow result retains 116 unconverged wall points and incomplete velocity/turbulence residuals.']
    write_json(EVIDENCE, record)


if __name__ == '__main__':
    if sys.argv[1:] == ['prepare']:
        prepare()
    elif sys.argv[1:] == ['run']:
        run()
    else:
        raise SystemExit('Usage: python scripts/qa-cfd-reference.py prepare|run')
