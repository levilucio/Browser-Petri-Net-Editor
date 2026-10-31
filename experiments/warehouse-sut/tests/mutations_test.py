import importlib.util,pathlib,tempfile,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
mutations=module('faults',ROOT/'backend/mutations.py')
class MutationTests(unittest.TestCase):
    def setUp(self):
        self.app=module('target',ROOT/'backend/app.py');self.tmp=tempfile.TemporaryDirectory();self.db=pathlib.Path(self.tmp.name)/'test.db';self.app.seed(self.db)
    def tearDown(self):self.tmp.cleanup()
    def call(self,m,actor=1,**args):
        with self.app.connect(self.db) as c:return self.app.perform(c,self.app.row(c,'actors','id',actor),m,args)
    def flow(self):
        self.call('openOrder',order=1001);self.call('addLine',order=1001,line=10011,product=101,warehouse=11,quantity=6);self.call('addLine',order=1001,line=10012,product=101,warehouse=11,quantity=6);self.call('submitOrder',order=1001);self.call('approveOrder',2,order=1001)
    def test_pair_max_skips_combined_demand(self):
        self.flow();mutations.install(self.app,'pair-max-demand');self.call('reservePair',3,order=1001,line=10011,line2=10012,warehouse=11,quantity=6,quantity2=6)
        self.assertEqual(self.call('readStock',4,product=101,warehouse=11)['reserved'],6)
        with self.app.connect(self.db) as c:self.assertEqual(c.execute('SELECT SUM(reserved) FROM lines WHERE order_id=1001').fetchone()[0],12)
    def test_tenant_read_leak(self):
        self.flow();mutations.install(self.app,'tenant-read-leak');self.assertEqual(self.call('readOrder',11,order=1001)['state'],3)
    def test_cancellation_leaves_stock_reserved(self):
        self.flow();self.call('reserveLine',3,order=1001,line=10011,quantity=4);mutations.install(self.app,'cancel-reservation-leak');self.call('cancelLine',3,order=1001,line=10011);self.assertEqual(self.call('readStock',4,product=101,warehouse=11)['reserved'],4)
    def test_return_credits_twice(self):
        self.flow();self.call('reserveLine',3,order=1001,line=10011,quantity=4);self.call('shipLine',3,order=1001,line=10011,quantity=4);mutations.install(self.app,'return-double-credit');self.call('returnLine',3,order=1001,line=10011,quantity=1);self.assertEqual(self.call('readStock',4,product=101,warehouse=11)['on_hand'],8)
    def test_transfer_loses_units(self):
        mutations.install(self.app,'transfer-loss');self.call('transferStock',3,product=101,warehouse=11,destination=12,quantity=2);self.assertEqual(self.call('readStock',4,product=101,warehouse=12)['on_hand'],20)
    def test_refusal_persists_audit(self):
        self.flow();before=self.call('auditCount',4,order=1001)['count'];mutations.install(self.app,'refusal-audit-write')
        with self.assertRaises(self.app.Refusal):self.call('shipLine',3,order=1001,line=10011,quantity=1)
        self.assertEqual(self.call('auditCount',4,order=1001)['count'],before+1)
    def test_extra_audit_starts_at_tenth_release(self):
        self.flow();self.call('reserveLine',3,order=1001,line=10011,quantity=1);mutations.install(self.app,'late-release-audit')
        for i in range(10):
            before=self.call('auditCount',4,order=1001)['count'];self.call('releaseLine',3,order=1001,line=10011,quantity=1);self.assertEqual(self.call('auditCount',4,order=1001)['count']-before,2 if i==9 else 1);self.call('reserveLine',3,order=1001,line=10011,quantity=1)
