import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent


class FixedGrid144(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('grid144',ROOT/'docs/evidence/cfd-grid144-20261023/driver.py')
        self.driver = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.driver)
        self.tmp = tempfile.TemporaryDirectory()
        directory = Path(self.tmp.name)
        self.driver.OUT = directory/'output'
        self.driver.SAVED = directory/'evidence'
        self.driver.SAVED.mkdir()
        self.driver.PLAN = self.driver.SAVED/'plan.json'
        self.driver.RESULT = self.driver.SAVED/'run.json'
        self.driver.qa.EXE = directory/'synthetic-test-only.exe'
        self.driver.qa.EXE.write_bytes(b'Never launched; preparation test identity only')
        self.driver.qa.EXE_SHA = self.driver.qa.sha(self.driver.qa.EXE.read_bytes())

    def tearDown(self):
        self.tmp.cleanup()

    def test_only_mesh_changes_and_original_thresholds_and_launch_budget_remain(self):
        d=self.driver;d.prepare()
        predecessor=ROOT/'docs/evidence/cfd-iteration-audit-20261023'
        for name in ['case.cfg','input.json']:
            self.assertEqual((d.OUT/name).read_bytes(),(predecessor/name).read_bytes())
        plan=json.loads(d.PLAN.read_text())
        self.assertEqual(plan['geometry']['angular'],144)
        self.assertEqual(plan['geometry']['points'],8496)
        self.assertEqual(plan['geometry']['quadrilaterals'],8352)
        self.assertEqual(plan['files']['mesh.su2'],'410140c4c17125d8e6af04ae1787c2b804fa24f7dae643d58e9f39e572823dcc')
        self.assertEqual(plan['limits'],{'seconds':240,'rssBytes':1073741824,'threads':1,'launches':1,'workOrderAdditionalLaunchOrdinal':2,'workOrderAdditionalLaunchMaximum':2})
        self.assertEqual(plan['acceptance']['meshAndDomainRelativeDragDifferenceMaximum'],.03)
        with self.assertRaisesRegex(RuntimeError,'overwrite'):
            d.prepare()

    def test_changed_mesh_is_refused_before_launch(self):
        d=self.driver;d.prepare();(d.OUT/'mesh.su2').write_bytes(b'changed')
        with self.assertRaisesRegex(RuntimeError,'Prepared bytes changed'):
            d.run()

    def test_existing_launch_marker_prevents_retry(self):
        d=self.driver;d.prepare();(d.OUT/'solver.log').write_text('previous launch marker')
        with self.assertRaisesRegex(RuntimeError,'already consumed'):
            d.run()


if __name__=='__main__':
    unittest.main()
