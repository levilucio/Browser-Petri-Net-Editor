import importlib.util
from pathlib import Path
import tempfile
import unittest
spec = importlib.util.spec_from_file_location('reservation', Path(__file__).resolve().parents[1] / 'backend/app.py')
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)

class ReservationTests(unittest.TestCase):
    def make(self, variant='none'):
        db = app.Store(':memory:', variant)
        self.addCleanup(db.close)
        return db

    def test_seeded_relational_data(self):
        s = self.make()
        self.assertEqual(s.db.execute('SELECT count(*) FROM reservations').fetchone()[0], 51)
        self.assertEqual(s.db.execute('PRAGMA foreign_key_check').fetchall(), [])

    def test_both_allocation_branches_and_receipts(self):
        for choice in (0, 1):
            s = self.make(); s.invoke('open', {})
            self.assertEqual(s.invoke('allocate', {}, choice)['result'], {'allocated': choice + 1})
            self.assertEqual(s.invoke('finish', {})['result'], {'receipt': choice + 1})

    def test_explicit_choices_retained(self):
        s = self.make(); s.invoke('open', {}); cp = s.checkpoint()
        for warehouse in (1, 2):
            self.assertEqual(s.restore(cp['checkpoint'])['digest'], cp['digest'])
            self.assertEqual(s.invoke('reserve', {'warehouse': warehouse})['result'], {'allocated': warehouse})

    def test_refusal_does_not_write(self):
        s = self.make(); before = s.digest()
        self.assertEqual(s.invoke('finish', {})['status'], 'refused')
        self.assertEqual(before, s.digest())

    def test_seed_and_counter_restore_replay(self):
        s = self.make(); s.reset(123); s.invoke('open', {}); cp = s.checkpoint()
        result = s.invoke('allocate', {}); after = s.digest()
        s.restore(cp['checkpoint'])
        self.assertEqual(s.invoke('allocate', {}), result)
        self.assertEqual(s.digest(), after)

    def test_hidden_commitment_is_restored(self):
        s = self.make('early-commitment'); s.invoke('open', {}, 1); cp = s.checkpoint()
        self.assertEqual(s.invoke('reserve', {'warehouse': 1})['status'], 'refused')
        s.invoke('reserve', {'warehouse': 2}); s.invoke('finish', {})
        s.restore(cp['checkpoint'])
        self.assertEqual(s.invoke('reserve', {'warehouse': 1})['status'], 'refused')
        self.assertEqual(s.invoke('reserve', {'warehouse': 2})['status'], 'accepted')

    def test_missing_b(self):
        s = self.make('missing-b')
        for choice in (0, 1):
            s.reset(); s.invoke('open', {})
            self.assertEqual(s.invoke('allocate', {}, choice)['result'], {'allocated': 1})

    def test_illegal_output(self):
        s = self.make('illegal-output'); s.invoke('open', {})
        self.assertEqual(s.invoke('allocate', {}, 1)['result'], {'allocated': 99})
        self.assertEqual(s.db.execute('SELECT warehouse FROM reservations WHERE id=1').fetchone()[0], 2)

    def test_branch_specific_receipt(self):
        for choice in (0, 1):
            s = self.make('bad-b-receipt'); s.invoke('open', {}); s.invoke('allocate', {}, choice)
            self.assertEqual(s.invoke('finish', {})['result'], {'receipt': 1 if choice == 0 else 99})

    def test_reset_invalidates_checkpoints(self):
        s = self.make(); cp = s.checkpoint(); s.reset()
        with self.assertRaises(ValueError): s.restore(cp['checkpoint'])

    def test_invalid_request_does_not_write(self):
        s = self.make(); before = s.digest()
        for method, args in [('unknown', {}), ('reserve', {'warehouse': True}), ('open', {'extra': 1})]:
            with self.assertRaises(ValueError): s.invoke(method, args)
        self.assertEqual(s.digest(), before)

if __name__ == '__main__': unittest.main()
