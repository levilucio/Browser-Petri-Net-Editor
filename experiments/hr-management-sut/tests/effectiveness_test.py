"""Independent relational checks for the deliberately seeded effectiveness faults."""
import importlib.util, tempfile, unittest, types
from pathlib import Path
spec=importlib.util.spec_from_file_location('effect_hr',Path(__file__).resolve().parents[1]/'backend/app.py')
app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
class EffectivenessTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'hr.sqlite3';app.CONFIG=types.SimpleNamespace(mutant='none');app.seed(self.path);self.c=app.connect(self.path)
 def tearDown(self):self.c.close();self.tmp.cleanup()
 def call(self,method,actor=1001,employee=1001,record=9000001,**args):
  with self.c:return app.perform(self.c,app.person(self.c,actor),method,dict(employee=employee,record=record,date='2026-11-01',**args))
 def log(self,record=9000001,kind=0,minutes=60,employee=1001):return self.call('logTime',actor=employee,employee=employee,record=record,kind=kind,minutes=minutes)
 def test_third_entry_fault_needs_three_same_employee_entries(self):
  app.CONFIG.mutant='overwrite-earlier';self.log();self.log(9000002)
  self.assertEqual(self.call('readTime')['minutes'],60)
  self.log(9000003);self.assertEqual(self.call('readTime')['minutes'],75)
  self.assertEqual(self.call('readTime',record=9000003)['minutes'],60)
 def test_approval_double_count_is_visible_only_after_approval(self):
  app.CONFIG.mutant='approval-double-count';self.log(kind=2)
  self.assertEqual(self.call('totals')['minutes'],0)
  self.call('decideTime',actor=101,approve=True)
  self.assertEqual(self.call('totals')['minutes'],120)
 def test_correction_adds_old_approved_contribution(self):
  app.CONFIG.mutant='correction-adds-old';self.log()
  self.call('correctTime',actor=11,kind=0,minutes=120,status=2,reason='test')
  self.assertEqual(self.call('readTime')['minutes'],120)
  self.assertEqual(self.call('totals')['minutes'],180)
 def test_missing_employee_scope_changes_other_record(self):
  app.CONFIG.mutant='cross-employee-correction';self.log();self.log(record=9000021,employee=1002,minutes=45)
  self.call('correctTime',actor=11,kind=0,minutes=120,status=2,reason='test')
  self.assertEqual(self.call('readTime',actor=1002,employee=1002,record=9000021)['minutes'],120)
 def test_upper_boundary_fault_leaves_interior_unchanged(self):
  app.CONFIG.mutant='cap-long-duration';self.log(minutes=60);self.log(record=9000002,minutes=720)
  self.assertEqual(self.call('readTime')['minutes'],60)
  self.assertEqual(self.call('readTime',record=9000002)['minutes'],719)
 def test_unmutated_three_entries_corrections_and_employee_isolation(self):
  self.log();self.log(9000002,kind=2,minutes=720);self.log(9000003,kind=3);self.log(9000021,employee=1002,minutes=45)
  self.call('decideTime',actor=101,record=9000002,approve=True);self.call('decideTime',actor=101,record=9000003,approve=False)
  self.assertEqual(self.call('totals')['minutes'],780)
  for minutes in [60,120]:self.call('correctTime',actor=11,record=9000003,kind=0,minutes=minutes,status=2,reason='test')
  self.assertEqual(self.call('totals')['minutes'],900)
  self.assertEqual(self.call('readTime',actor=1002,employee=1002,record=9000021)['minutes'],45)
  self.assertEqual(self.call('auditCount',actor=11)['count'],7)
  self.assertEqual(self.c.execute('PRAGMA foreign_key_check').fetchall(),[])
if __name__=='__main__':unittest.main()
