import importlib.util, json, tempfile, threading, types, unittest, urllib.request, urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
spec=importlib.util.spec_from_file_location('hr_http',Path(__file__).resolve().parents[1]/'backend/app.py');app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)
class HttpTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();path=Path(self.tmp.name)/'db.sqlite3';app.seed(path);app.CONFIG=types.SimpleNamespace(db=str(path),mutant='none',test_mode=False,test_key='unused');self.server=app.ThreadingHTTPServer(('127.0.0.1',0),app.Handler);self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start();self.base=f'http://127.0.0.1:{self.server.server_address[1]}'
 def tearDown(self):self.server.shutdown();self.server.server_close();self.thread.join();self.tmp.cleanup()
 def request(self,path,body=None,token=None,verb=None):
  req=urllib.request.Request(self.base+path,json.dumps(body).encode() if body is not None else None,{'Content-Type':'application/json',**({'Authorization':'Bearer '+token}if token else{})},method=verb or('POST' if body is not None else 'GET'))
  try:r=urllib.request.urlopen(req)
  except urllib.error.HTTPError as e:r=e
  return r.status,json.load(r)
 def login(self,e):return self.request('/api/login',{'employee':e,'password':'research-demo'})[1]['token']
 def test_authentication_and_actor_spoofing(self):
  self.assertEqual(self.request('/api/dashboard')[0],401)
  employee=self.login(1001);self.request('/api/time-entries',{'employee':1001,'record':9000001,'date':'2026-11-01','kind':2,'minutes':60},employee)
  status,result=self.request('/api/time-entries/9000001/decision',{'employee':1001,'actor':101,'approve':True},employee)
  self.assertEqual(status,409);self.assertEqual(result['status'],'refused')
 def test_invalid_route_shape_and_reset_disabled(self):
  token=self.login(1001)
  self.assertEqual(self.request('/api/time-entries/1/take',{'employee':1001},token)[0],404)
  self.assertEqual(self.request('/api/time-entries/1/extra/segments?employee=1001',token=token)[0],404)
  self.assertEqual(self.request('/api/login',[])[0],400)
  self.assertEqual(self.request('/api/testing/reset',{})[0],403)
 def test_concurrent_approvals_cannot_overdraw_allowance(self):
  employee=self.login(1001);manager=self.login(101)
  for rid in [9000001,9000002]:self.request('/api/vacations',{'employee':1001,'record':rid,'date':'2026-11-01','days':20},employee)
  with ThreadPoolExecutor(2)as pool:
   replies=list(pool.map(lambda rid:self.request(f'/api/vacations/{rid}/decision',{'employee':1001,'approve':True},manager),[9000001,9000002]))
  self.assertEqual(sorted(code for code,_ in replies),[200,409])
  self.assertEqual(self.request('/api/employees/1001/balance',token=employee)[1]['result']['remaining'],10)
if __name__=='__main__':unittest.main()
