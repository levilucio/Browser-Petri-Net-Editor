"""The delayed fault depends on the same record's correction history."""
import importlib.util
import tempfile
import types
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('sequence_hr', Path(__file__).resolve().parents[1] / 'backend/app.py')
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

class SequenceTests(unittest.TestCase):
    def test_tenth_correction_boundary_and_record_isolation(self):
        for mutant in ['none', 'late-correction-drift']:
            with self.subTest(mutant=mutant), tempfile.TemporaryDirectory() as directory:
                path = Path(directory) / 'db.sqlite3'
                app.CONFIG = types.SimpleNamespace(mutant=mutant)
                app.seed(path)
                c = app.connect(path)
                try:
                    def call(method, actor, record, **args):
                        with c:
                            return app.perform(c, app.person(c, actor), method,
                                               dict(employee=1001, record=record, date='2026-11-01', **args))
                    for record in [9010011, 9010012]:
                        call('logTime', 1001, record, kind=2, minutes=60)
                    for count in range(1, 11):
                        call('correctTime', 11, 9010011, kind=2, minutes=120, status=1, reason='test')
                        expected = 135 if mutant != 'none' and count == 10 else 120
                        self.assertEqual(call('readTime', 1001, 9010011)['minutes'], expected)
                    call('correctTime', 11, 9010012, kind=2, minutes=120, status=1, reason='test')
                    self.assertEqual(call('readTime', 1001, 9010012)['minutes'], 120)
                finally:
                    c.close()

if __name__ == '__main__':
    unittest.main()
