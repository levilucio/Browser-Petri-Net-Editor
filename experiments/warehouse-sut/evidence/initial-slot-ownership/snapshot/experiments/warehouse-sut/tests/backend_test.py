import importlib.util,json,pathlib,tempfile,unittest
APP=pathlib.Path(__file__).resolve().parents[1]/'backend/app.py'
spec=importlib.util.spec_from_file_location('warehouse',APP);app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
class WarehouseTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=pathlib.Path(self.tmp.name)/'test.sqlite3';app.seed(self.path)
    def tearDown(self):self.tmp.cleanup()
    def call(self,method,actor=1,**args):
        with app.connect(self.path) as c:return app.perform(c,app.row(c,'actors','id',actor),method,args)
    def flow(self,q=4,second=None):
        self.call('openOrder',order=1001);self.call('addLine',order=1001,line=10011,product=101,warehouse=11,quantity=q)
        if second:self.call('addLine',order=1001,line=10012,product=second[0],warehouse=11,quantity=second[1])
        self.call('submitOrder',order=1001);self.call('approveOrder',2,order=1001)
    def read_stock(self):return self.call('readStock',4,product=101,warehouse=11)
    def invariant(self):
        with app.connect(self.path) as c:self.assertEqual(app.invariant_report(c),dict(integrity='ok',foreign_keys=[],stock_failures=[]))
    def test_seed(self):
        with app.connect(self.path) as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM orders').fetchone()[0],800);self.assertEqual(c.execute('SELECT COUNT(*) FROM lines').fetchone()[0],1600)
        self.assertEqual(self.read_stock(),dict(on_hand=10,reserved=0));self.invariant()
    def test_shared_atomic_reservation(self):
        self.flow(6,(101,6));before=self.call('auditCount',4,order=1001)
        with self.assertRaises(app.Refusal):self.call('reservePair',3,order=1001,line=10011,line2=10012,warehouse=11,quantity=6,quantity2=6)
        self.assertEqual(self.read_stock(),dict(on_hand=10,reserved=0));self.assertEqual(self.call('auditCount',4,order=1001),before);self.invariant()
    def test_distinct_atomic_failure(self):
        self.flow(4,(102,9))
        with self.assertRaises(app.Refusal):self.call('reservePair',3,order=1001,line=10011,line2=10012,warehouse=11,quantity=4,quantity2=9)
        self.assertEqual(self.read_stock()['reserved'],0);self.invariant()
    def test_partial_fulfilment_return(self):
        self.flow();self.call('reserveLine',3,order=1001,line=10011,quantity=4);self.call('shipLine',3,order=1001,line=10011,quantity=2);self.call('returnLine',3,order=1001,line=10011,quantity=1)
        self.assertEqual(self.read_stock(),dict(on_hand=9,reserved=2));self.assertEqual(self.call('readTotals',4,order=1001),dict(shipped=2,returned=1));self.invariant()
    def test_return_cannot_exceed_delivered(self):
        self.flow();self.call('reserveLine',3,order=1001,line=10011,quantity=4);self.call('shipLine',3,order=1001,line=10011,quantity=4);self.call('returnLine',3,order=1001,line=10011,quantity=4)
        with self.assertRaises(app.Refusal):self.call('returnLine',3,order=1001,line=10011,quantity=1)
        self.invariant()
    def test_cross_tenant(self):
        self.flow()
        for method,args in [('readOrder',{'order':1001}),('readStock',{'product':101,'warehouse':11}),('setProduct',{'product':101,'enabled':False})]:
            with self.assertRaises(app.Refusal):self.call(method,12,**args)
    def test_quantity_typing(self):
        for q in [True,-1,1.5,'4']:
            with self.assertRaises(app.Invalid):self.call('receiveStock',3,product=101,warehouse=11,quantity=q)
    def test_roles(self):
        self.flow()
        for actor in [1,2,4,13]:
            with self.assertRaises(app.Refusal):self.call('reserveLine',actor,order=1001,line=10011,quantity=1)
    def test_cancel_releases_reservation(self):
        self.flow();self.call('reserveLine',3,order=1001,line=10011,quantity=4);self.call('shipLine',3,order=1001,line=10011,quantity=1);self.call('cancelLine',3,order=1001,line=10011)
        self.assertEqual(self.read_stock(),dict(on_hand=9,reserved=0));self.assertEqual(self.call('readOrder',4,order=1001)['pending'],0);self.invariant()
    def test_closed_order_requires_reopen(self):
        self.flow();self.call('cancelLine',3,order=1001,line=10011);self.call('closeOrder',3,order=1001)
        self.assertEqual(self.call('readOrder',4,order=1001)['state'],4);self.call('reopenOrder',2,order=1001);self.assertEqual(self.call('readOrder',4,order=1001)['state'],3)
    def test_stock_transfer_and_count(self):
        self.call('transferStock',3,product=101,warehouse=11,destination=12,quantity=3);self.call('adjustStock',3,product=101,warehouse=11,quantity=9);self.call('receiveStock',3,product=101,warehouse=11,quantity=2);self.invariant()
    def test_disabled_warehouse_retains_reservations(self):
        self.flow();self.call('reserveLine',3,order=1001,line=10011,quantity=4);self.call('setWarehouse',2,warehouse=11,enabled=False)
        with self.assertRaises(app.Refusal):self.call('shipLine',3,order=1001,line=10011,quantity=1)
        self.call('releaseLine',3,order=1001,line=10011,quantity=4);self.invariant()
if __name__=='__main__':unittest.main()
