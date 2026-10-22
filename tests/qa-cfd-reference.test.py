"""Regression for the padded SU2 CSV header seen in the real Re40 run."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('qa_cfd_reference', Path(__file__).resolve().parent.parent/'scripts/qa-cfd-reference.py')
qa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(qa)


class Su2HistoryRegression(unittest.TestCase):
    def test_padded_quotes_and_partial_last_row(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'history.csv'
            path.write_text('"Inner_Iter",     "rms[P]"     ,       "CD"       \n0,-1.7,8.98\n820,-10.00679268,1.58644061\n821,-10.1,\n')
            rows = qa.read_history(path)
            self.assertEqual(len(rows), 2)
            self.assertEqual(rows[-1], {'Inner_Iter':820.0, 'rms[P]':-10.00679268, 'CD':1.58644061})


if __name__ == '__main__':
    unittest.main()
