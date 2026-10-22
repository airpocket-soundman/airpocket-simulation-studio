import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('replay', Path(__file__).resolve().parent.parent/'scripts/replay-cfd-finemesh.py')
replay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(replay)


class ReplaySafety(unittest.TestCase):
    def test_label_is_a_new_qa_child_not_an_arbitrary_destination(self):
        for invalid in ['../main', '..', 'a/b', 'D:\\x', '', 'a'*41]:
            with self.assertRaises(ValueError):
                replay.destinations(invalid)
        output, saved = replay.destinations('test-20261022')
        self.assertEqual(output.parent, replay.ROOT/'.qa')
        self.assertEqual(saved, output/'evidence')
        self.assertNotIn('docs', output.relative_to(replay.ROOT).parts)


if __name__ == '__main__':
    unittest.main()
