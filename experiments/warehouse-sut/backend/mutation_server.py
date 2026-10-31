"""Opt-in local mutation runner. Baseline app.py remains the normal entry point."""
import argparse,threading
from pathlib import Path
from http.server import ThreadingHTTPServer
import app
from mutations import MUTANTS,install
p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8884);p.add_argument('--db',required=True);p.add_argument('--mutant',choices=MUTANTS,required=True);p.add_argument('--test-mode',action='store_true');p.add_argument('--test-key',default='local-experiment');cfg=p.parse_args()
if not cfg.test_mode:p.error('Mutation experiments require explicit --test-mode')
if Path(cfg.db).exists():p.error('Use a new temporary DB for each mutation server')
app.CONFIG=cfg;app.LOCK=threading.RLock();Path(cfg.db).parent.mkdir(parents=True,exist_ok=True);app.seed(cfg.db);install(app,cfg.mutant)
class Handler(app.Handler):
    def reply(self,status,data):
        if data.get('application')=='warehouse-sut':data={**data,'mutant':cfg.mutant}
        super().reply(status,data)
server=ThreadingHTTPServer(('127.0.0.1',cfg.port),Handler);print(f'Warehouse mutation {cfg.mutant} http://127.0.0.1:{cfg.port}',flush=True);server.serve_forever()
