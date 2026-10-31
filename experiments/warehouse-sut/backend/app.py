"""Independent warehouse REST SUT. Python stdlib + relational SQLite, no SATEL imports."""
import argparse, json, secrets, sqlite3, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse, parse_qs
ROOT=Path(__file__).resolve().parents[1]
class Refusal(Exception): pass
class Invalid(Exception): pass

def connect(path):
    c=sqlite3.connect(path,timeout=20);c.row_factory=sqlite3.Row;c.execute('PRAGMA foreign_keys=ON');return c

def seed(path):
    with connect(path) as c:
        c.executescript('''
        DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS movements; DROP TABLE IF EXISTS audit;
        DROP TABLE IF EXISTS lines; DROP TABLE IF EXISTS orders; DROP TABLE IF EXISTS stock;
        DROP TABLE IF EXISTS products; DROP TABLE IF EXISTS warehouses; DROP TABLE IF EXISTS actors; DROP TABLE IF EXISTS tenants;
        CREATE TABLE tenants(id INTEGER PRIMARY KEY,name TEXT NOT NULL);
        CREATE TABLE actors(id INTEGER PRIMARY KEY,tenant INTEGER NOT NULL REFERENCES tenants(id),role INTEGER NOT NULL CHECK(role BETWEEN 1 AND 4),name TEXT NOT NULL);
        CREATE TABLE products(id INTEGER PRIMARY KEY,tenant INTEGER NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,active INTEGER NOT NULL CHECK(active IN (0,1)));
        CREATE TABLE warehouses(id INTEGER PRIMARY KEY,tenant INTEGER NOT NULL REFERENCES tenants(id),name TEXT NOT NULL,opened INTEGER NOT NULL CHECK(opened IN (0,1)));
        CREATE TABLE stock(product INTEGER REFERENCES products(id),warehouse INTEGER REFERENCES warehouses(id),on_hand INTEGER NOT NULL CHECK(on_hand>=0),reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=on_hand),PRIMARY KEY(product,warehouse));
        CREATE TABLE orders(id INTEGER PRIMARY KEY,tenant INTEGER NOT NULL REFERENCES tenants(id),owner INTEGER NOT NULL REFERENCES actors(id),state INTEGER NOT NULL CHECK(state BETWEEN 1 AND 5));
        CREATE TABLE lines(id INTEGER PRIMARY KEY,order_id INTEGER NOT NULL REFERENCES orders(id),product INTEGER NOT NULL REFERENCES products(id),warehouse INTEGER NOT NULL REFERENCES warehouses(id),quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 100),reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0),shipped INTEGER NOT NULL DEFAULT 0 CHECK(shipped>=0),returned INTEGER NOT NULL DEFAULT 0 CHECK(returned>=0 AND returned<=shipped),state INTEGER NOT NULL DEFAULT 1 CHECK(state IN (1,2)),CHECK(reserved+shipped<=quantity));
        CREATE TABLE audit(id INTEGER PRIMARY KEY,actor INTEGER REFERENCES actors(id),order_id INTEGER REFERENCES orders(id),action TEXT NOT NULL,details TEXT NOT NULL);
        CREATE TABLE movements(id INTEGER PRIMARY KEY,product INTEGER NOT NULL,warehouse INTEGER NOT NULL,delta INTEGER NOT NULL,kind TEXT NOT NULL,order_id INTEGER REFERENCES orders(id),FOREIGN KEY(product,warehouse) REFERENCES stock(product,warehouse));
        CREATE TABLE sessions(token TEXT PRIMARY KEY,actor INTEGER NOT NULL REFERENCES actors(id));
        CREATE INDEX lines_order ON lines(order_id); CREATE INDEX lines_stock ON lines(product,warehouse); CREATE INDEX audit_order ON audit(order_id);
        ''')
        for tenant in [1,2]:
            c.execute('INSERT INTO tenants VALUES (?,?)',(tenant,['Northstar Distribution','Harbor Supply'][tenant-1]))
            for role,name in enumerate(['Sales','Manager','Warehouse','Auditor'],1):c.execute('INSERT INTO actors VALUES (?,?,?,?)',((tenant-1)*10+role,tenant,role,f'{name} / {tenant}'))
            for w in range(1,5):c.execute('INSERT INTO warehouses VALUES (?,?,?,1)',(tenant*10+w,tenant,f'{["Central","West","East","Returns"][w-1]} / {tenant}'))
            for p in range(1,25):
                product=tenant*100+p;c.execute('INSERT INTO products VALUES (?,?,?,1)',(product,tenant,f'{["Sensor","Controller","Cable","Enclosure"][p%4]} {product}'))
                for w in range(1,5):
                    warehouse=tenant*10+w;initial=10000 if p>=4 else (10 if w==1 else 20)
                    if tenant==1 and w==1 and p in [2,3]:initial={2:8,3:12}[p]
                    c.execute('INSERT INTO stock VALUES (?,?,?,0)',(product,warehouse,initial));c.execute('INSERT INTO movements(product,warehouse,delta,kind) VALUES (?,?,?,?)',(product,warehouse,initial,'opening'))
            for i in range(400):
                oid=100000+tenant*10000+i;c.execute('INSERT INTO orders VALUES (?,?,?,4)',(oid,tenant,(tenant-1)*10+1))
                for slot in [1,2]:
                    p=tenant*100+4+(i+slot)%21;w=tenant*10+1+i%4;q=2+i%4
                    c.execute('INSERT INTO lines VALUES (?,?,?,?,?,0,?,0,1)',(oid*10+slot,oid,p,w,q,q));c.execute('UPDATE stock SET on_hand=on_hand-? WHERE product=? AND warehouse=?',(q,p,w))
                    c.execute('INSERT INTO movements(product,warehouse,delta,kind,order_id) VALUES (?,?,?,?,?)',(p,w,-q,'seed-shipment',oid))
                c.execute('INSERT INTO audit(actor,order_id,action,details) VALUES (?,?,?,?)',((tenant-1)*10+3,oid,'historical-import','{}'))

def row(c,table,key,value):
    r=c.execute(f'SELECT * FROM {table} WHERE {key}=?',(value,)).fetchone()
    if r is None:raise Refusal(f'Unknown {table} record')
    return dict(r)
def require(ok,message='Operation not permitted'):
    if not ok:raise Refusal(message)
def scoped(actor,record):require(actor['tenant']==record['tenant'],'Different tenant')
def stock(c,p,w):
    r=c.execute('SELECT * FROM stock WHERE product=? AND warehouse=?',(p,w)).fetchone()
    if r is None:raise Refusal('No stock record')
    return dict(r)
def update(c,table,key,identifier,**values):
    c.execute(f'UPDATE {table} SET '+','.join(f'{k}=?' for k in values)+f' WHERE {key}=?',(*values.values(),identifier))
def move(c,p,w,delta,kind,order=None):
    c.execute('UPDATE stock SET on_hand=on_hand+? WHERE product=? AND warehouse=?',(delta,p,w))
    c.execute('INSERT INTO movements(product,warehouse,delta,kind,order_id) VALUES (?,?,?,?,?)',(p,w,delta,kind,order))
def reserve(c,p,w,delta):c.execute('UPDATE stock SET reserved=reserved+? WHERE product=? AND warehouse=?',(delta,p,w))
def order_summary(c,o):
    lines=c.execute('SELECT * FROM lines WHERE order_id=?',(o['id'],)).fetchall()
    return dict(state=o['state'],count=len(lines),pending=0 if o['state']==5 else sum(l['quantity']-l['shipped'] for l in lines if l['state']==1),reserved=sum(l['reserved'] for l in lines),shipped=sum(l['shipped'] for l in lines),returned=sum(l['returned'] for l in lines))
def audit(c,actor,order,action,data):c.execute('INSERT INTO audit(actor,order_id,action,details) VALUES (?,?,?,?)',(actor['id'],order,action,json.dumps(data,sort_keys=True)))

# Public signatures: typed invalid input is HTTP 400; typed but disallowed actions are refused.
SIGNATURES={
 'openOrder':['order'],'addLine':['order','line','product','warehouse','quantity'],'amendLine':['order','line','quantity'],'removeLine':['order','line'],
 **{m:['order'] for m in ['submitOrder','approveOrder','rejectOrder','cancelOrder','closeOrder','reopenOrder','readOrder','readTotals','auditCount']},
 **{m:['order','line','quantity'] for m in ['reserveLine','releaseLine','shipLine','returnLine']},'cancelLine':['order','line'],'readLine':['order','line'],
 'reservePair':['order','line','line2','warehouse','quantity','quantity2'],
 'setProduct':['product','enabled'],'setWarehouse':['warehouse','enabled'],'readProduct':['product'],'readWarehouse':['warehouse'],
 **{m:['product','warehouse','quantity'] for m in ['receiveStock','adjustStock']},'transferStock':['product','warehouse','destination','quantity'],'readStock':['product','warehouse']}
def typed(method,data):
    if method not in SIGNATURES:raise Invalid('Unknown operation')
    if set(data)!=set(SIGNATURES[method]):raise Invalid('Wrong parameters')
    for key,v in data.items():
        if key=='enabled':
            if type(v) is not bool:raise Invalid('enabled must be boolean')
        elif type(v) is not int or not 0<=v<=9007199254740991:raise Invalid(f'{key} must be a nonnegative safe integer')

def perform(c,actor,method,d):
    typed(method,d);role=actor['role'];oid=d.get('order');result={};write=True
    if oid is not None:
        if method=='openOrder':
            require(role==1 and not c.execute('SELECT 1 FROM orders WHERE id=?',(oid,)).fetchone());c.execute('INSERT INTO orders VALUES (?,?,?,1)',(oid,actor['tenant'],actor['id']))
        else:
            o=row(c,'orders','id',oid);scoped(actor,o);state=o['state'];own=role==1 and actor['id']==o['owner']
            if method in ['readOrder','readTotals','auditCount']:
                write=False;s=order_summary(c,o)
                result=s if method=='readOrder' else dict(shipped=s['shipped'],returned=s['returned']) if method=='readTotals' else dict(count=c.execute('SELECT COUNT(*) FROM audit WHERE order_id=?',(oid,)).fetchone()[0])
            elif method in ['submitOrder','approveOrder','rejectOrder','cancelOrder','closeOrder','reopenOrder']:
                s=order_summary(c,o)
                if method=='submitOrder':require(own and state==1 and s['count']>0);new=2
                elif method in ['approveOrder','rejectOrder']:require(role==2 and state==2);new=3 if method=='approveOrder' else 1
                elif method=='cancelOrder':require((own or role==2) and state in [1,2]);new=5
                elif method=='closeOrder':require(role==3 and state==3 and s['pending']==0 and s['reserved']==0);new=4
                else:require(role==2 and state==4);new=3
                update(c,'orders','id',oid,state=new)
            elif method=='addLine':
                require(own and state==1 and 1<=d['quantity']<=100)
                require(not c.execute('SELECT 1 FROM lines WHERE id=?',(d['line'],)).fetchone(),'Line ID already used')
                p=row(c,'products','id',d['product']);w=row(c,'warehouses','id',d['warehouse']);scoped(actor,p);scoped(actor,w);require(p['active'] and w['opened'])
                c.execute('INSERT INTO lines(id,order_id,product,warehouse,quantity) VALUES (?,?,?,?,?)',(d['line'],oid,d['product'],d['warehouse'],d['quantity']))
            else:
                l=row(c,'lines','id',d['line']);require(l['order_id']==oid,'Line belongs to another order')
                if method=='readLine':write=False;result={k:l[k] for k in ['product','warehouse','quantity','reserved','shipped','returned','state']}
                elif method in ['amendLine','removeLine']:
                    require(own and state==1 and l['state']==1)
                    if method=='removeLine':c.execute('DELETE FROM lines WHERE id=?',(l['id'],))
                    else:
                        require(1<=d['quantity']<=100);require(row(c,'products','id',l['product'])['active'] and row(c,'warehouses','id',l['warehouse'])['opened']);update(c,'lines','id',l['id'],quantity=d['quantity'])
                else:
                    require(role==3 and state==3);p=l['product'];w=l['warehouse'];s=stock(c,p,w);q=d.get('quantity',0)
                    if method=='reservePair':
                        m=row(c,'lines','id',d['line2']);require(m['order_id']==oid and m['id']!=l['id']);require(l['warehouse']==m['warehouse']==d['warehouse']);require(row(c,'warehouses','id',w)['opened'])
                        requirements={}
                        for item,n in [(l,q),(m,d['quantity2'])]:
                            require(item['state']==1 and n>=1 and n<=item['quantity']-item['shipped']-item['reserved']);require(row(c,'products','id',item['product'])['active']);requirements[item['product']]=requirements.get(item['product'],0)+n
                        for product,n in requirements.items():
                            st=stock(c,product,w);require(st['on_hand']-st['reserved']>=n,'Insufficient aggregate stock')
                        for item,n in [(l,q),(m,d['quantity2'])]:update(c,'lines','id',item['id'],reserved=item['reserved']+n)
                        for product,n in requirements.items():reserve(c,product,w,n)
                    elif method=='reserveLine':
                        require(l['state']==1 and q>=1 and q<=l['quantity']-l['shipped']-l['reserved'] and q<=s['on_hand']-s['reserved']);require(row(c,'products','id',p)['active'] and row(c,'warehouses','id',w)['opened']);reserve(c,p,w,q);update(c,'lines','id',l['id'],reserved=l['reserved']+q)
                    elif method=='releaseLine':
                        require(l['state']==1 and 1<=q<=l['reserved']);reserve(c,p,w,-q);update(c,'lines','id',l['id'],reserved=l['reserved']-q)
                    elif method=='shipLine':
                        require(l['state']==1 and 1<=q<=l['reserved'] and row(c,'warehouses','id',w)['opened']);reserve(c,p,w,-q);move(c,p,w,-q,'shipment',oid);update(c,'lines','id',l['id'],reserved=l['reserved']-q,shipped=l['shipped']+q)
                    elif method=='returnLine':
                        require(1<=q<=l['shipped']-l['returned'] and row(c,'warehouses','id',w)['opened']);move(c,p,w,q,'return',oid);update(c,'lines','id',l['id'],returned=l['returned']+q)
                    elif method=='cancelLine':
                        require(l['state']==1 and l['quantity']>l['shipped']);reserve(c,p,w,-l['reserved']);update(c,'lines','id',l['id'],reserved=0,state=2)
                    else:raise Invalid('Unsupported order operation')
    else:
        p=row(c,'products','id',d['product']) if 'product' in d else None;w=row(c,'warehouses','id',d['warehouse']) if 'warehouse' in d else None
        for r in [p,w]:
            if r:scoped(actor,r)
        if method in ['readProduct','readWarehouse','readStock']:
            write=False
            if method=='readStock':s=stock(c,p['id'],w['id']);result=dict(on_hand=s['on_hand'],reserved=s['reserved'])
            else:result=dict(enabled=bool(p['active'] if p else w['opened']))
        elif method in ['setProduct','setWarehouse']:
            require(role==2);r=p or w;key='active' if p else 'opened';require(r[key]!=int(d['enabled']));update(c,'products' if p else 'warehouses','id',r['id'],**{key:int(d['enabled'])})
        else:
            require(role==3 and w['opened']);s=stock(c,p['id'],w['id']);q=d['quantity']
            if method=='receiveStock':require(q>=1);move(c,p['id'],w['id'],q,'receipt')
            elif method=='adjustStock':require(q>=s['reserved']);move(c,p['id'],w['id'],q-s['on_hand'],'adjustment')
            elif method=='transferStock':
                dest=row(c,'warehouses','id',d['destination']);scoped(actor,dest);require(dest['opened'] and dest['id']!=w['id'] and 1<=q<=s['on_hand']-s['reserved']);stock(c,p['id'],dest['id']);move(c,p['id'],w['id'],-q,'transfer-out');move(c,p['id'],dest['id'],q,'transfer-in')
            else:raise Invalid('Unsupported inventory operation')
    if write:audit(c,actor,oid,method,d)
    return result

def invariant_report(c):
    failures=[]
    for s in c.execute('SELECT * FROM stock'):
        reserved=c.execute('SELECT COALESCE(SUM(reserved),0) FROM lines WHERE product=? AND warehouse=?',(s['product'],s['warehouse'])).fetchone()[0]
        physical=c.execute('SELECT COALESCE(SUM(delta),0) FROM movements WHERE product=? AND warehouse=?',(s['product'],s['warehouse'])).fetchone()[0]
        if s['reserved']!=reserved or s['on_hand']!=physical:failures.append(dict(s))
    return dict(integrity=c.execute('PRAGMA quick_check').fetchone()[0],foreign_keys=[tuple(r) for r in c.execute('PRAGMA foreign_key_check')],stock_failures=failures)

def route(verb,path,query,body):
    parts=path.strip('/').split('/');d=dict(body)
    if parts==['api','orders'] and verb=='POST':return 'openOrder',d
    if len(parts)>=3 and parts[:2]==['api','orders']:
        d['order']=int(parts[2]);tail=parts[3:]
        if not tail and verb=='GET':return 'readOrder',d
        if tail==['lines'] and verb=='POST':return 'addLine',d
        if len(tail)>=2 and tail[0]=='lines':
            d['line']=int(tail[1]);action=tail[2:]
            if not action:return {'GET':'readLine','PATCH':'amendLine','DELETE':'removeLine'}[verb],d
            if verb=='POST' and len(action)==1:return {'reserve':'reserveLine','release':'releaseLine','ship':'shipLine','return':'returnLine','cancel':'cancelLine'}[action[0]],d
        if len(tail)==1:
            if verb=='GET':return {'totals':'readTotals','audit-count':'auditCount'}[tail[0]],d
            if verb=='POST':return {'submit':'submitOrder','approve':'approveOrder','reject':'rejectOrder','cancel':'cancelOrder','close':'closeOrder','reopen':'reopenOrder','reserve-pair':'reservePair'}[tail[0]],d
    if len(parts)==3 and parts[:2] in [['api','products'],['api','warehouses']]:
        kind='product' if parts[1]=='products' else 'warehouse';d[kind]=int(parts[2]);return ('read' if verb=='GET' else 'set')+kind.capitalize(),d
    if len(parts)>=4 and parts[:2]==['api','stock']:
        d.update(product=int(parts[2]),warehouse=int(parts[3]));tail=parts[4:]
        if not tail and verb=='GET':return 'readStock',d
        if len(tail)==1 and verb=='POST':return {'receive':'receiveStock','adjust':'adjustStock','transfer':'transferStock'}[tail[0]],d
    raise Invalid('Unknown route')

class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def reply(self,status,data):
        b=json.dumps(data).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
    def handle_request(self):
        u=urlparse(self.path)
        if not u.path.startswith('/api/'):
            files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'}
            if u.path not in files:self.send_error(404);return
            p=ROOT/'frontend'/files[u.path];data=p.read_bytes();self.send_response(200);self.send_header('Content-Type',{'html':'text/html','js':'text/javascript','css':'text/css'}[p.suffix[1:]]);self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size>65536:raise Invalid('Request too large')
            body=json.loads(self.rfile.read(size)) if size else {}
            if not isinstance(body,dict):raise Invalid('JSON object required')
            if u.path=='/api/health':return self.reply(200,{'ready':True,'application':'warehouse-sut','seed':1})
            if u.path=='/api/testing/reset':
                if not CONFIG.test_mode or self.headers.get('X-Test-Key')!=CONFIG.test_key or self.command!='POST':return self.reply(403,{'error':'Test reset disabled'})
                with LOCK:seed(CONFIG.db)
                return self.reply(200,{'reset':True})
            with LOCK,connect(CONFIG.db) as c:
                if u.path=='/api/login' and self.command=='POST':
                    if body.get('password')!='research-demo':return self.reply(401,{'error':'Invalid credentials'})
                    actor=row(c,'actors','id',body.get('actor'));token=secrets.token_urlsafe(24);c.execute('INSERT INTO sessions VALUES (?,?)',(token,actor['id']));return self.reply(200,{'token':token,'actor':actor})
                session=c.execute('SELECT actor FROM sessions WHERE token=?',(self.headers.get('Authorization','').removeprefix('Bearer '),)).fetchone()
                if not session:return self.reply(401,{'error':'Sign in required'})
                actor=row(c,'actors','id',session['actor'])
                if u.path=='/api/dashboard':
                    t=actor['tenant'];return self.reply(200,dict(actor=actor,products=[dict(r) for r in c.execute('SELECT * FROM products WHERE tenant=?',(t,))],warehouses=[dict(r) for r in c.execute('SELECT * FROM warehouses WHERE tenant=?',(t,))],stock=[dict(r) for r in c.execute('SELECT s.*,p.name AS product_name,w.name AS warehouse_name FROM stock s JOIN products p ON p.id=s.product JOIN warehouses w ON w.id=s.warehouse WHERE p.tenant=?',(t,))],orders=[dict(r) for r in c.execute('SELECT * FROM orders WHERE tenant=? ORDER BY id LIMIT 100',(t,))],counts=dict(orders=c.execute('SELECT COUNT(*) FROM orders WHERE tenant=?',(t,)).fetchone()[0],lines=c.execute('SELECT COUNT(*) FROM lines l JOIN orders o ON o.id=l.order_id WHERE o.tenant=?',(t,)).fetchone()[0])))
                method,data=route(self.command,u.path,parse_qs(u.query),body);result=perform(c,actor,method,data)
            self.reply(200,{'status':'accepted','result':result})
        except Refusal as e:self.reply(409,{'status':'refused','reason':str(e)})
        except (Invalid,ValueError,KeyError,TypeError,json.JSONDecodeError) as e:self.reply(400,{'error':str(e)})
        except Exception as e:
            import traceback;traceback.print_exc();self.reply(500,{'error':str(e)})
    do_GET=do_POST=do_PATCH=do_DELETE=handle_request
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--port',type=int,default=8880);ap.add_argument('--db',default=str(ROOT/'data/warehouse.sqlite3'));ap.add_argument('--test-mode',action='store_true');ap.add_argument('--test-key',default='local-experiment');CONFIG=ap.parse_args();LOCK=threading.RLock()
    Path(CONFIG.db).parent.mkdir(parents=True,exist_ok=True)
    if not Path(CONFIG.db).exists():seed(CONFIG.db)
    server=ThreadingHTTPServer(('127.0.0.1',CONFIG.port),Handler);print(f'Warehouse SUT http://127.0.0.1:{CONFIG.port}',flush=True);server.serve_forever()
