"""Persisted refusal faults must survive rollback and be visible to a fresh reader."""
import importlib.util
import tempfile
import types
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('post_refusal_hr', Path(__file__).resolve().parents[1] / 'backend/app.py')
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)


class PostRefusalTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / 'db.sqlite3'
        app.CONFIG = types.SimpleNamespace(mutant='none')
        app.seed(self.path)
        self.c = app.connect(self.path)

    def tearDown(self):
        self.c.close()
        self.tmp.cleanup()

    def call(self, method, actor=1001, **args):
        with self.c:
            return app.perform(self.c, app.person(self.c, actor), method,
                               dict(employee=1001, record=9010011, date='2026-11-01') | args)

    def fresh_value(self, sql):
        c = app.connect(self.path)
        try:
            return c.execute(sql).fetchone()[0]
        finally:
            c.close()

    def compare(self, mutant, method, actor, args, sql, correct, faulty):
        for variant, expected in [('none', correct), (mutant, faulty)]:
            app.CONFIG.mutant = variant
            with self.assertRaises(app.Refusal):
                self.call(method, actor, **args)
            self.assertEqual(self.fresh_value(sql), expected)

    def test_unauthorized_cross_company_correction_persists_despite_refusal(self):
        self.call('logTime', kind=2, minutes=60)
        self.compare('refusal-time-write', 'correctTime', 21,
                     dict(kind=0, minutes=120, status=2, reason='test'),
                     'SELECT minutes FROM time_entries WHERE id=9010011', 60, 120)

    def test_unauthorized_vacation_decision_persists_despite_refusal(self):
        self.call('requestVacation', days=5)
        self.compare('refusal-vacation-write', 'decideVacation', 102, dict(approve=True),
                     'SELECT status FROM vacations WHERE id=9010011', 1, 2)

    def test_orphan_charge_changes_balance_without_changing_requested_record(self):
        self.call('requestVacation', days=5)
        self.compare('refusal-balance-charge', 'takeVacation', 1001, {},
                     'SELECT SUM(days) FROM vacations WHERE employee_id=1001 AND year=2026 AND status=2', None, 1)
        self.assertEqual(self.call('readVacation')['status'], 1)
        self.assertEqual(self.call('balance')['remaining'], 29)

    def test_failed_correction_changes_audit_only(self):
        self.call('logTime', kind=2, minutes=60)
        self.compare('refusal-audit-write', 'correctTime', 1001,
                     dict(kind=0, minutes=120, status=2, reason='test'),
                     "SELECT COUNT(*) FROM audit WHERE employee_id=1001 AND period='2026-11'", 1, 2)
        self.assertEqual(self.call('readTime')['minutes'], 60)

    def test_mutants_do_not_touch_historical_records(self):
        app.CONFIG.mutant = 'refusal-time-write'
        before = self.fresh_value('SELECT minutes FROM time_entries WHERE id=100101')
        with self.assertRaises(app.Refusal):
            self.call('correctTime', record=100101, kind=0, minutes=120, status=2, reason='test')
        self.assertEqual(self.fresh_value('SELECT minutes FROM time_entries WHERE id=100101'), before)

    def test_version_only_write_is_outside_current_public_probe_fields(self):
        self.call('requestVacation', days=5)
        self.call('decideVacation', actor=101, approve=True)
        self.call('takeVacation')
        self.call('correctVacation', actor=11, days=3, status=3, reason='test')

        def public_values():
            record = self.call('readVacation')
            return (record['days'], record['status'], self.call('balance')['remaining'],
                    self.call('auditCount')['count'])

        before = public_values()
        version = self.fresh_value('SELECT version FROM vacations WHERE id=9010011')
        app.CONFIG.mutant = 'refusal-vacation-write'
        with self.assertRaises(app.Refusal):
            self.call('decideVacation', actor=101, approve=False)
        self.assertEqual(public_values(), before)
        self.assertEqual(self.fresh_value('SELECT version FROM vacations WHERE id=9010011'), version + 1)


if __name__ == '__main__':
    unittest.main()
