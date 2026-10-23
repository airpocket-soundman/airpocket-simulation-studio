import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent


class IterationAuditTest(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('iteration_audit', ROOT/'scripts/qa-cfd-iteration-audit.py')
        self.audit = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.audit)
        self.tmp = tempfile.TemporaryDirectory()
        directory = Path(self.tmp.name)
        self.audit.OUT = directory/'output'
        self.audit.SAVED = directory/'evidence'
        self.audit.PLAN = self.audit.SAVED/'plan.json'
        self.audit.RESULT = self.audit.SAVED/'run.json'
        # Only exercise preparation/identity guards; no solver is launched.
        self.audit.qa.EXE = directory/'synthetic.exe'
        self.audit.qa.EXE.write_bytes(b'synthetic test executable identity; never launched')
        self.audit.qa.EXE_SHA = self.audit.qa.sha(self.audit.qa.EXE.read_bytes())

    def tearDown(self):
        self.tmp.cleanup()

    def test_plan_changes_only_iteration_limit_and_refuses_overwrite(self):
        self.audit.prepare()
        original = (ROOT/'docs/evidence/cfd-reference-20261022/mesh/case.cfg').read_text()
        actual = (self.audit.OUT/'case.cfg').read_text()
        self.assertEqual(actual.replace('ITER= 2400\n','ITER= 1200\n'), original)
        plan = json.loads(self.audit.PLAN.read_text())
        self.assertEqual(plan['files']['mesh.su2'], '2ab642b5d0f3863492bfa18789eb22e719715e0105e2a62742d98bf21b24c7b6')
        self.assertEqual(plan['limits'], {'seconds':240,'rssBytes':1073741824,'threads':1,'launches':1})
        self.assertEqual(plan['acceptance']['meshAndDomainRelativeDragDifferenceMaximum'], .03)
        with self.assertRaisesRegex(RuntimeError, 'replace'):
            self.audit.prepare()

    def test_changed_prepared_config_is_refused_before_launch(self):
        self.audit.prepare()
        (self.audit.OUT/'case.cfg').write_text('tampered')
        with self.assertRaisesRegex(RuntimeError, 'Prepared file changed'):
            self.audit.run()

    def test_changed_executable_is_refused_before_launch(self):
        self.audit.prepare()
        self.audit.qa.EXE.write_bytes(b'changed')
        with self.assertRaisesRegex(RuntimeError, 'identity changed'):
            self.audit.run()


if __name__ == '__main__':
    unittest.main()
