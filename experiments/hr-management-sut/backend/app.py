"""Research HR SUT: HTTP/JSON + SQLite; no SATEL/APN imports. Python 3.11+."""
import argparse, datetime as dt, json, secrets, sqlite3
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlparse, parse_qs
ROOT = Path(__file__).resolve().parents[1]
MUTANTS = ['none', 'auto-approve-special', 'manager-scope', 'take-pending', 'double-charge', 'correction-no-audit', 'cross-tenant-hr', 'wrong-total',
           'overwrite-earlier', 'approval-double-count', 'correction-adds-old',
           'cross-employee-correction', 'cap-long-duration', 'repeat-decision', 'employee-correction',
           'refusal-time-write', 'refusal-vacation-write', 'refusal-balance-charge', 'refusal-audit-write']
KINDS = ['standard', 'business_trip', 'home_office', 'training', 'on_call']
STATUSES = ['empty', 'pending', 'approved', 'declined', 'taken']
PASSWORD = 'research-demo'
class Refusal(Exception): pass
class Invalid(Exception): pass

def connect(path):
    c = sqlite3.connect(path, timeout=20); c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON'); return c

def seed(path):
    c=connect(path)
    c.executescript('''
    DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS audit; DROP TABLE IF EXISTS time_entries;
    DROP TABLE IF EXISTS vacations; DROP TABLE IF EXISTS employees; DROP TABLE IF EXISTS departments; DROP TABLE IF EXISTS companies;
    CREATE TABLE companies(id INTEGER PRIMARY KEY, name TEXT NOT NULL);
    CREATE TABLE departments(id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id), name TEXT NOT NULL);
    CREATE TABLE employees(id INTEGER PRIMARY KEY, company_id INTEGER NOT NULL REFERENCES companies(id), department_id INTEGER REFERENCES departments(id), manager_id INTEGER REFERENCES employees(id), role TEXT NOT NULL CHECK(role IN ('employee','manager','hr')), name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, allowance INTEGER NOT NULL DEFAULT 30);
    CREATE TABLE time_entries(id INTEGER PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES employees(id), work_date TEXT NOT NULL, kind INTEGER NOT NULL CHECK(kind BETWEEN 0 AND 4), minutes INTEGER NOT NULL CHECK(minutes BETWEEN 15 AND 720), status INTEGER NOT NULL CHECK(status BETWEEN 1 AND 3), version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE vacations(id INTEGER PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES employees(id), start_date TEXT NOT NULL, year INTEGER NOT NULL, days INTEGER NOT NULL CHECK(days BETWEEN 1 AND 30), status INTEGER NOT NULL CHECK(status BETWEEN 1 AND 4), version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE audit(id INTEGER PRIMARY KEY AUTOINCREMENT, employee_id INTEGER NOT NULL REFERENCES employees(id), actor_id INTEGER NOT NULL REFERENCES employees(id), entity TEXT NOT NULL, record_id INTEGER NOT NULL, action TEXT NOT NULL, before_json TEXT, after_json TEXT NOT NULL, reason TEXT NOT NULL, period TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE sessions(token TEXT PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES employees(id));
    CREATE INDEX time_employee_date ON time_entries(employee_id,work_date);
    CREATE INDEX vacation_employee_year ON vacations(employee_id,year);
    CREATE INDEX audit_employee_period ON audit(employee_id,period);
    ''')
    for company in [1,2]:
        c.execute('INSERT INTO companies VALUES (?,?)',(company,['Northstar Research','Harbor Systems'][company-1]))
        for d in range(1,7):
            dept=company*10+d; manager=company*100+d
            c.execute('INSERT INTO departments VALUES (?,?,?)',(dept,company,['Engineering','Operations','Sales','Finance','Support','Research'][d-1]))
            c.execute('INSERT INTO employees VALUES (?,?,?,?,?,?,?,?)',(manager,company,dept,None,'manager',f'Manager {company}-{d}',f'manager{manager}@example.test',30))
            for n in range(1,21):
                eid=company*1000+(d-1)*20+n
                c.execute('INSERT INTO employees VALUES (?,?,?,?,?,?,?,?)',(eid,company,dept,manager,'employee',f'Employee {eid}',f'employee{eid}@example.test',30))
        for n in [1,2]:
            eid=company*10+n
            c.execute('INSERT INTO employees VALUES (?,?,?,?,?,?,?,?)',(eid,company,company*10+4,None,'hr',f'HR {eid}',f'hr{eid}@example.test',30))
    employees=c.execute('SELECT id FROM employees ORDER BY id').fetchall()
    for row in employees:
        eid=row['id']
        for day in range(1,31):
            kind=(eid+day)%5; status=2 if kind==0 else [1,2,3][day%3]
            c.execute('INSERT INTO time_entries(id,employee_id,work_date,kind,minutes,status) VALUES (?,?,?,?,?,?)',(eid*100+day,eid,f'2026-09-{day:02}',kind,60*((day%8)+1),status))
        for n in [1,2]:
            c.execute('INSERT INTO vacations(id,employee_id,start_date,year,days,status) VALUES (?,?,?,?,?,?)',(eid*10+n,eid,f'2025-0{n+5}-01',2025,5+n,4 if n==1 else 3))
        c.execute('INSERT INTO audit(employee_id,actor_id,entity,record_id,action,before_json,after_json,reason,period,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)', (eid,eid,'time_entries',eid*100+30,'seed-import','null','{}','Synthetic historical import','2026-09','2026-09-30T12:00:00+00:00'))
    c.commit();c.close()

# IDs, roles and ownership come from the relational database, never request claims.
def person(c,eid):
    row=c.execute('SELECT * FROM employees WHERE id=?',(eid,)).fetchone()
    if row is None: raise Refusal('Unknown employee')
    return dict(row)
def is_hr(actor, employee):
    return actor['role']=='hr' and (actor['company_id']==employee['company_id'] or CONFIG.mutant=='cross-tenant-hr')
def can_read(actor,employee):
    return actor['id']==employee['id'] or actor['id']==employee['manager_id'] or is_hr(actor,employee)
def manager(actor,employee):
    return actor['role']=='manager' and actor['company_id']==employee['company_id'] and actor['id']!=employee['id'] and (actor['id']==employee['manager_id'] or CONFIG.mutant=='manager-scope')
def available(c,eid,year=2026):
    allowance=person(c,eid)['allowance']
    rows=c.execute('SELECT days,status FROM vacations WHERE employee_id=? AND year=? AND status IN (2,4)',(eid,year)).fetchall()
    return allowance-sum(r['days']*(2 if CONFIG.mutant=='double-charge' and r['status']==4 else 1) for r in rows)
def integer(v,name,lo=0,hi=9007199254740991):
    if isinstance(v,bool) or not isinstance(v,int) or not lo<=v<=hi: raise Invalid(f'{name} must be an integer in [{lo}, {hi}]')
    return v
def date(v):
    try: return dt.date.fromisoformat(v).isoformat()
    except (ValueError,TypeError): raise Invalid('Invalid ISO date')
def audit(c,actor,eid,entity,rid,action,before,after,period,reason=''):
    if CONFIG.mutant=='correction-no-audit' and action=='correct': return
    c.execute('INSERT INTO audit(employee_id,actor_id,entity,record_id,action,before_json,after_json,reason,period,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
              (eid,actor['id'],entity,rid,action,json.dumps(before),json.dumps(after),reason,period,dt.datetime.now(dt.timezone.utc).isoformat()))
def get_record(c,table,rid,eid):
    r=c.execute(f'SELECT * FROM {table} WHERE id=? AND employee_id=?',(rid,eid)).fetchone()
    if r is None: raise Refusal('Record does not exist for this employee')
    return dict(r)
def perform(c,actor,method,body):
    try:
        return perform_operation(c,actor,method,body)
    except Refusal:
        # Deliberate experiment faults: an erroneous write escapes the rollback,
        # while the caller still receives exactly the original refusal response.
        # These opt-in faults touch only experiment records, never historical data.
        if CONFIG.mutant.startswith('refusal-'):
            persist_refusal_fault(c,actor,method,body)
        raise

def persist_refusal_fault(c,actor,method,body):
    table='time_entries' if method.endswith('Time') else 'vacations'
    if method not in ['correctTime','correctVacation','decideVacation','takeVacation']: return
    row=c.execute(f'SELECT * FROM {table} WHERE id=? AND employee_id=?',(body.get('record'),body.get('employee'))).fetchone()
    if row is None: return
    before=dict(row);period=(before.get('work_date') or before['start_date'])[:7]
    if period!='2026-11': return
    eid=before['employee_id'];rid=before['id'];mutant=CONFIG.mutant
    if mutant=='refusal-time-write' and method=='correctTime':
        c.execute('UPDATE time_entries SET kind=?,minutes=?,status=?,version=version+1 WHERE id=?',
                  (integer(body.get('kind'),'kind',0,4),integer(body.get('minutes'),'minutes',15,720),integer(body.get('status'),'status',1,3),rid))
    elif mutant=='refusal-vacation-write' and method=='decideVacation' and isinstance(body.get('approve'),bool):
        c.execute('UPDATE vacations SET status=?,version=version+1 WHERE id=?',(2 if body['approve'] else 3,rid))
    elif mutant=='refusal-balance-charge' and method=='takeVacation' and actor['id']==eid and before['status']==1:
        # An orphan reservation charges one day; reading the requested record
        # still returns its unchanged pending state. A balance probe is needed.
        c.execute('INSERT INTO vacations(id,employee_id,start_date,year,days,status) VALUES (?,?,?,?,?,?)',
                  (900000000+eid,eid,'2026-11-01',2026,1,2))
    elif mutant=='refusal-audit-write' and method in ['correctTime','correctVacation']:
        audit(c,actor,eid,table,rid,'failed-write',before,before,period,'Deliberate refusal-side-effect mutant')
    else: return
    c.commit()

def perform_operation(c,actor,method,body):
    eid=integer(body.get('employee'), 'employee'); employee=person(c,eid)
    if not can_read(actor,employee) and method in ['readTime','readVacation','balance','totals','auditCount']: raise Refusal('Not allowed to read this employee')
    if method=='balance': return {'remaining':available(c,eid,integer(body.get('year',2026),'year',2000,2100))}
    if method=='totals':
        period=body.get('period','2026-11')
        row=c.execute('SELECT COALESCE(SUM(minutes),0) AS minutes FROM time_entries WHERE employee_id=? AND work_date LIKE ? AND '+('status IN (1,2)' if CONFIG.mutant=='wrong-total' else 'status=2'),(eid,period+'%')).fetchone()
        total=row['minutes']
        # Deliberate experiment faults: add contributions already represented by
        # the stored approved records. The unmutated path is the SQL sum above.
        if CONFIG.mutant in ['approval-double-count','correction-adds-old']:
            action='decideTime' if CONFIG.mutant=='approval-double-count' else 'correct'
            changes=c.execute("SELECT before_json,after_json FROM audit WHERE employee_id=? AND entity='time_entries' AND period=? AND action=?",(eid,period,action)).fetchall()
            for change in changes:
                value=json.loads(change['after_json'] if action=='decideTime' else change['before_json'])
                if value and value['status']==2: total+=value['minutes']
        return {'minutes':total}
    if method=='auditCount': return {'count':c.execute('SELECT COUNT(*) FROM audit WHERE employee_id=? AND period=?',(eid,body.get('period','2026-11'))).fetchone()[0]}
    table='time_entries' if method.endswith('Time') else 'vacations'
    rid=integer(body.get('record'),'record',1)
    if method in ['readTime','readVacation']: return get_record(c,table,rid,eid)
    before=None
    if method in ['logTime','requestVacation']:
        if actor['id']!=eid: raise Refusal('Employees submit only their own records')
        if c.execute(f'SELECT 1 FROM {table} WHERE id=?',(rid,)).fetchone(): raise Refusal('Reference number already exists')
        if method=='logTime':
            kind=integer(body.get('kind'),'kind',0,4); minutes=integer(body.get('minutes'),'minutes',15,720)
            if CONFIG.mutant=='cap-long-duration': minutes=min(minutes,719)
            status=2 if kind==0 or CONFIG.mutant=='auto-approve-special' else 1
            c.execute('INSERT INTO time_entries(id,employee_id,work_date,kind,minutes,status) VALUES (?,?,?,?,?,?)',(rid,eid,date(body.get('date')),kind,minutes,status))
            if CONFIG.mutant=='overwrite-earlier':
                prior=c.execute('SELECT id,minutes FROM time_entries WHERE employee_id=? AND work_date=? ORDER BY id',(eid,date(body.get('date')))).fetchall()
                if len(prior)>=3:
                    first=prior[0]
                    c.execute('UPDATE time_entries SET minutes=? WHERE id=?',(first['minutes']+15 if first['minutes']<=705 else first['minutes']-15,first['id']))
        else:
            days=integer(body.get('days'),'days',1,30); start=date(body.get('date'))
            c.execute('INSERT INTO vacations(id,employee_id,start_date,year,days,status) VALUES (?,?,?,?,?,1)',(rid,eid,start,int(start[:4]),days))
    else:
        before=get_record(c,table,rid,eid)
        if method in ['decideTime','decideVacation']:
            if not manager(actor,employee): raise Refusal('Only the assigned manager can decide')
            if before['status']!=1 and CONFIG.mutant!='repeat-decision': raise Refusal('Only pending records can be decided')
            approve=body.get('approve')
            if not isinstance(approve,bool): raise Invalid('approve must be Boolean')
            if method=='decideVacation' and approve and available(c,eid,before['year'])<before['days']: raise Refusal('Insufficient vacation balance')
            c.execute(f'UPDATE {table} SET status=?,version=version+1 WHERE id=?',(2 if approve else 3,rid))
        elif method=='takeVacation':
            if actor['id']!=eid or before['status']!=2 and not(CONFIG.mutant=='take-pending' and before['status']==1): raise Refusal('Vacation must be approved before it is taken')
            c.execute('UPDATE vacations SET status=4,version=version+1 WHERE id=?',(rid,))
        elif method in ['correctTime','correctVacation']:
            if not is_hr(actor,employee) and not(CONFIG.mutant=='employee-correction' and actor['id']==eid): raise Refusal('Only HR from this company can correct records')
            if not isinstance(body.get('reason'),str) or not body['reason'].strip(): raise Invalid('A correction reason is required')
            if method=='correctTime':
                kind=integer(body.get('kind'),'kind',0,4); minutes=integer(body.get('minutes'),'minutes',15,720); status=integer(body.get('status'),'status',1,3)
                c.execute('UPDATE time_entries SET kind=?,minutes=?,status=?,version=version+1 WHERE id=?',(kind,minutes,status,rid))
                if CONFIG.mutant=='cross-employee-correction':
                    c.execute('UPDATE time_entries SET minutes=? WHERE employee_id<>? AND work_date=?',(minutes,eid,before['work_date']))
            else:
                days=integer(body.get('days'),'days',1,30); status=integer(body.get('status'),'status',1,4)
                refunded=before['days'] if before['status'] in [2,4] else 0
                charge=days if status in [2,4] else 0
                if available(c,eid,before['year'])+refunded<charge: raise Refusal('Correction exceeds vacation allowance')
                c.execute('UPDATE vacations SET days=?,status=?,version=version+1 WHERE id=?',(days,status,rid))
        else: raise Invalid('Unknown operation')
    after=get_record(c,table,rid,eid)
    period=(after.get('work_date') or after['start_date'])[:7]
    audit(c,actor,eid,table,rid,'correct' if method.startswith('correct') else method,before,after,period,body.get('reason',''))
    return after

ROUTES={('POST','/api/time-entries'):'logTime',('POST','/api/vacations'):'requestVacation'}
class Handler(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def reply(self,code,obj):
        data=json.dumps(obj).encode();self.send_response(code);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def do_GET(self): self.handle_request('GET')
    def do_POST(self): self.handle_request('POST')
    def do_PATCH(self): self.handle_request('PATCH')
    def handle_request(self,verb):
        path=urlparse(self.path).path; query={k:v[0] for k,v in parse_qs(urlparse(self.path).query).items()}
        if not path.startswith('/api/'):
            rel='index.html' if path=='/' else path.lstrip('/')
            fp=(ROOT/'frontend'/rel).resolve()
            if not fp.is_relative_to((ROOT/'frontend').resolve()) or not fp.is_file(): self.reply(404,{'error':'Not found'});return
            data=fp.read_bytes();self.send_response(200);self.send_header('Content-Type','text/html' if fp.suffix=='.html' else 'text/javascript' if fp.suffix=='.js' else 'text/css');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data);return
        c=connect(CONFIG.db)
        try:
            length=int(self.headers.get('Content-Length','0'))
            if length>100000: raise Invalid('Request too large')
            body=json.loads(self.rfile.read(length)) if length else {}
            if not isinstance(body,dict): raise Invalid('JSON body must be an object')
            if verb=='GET' and path=='/api/health': self.reply(200,{'status':'ready','mutant':CONFIG.mutant});return
            if path=='/api/testing/reset' and verb=='POST':
                if not CONFIG.test_mode or self.headers.get('X-Test-Key')!=CONFIG.test_key: self.reply(403,{'error':'Test reset disabled'});return
                # Test fixtures are isolated in November; preserve the historical mock dataset.
                with c:
                    c.execute("DELETE FROM audit WHERE period='2026-11'");c.execute("DELETE FROM time_entries WHERE work_date LIKE '2026-11%'");c.execute("DELETE FROM vacations WHERE start_date LIKE '2026-11%'");c.execute('DELETE FROM sessions')
                self.reply(200,{'status':'reset'});return
            if path=='/api/login' and verb=='POST':
                who=person(c,integer(body.get('employee'),'employee'))
                if body.get('password')!=PASSWORD: self.reply(401,{'error':'Invalid credentials'});return
                token=secrets.token_hex(24)
                with c:c.execute('INSERT INTO sessions VALUES (?,?)',(token,who['id']))
                self.reply(200,{'token':token,'user':who});return
            row=c.execute('SELECT employee_id FROM sessions WHERE token=?',(self.headers.get('Authorization','').removeprefix('Bearer '),)).fetchone()
            if row is None:self.reply(401,{'error':'Sign in first'});return
            actor=person(c,row[0])
            if path=='/api/dashboard' and verb=='GET':
                employees=[dict(r) for r in c.execute('SELECT * FROM employees ORDER BY id') if can_read(actor,dict(r))]
                ids=[e['id'] for e in employees];marks=','.join('?' for _ in ids)
                stats={table:c.execute(f'SELECT COUNT(*) FROM {table} WHERE employee_id IN ({marks})',ids).fetchone()[0] for table in ['time_entries','vacations','audit']}
                target=int(query.get('employee',actor['id'])); emp=person(c,target)
                if not can_read(actor,emp):raise Refusal('Employee outside your scope')
                time=[dict(r) for r in c.execute('SELECT * FROM time_entries WHERE employee_id=? ORDER BY work_date DESC,id DESC LIMIT 80',(target,))]
                vac=[dict(r) for r in c.execute('SELECT * FROM vacations WHERE employee_id=? ORDER BY start_date DESC,id DESC LIMIT 40',(target,))]
                logs=[dict(r) for r in c.execute('SELECT * FROM audit WHERE employee_id=? ORDER BY id DESC LIMIT 30',(target,))]
                self.reply(200,{'user':actor,'employees':employees,'stats':stats,'time':time,'vacations':vac,'audit':logs,'remaining':available(c,target)});return
            method=ROUTES.get((verb,path)); body={**query,**body}
            # Resource endpoints expose IDs in paths; actor always comes from the session.
            parts=path.split('/')
            if len(parts) in (4,5) and parts[2] in ['time-entries','vacations']:
                body['record']=int(parts[3]);time=parts[2]=='time-entries'
                suffix=parts[4] if len(parts)==5 else ''
                if verb=='POST' and suffix=='decision': method='decideTime' if time else 'decideVacation'
                elif verb=='POST' and suffix=='take' and not time: method='takeVacation'
                elif not suffix and verb=='PATCH': method='correctTime' if time else 'correctVacation'
                elif not suffix and verb=='GET': method='readTime' if time else 'readVacation'
                else: method=None
            if len(parts)==5 and parts[2]=='employees' and verb=='GET':
                body['employee']=int(parts[3]);method={'balance':'balance','totals':'totals','audit-count':'auditCount'}.get(parts[4])
            if not method: self.reply(404,{'error':'Unknown endpoint'});return
            if isinstance(body.get('employee'),str):body['employee']=int(body['employee'])
            with c:
                c.execute('BEGIN IMMEDIATE')
                result=perform(c,actor,method,body)
            self.reply(200,{'status':'accepted','result':result})
        except Refusal as e:self.reply(409,{'status':'refused','reason':str(e)})
        except (Invalid,ValueError,TypeError,json.JSONDecodeError) as e:self.reply(400,{'error':str(e)})
        except sqlite3.IntegrityError as e:self.reply(409,{'status':'refused','reason':str(e)})
        except Exception as e:self.reply(500,{'error':type(e).__name__+': '+str(e)})
        finally:c.close()

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8765);p.add_argument('--db',default=str(ROOT/'data/hr.sqlite3'));p.add_argument('--seed',action='store_true');p.add_argument('--test-mode',action='store_true');p.add_argument('--test-key',default='local-experiment');p.add_argument('--mutant',choices=MUTANTS,default='none');CONFIG=p.parse_args()
    Path(CONFIG.db).parent.mkdir(parents=True,exist_ok=True)
    if CONFIG.seed or not Path(CONFIG.db).exists():seed(CONFIG.db)
    server=ThreadingHTTPServer(('127.0.0.1',CONFIG.port),Handler)
    print(f'HR SUT http://127.0.0.1:{CONFIG.port} | SQLite {CONFIG.db} | mutant={CONFIG.mutant}',flush=True);server.serve_forever()
