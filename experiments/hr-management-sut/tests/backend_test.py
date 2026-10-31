"""Independent relational/transaction checks, before any mutation campaign."""
import importlib.util, tempfile, unittest, types, sqlite3
from pathlib import Path
spec=importlib.util.spec_from_file_location('hr_backend',Path(__file__).resolve().parents[1]/'backend/app.py');app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
class BackendTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'hr.sqlite3';app.CONFIG=types.SimpleNamespace(mutant='none');app.seed(self.path);self.c=app.connect(self.path)
 def tearDown(self):self.c.close();self.tmp.cleanup()
 def invoke(self,who,method,**kw):
  with self.c:return app.perform(self.c,app.person(self.c,who),method,{'employee':1001,'record':9999999,'date':'2026-11-01',**kw})
 def test_seed_relations_and_persistence(self):
  expected={'companies':2,'departments':12,'employees':256,'time_entries':7680,'vacations':512,'audit':256}
  for table,count in expected.items():self.assertEqual(self.c.execute('SELECT COUNT(*) FROM '+table).fetchone()[0],count)
  self.assertEqual(self.c.execute('PRAGMA foreign_key_check').fetchall(),[])
  self.invoke(1001,'logTime',kind=2,minutes=60);self.c.close();self.c=app.connect(self.path)
  self.assertEqual(self.invoke(1001,'readTime')['minutes'],60)
 def test_vacation_correction_refunds_charge_and_is_audited(self):
  self.invoke(1001,'requestVacation',days=12);self.invoke(101,'decideVacation',approve=True)
  self.assertEqual(self.invoke(1001,'balance')['remaining'],18)
  self.invoke(11,'correctVacation',days=8,status=3,reason='Incorrect approval')
  self.assertEqual(self.invoke(1001,'balance')['remaining'],30)
  self.assertEqual(self.invoke(11,'auditCount')['count'],3)
 def test_insufficient_balance_refuses_without_partial_writes(self):
  self.invoke(1001,'requestVacation',days=20);self.invoke(101,'decideVacation',approve=True)
  self.invoke(1001,'requestVacation',record=9999998,days=20)
  with self.assertRaises(app.Refusal):self.invoke(101,'decideVacation',record=9999998,approve=True)
  self.assertEqual(self.invoke(1001,'readVacation',record=9999998)['status'],1)
  self.assertEqual(self.invoke(1001,'balance')['remaining'],10)
  self.assertEqual(self.invoke(11,'auditCount')['count'],3)
 def test_manager_cannot_self_approve(self):
  self.invoke(101,'logTime',employee=101,kind=1,minutes=60)
  with self.assertRaises(app.Refusal):self.invoke(101,'decideTime',employee=101,approve=True)
 def test_company_and_team_boundaries(self):
  self.invoke(1001,'logTime',kind=2,minutes=60)
  for who in [1002,102,21]:
   with self.assertRaises(app.Refusal):self.invoke(who,'readTime')
   with self.assertRaises(app.Refusal):self.invoke(who,'correctTime',kind=0,minutes=120,status=2,reason='Unauthorized')
 def test_invalid_correction_changes_neither_record_nor_audit(self):
  self.invoke(1001,'logTime',kind=0,minutes=60)
  with self.assertRaises(app.Invalid):self.invoke(11,'correctTime',kind=0,minutes=120,status=2,reason='')
  self.assertEqual(self.invoke(1001,'readTime')['minutes'],60)
  self.assertEqual(self.invoke(11,'auditCount')['count'],1)
if __name__=='__main__':unittest.main()
