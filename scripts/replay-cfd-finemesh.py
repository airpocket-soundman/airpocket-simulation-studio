"""Repeat the fixed experiment into a new .qa label without rewriting history.

python scripts/replay-cfd-finemesh.py unique-label prepare
python scripts/replay-cfd-finemesh.py unique-label run
"""
import importlib.util
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent


def destinations(label):
    if not re.fullmatch(r'[a-z0-9-]{1,40}', label):
        raise ValueError('Label must be 1..40 lowercase letters/digits/hyphens')
    output = ROOT/f'.qa/cfd-finemesh-{label}'
    return output, output/'evidence'


def main(label, action):
    output, saved = destinations(label)
    spec = importlib.util.spec_from_file_location('fixed_fine_mesh', ROOT/'scripts/qa-cfd-finemesh.py')
    fixed = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(fixed)
    fixed.OUT, fixed.SAVED = output, saved
    fixed.PLAN, fixed.RECORD = saved/'plan.json', saved/'run.json'
    if action == 'prepare':
        fixed.prepare()
    elif action == 'run':
        fixed.run()
    else:
        raise ValueError('Action must be prepare or run')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit('Usage: python scripts/replay-cfd-finemesh.py unique-label prepare|run')
    main(*sys.argv[1:])
