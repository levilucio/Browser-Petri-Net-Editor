"""Guard-removal mutations are opt-in; correct operations retain transaction rules."""
import importlib.util,tempfile,types,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('negative_hr',Path(__file__).resolve().parents[1]/'backend/app.py');app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
class NegativeTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'db.sqlite3';app.CONFIG=types.SimpleNamespace(mutant='none');app.seed(self.path);self.c=app.connect(self.path)
 def tearDown(self):self.c.close();self.tmp.cleanup()
 def call(self,method,actor=1001,**args):
  with self.c:return app.perform(self.c,app.person(self.c,actor),method,dict(employee=1001,record=9010011,date='2026-11-01',**args))
 def test_repeated_decision_refused_unless_mutated(self):
  self.call('logTime',kind=2,minutes=60);self.call('decideTime',actor=101,approve=True)
  with self.assertRaises(app.Refusal):self.call('decideTime',actor=101,approve=False)
  self.assertEqual(self.call('readTime')['status'],2)
  app.CONFIG.mutant='repeat-decision';self.call('decideTime',actor=101,approve=False)
  self.assertEqual(self.call('readTime')['status'],3)
 def test_self_correction_refused_unless_mutated(self):
  self.call('logTime',kind=2,minutes=60)
  with self.assertRaises(app.Refusal):self.call('correctTime',kind=0,minutes=120,status=2,reason='test')
  app.CONFIG.mutant='employee-correction';self.call('correctTime',kind=0,minutes=120,status=2,reason='test')
  self.assertEqual(self.call('readTime')['minutes'],120)
if __name__=='__main__':unittest.main()
