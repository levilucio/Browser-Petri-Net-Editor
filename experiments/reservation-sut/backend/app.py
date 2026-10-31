"""Independent local research SUT. No SATEL/APN imports.

All persistent/evolving application state is in SQLite. Entropy is an external
binary input: production uses OS randomness; experiments may seed or override it.
The single-threaded server completes one request before serving the next.
"""
import argparse
import hashlib
import json
from pathlib import Path
import secrets
import sqlite3
from http.server import BaseHTTPRequestHandler, HTTPServer

VARIANTS = ('none', 'illegal-output', 'missing-b', 'early-commitment', 'bad-b-receipt')
FRONTEND = Path(__file__).resolve().parents[1] / 'frontend'


class Refusal(Exception):
    pass


class Store:
    def __init__(self, path, variant='none'):
        if variant not in VARIANTS:
            raise ValueError('Unknown variant')
        self.db = sqlite3.connect(path)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA foreign_keys=ON')
        self.variant = variant
        self.checkpoints = {}
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS warehouses(id INTEGER PRIMARY KEY, name TEXT NOT NULL);
            CREATE TABLE IF NOT EXISTS reservations(
                id INTEGER PRIMARY KEY, state TEXT NOT NULL,
                warehouse INTEGER REFERENCES warehouses(id), commitment INTEGER REFERENCES warehouses(id));
            CREATE TABLE IF NOT EXISTS entropy(id INTEGER PRIMARY KEY CHECK(id=1), seed INTEGER, counter INTEGER NOT NULL);
        ''')
        if not self.db.execute('SELECT 1 FROM entropy').fetchone():
            self.reset()

    def close(self):
        self.clear_checkpoints()
        self.db.close()

    def clear_checkpoints(self):
        for db in self.checkpoints.values():
            db.close()
        self.checkpoints.clear()

    def reset(self, seed=None):
        if seed is not None and (type(seed) is not int or not 0 <= seed <= 0xffffffff):
            raise ValueError('Seed must be an unsigned 32-bit integer')
        self.clear_checkpoints()
        with self.db:
            self.db.execute('DELETE FROM reservations')
            self.db.execute('DELETE FROM warehouses')
            self.db.executemany('INSERT INTO warehouses VALUES (?,?)', [(1, 'North · A'), (2, 'South · B')])
            self.db.executemany('INSERT INTO reservations VALUES (?,?,?,NULL)',
                                [(i, 'finished', 1 + i % 2) for i in range(100, 150)])
            self.db.execute("INSERT INTO reservations VALUES (1,'idle',NULL,NULL)")
            self.db.execute('DELETE FROM entropy')
            self.db.execute('INSERT INTO entropy VALUES (1,?,0)', (seed,))

    def digest(self):
        # Instrumentation identity only; never an expected public observation.
        return hashlib.sha256('\n'.join(self.db.iterdump()).encode()).hexdigest()

    def checkpoint(self):
        if len(self.checkpoints) >= 1024:
            raise ValueError('Checkpoint budget exceeded')
        token = secrets.token_hex(16)
        clone = sqlite3.connect(':memory:')
        self.db.backup(clone)
        self.checkpoints[token] = clone
        return {'checkpoint': token, 'digest': self.digest()}

    def restore(self, token):
        if token not in self.checkpoints:
            raise ValueError('Unknown checkpoint')
        self.checkpoints[token].backup(self.db)
        return {'digest': self.digest()}

    def invoke(self, method, args, forced=None):
        signatures = {'open': set(), 'allocate': set(), 'reserve': {'warehouse'}, 'finish': set()}
        if method not in signatures or not isinstance(args, dict) or set(args) != signatures[method]:
            raise ValueError('Invalid method/arguments')
        if forced is not None and (type(forced) is not int or forced not in (0, 1)):
            raise ValueError('Choice selector must be 0 or 1')
        if method == 'reserve' and (type(args['warehouse']) is not int or args['warehouse'] not in (1, 2)):
            raise ValueError('Warehouse must be 1 or 2')
        used = 0

        def choose():
            nonlocal used
            used += 1
            if used > 1:
                raise RuntimeError('Declared one-binary-choice contract violated')
            e = self.db.execute('SELECT seed,counter FROM entropy').fetchone()
            value = (secrets.randbits(1) if e['seed'] is None else
                     hashlib.sha256(f"{e['seed']}:{e['counter']}".encode()).digest()[0] & 1)
            self.db.execute('UPDATE entropy SET counter=counter+1')
            return value if forced is None else forced

        try:
            with self.db:
                r = self.db.execute('SELECT * FROM reservations WHERE id=1').fetchone()
                if method == 'open':
                    if r['state'] != 'idle':
                        raise Refusal('Reservation already opened')
                    commit = 1 + choose() if self.variant == 'early-commitment' else None
                    self.db.execute("UPDATE reservations SET state='ready',commitment=? WHERE id=1", (commit,))
                    result = {'ready': True}
                elif method in ('allocate', 'reserve'):
                    if r['state'] != 'ready':
                        raise Refusal('Reservation is not ready')
                    if method == 'reserve':
                        warehouse = args['warehouse']
                        if r['commitment'] is not None and r['commitment'] != warehouse:
                            raise Refusal('Warehouse not available for this reservation')
                    else:
                        warehouse = r['commitment'] or (1 if self.variant == 'missing-b' else 1 + choose())
                    self.db.execute("UPDATE reservations SET state='reserved',warehouse=? WHERE id=1", (warehouse,))
                    output = 99 if self.variant == 'illegal-output' and method == 'allocate' and warehouse == 2 else warehouse
                    result = {'allocated': output}
                else:
                    if r['state'] != 'reserved':
                        raise Refusal('Nothing reserved')
                    self.db.execute("UPDATE reservations SET state='finished' WHERE id=1")
                    result = {'receipt': 99 if self.variant == 'bad-b-receipt' and r['warehouse'] == 2 else r['warehouse']}
            return {'status': 'accepted', 'result': result}
        except Refusal as error:
            return {'status': 'refused', 'reason': str(error)}


def serve(path, port, test_mode=False, variant='none'):
    if variant != 'none' and not test_mode:
        raise ValueError('Mutants require test mode')
    store = Store(path, variant)
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def send_json(self, data, status=200):
            raw = json.dumps(data).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self):
            if self.path == '/api/health':
                return self.send_json({'ok': True, 'testMode': test_mode,
                                       **({'variant': variant, 'binaryChoicesPerCall': 1} if test_mode else {})})
            name = {'/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css'}.get(self.path)
            if name is None:
                return self.send_json({'error': 'Not found'}, 404)
            raw = (FRONTEND / name).read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', {'html': 'text/html; charset=utf-8', 'js': 'text/javascript', 'css': 'text/css'}[name.split('.')[-1]])
            self.send_header('Content-Length', str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_POST(self):
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if size > 16384:
                    raise ValueError('Request too large')
                body = json.loads(self.rfile.read(size) or b'{}')
                authorized = test_mode and self.headers.get('X-Test-Key') == 'local-experiment'
                if self.path.startswith('/api/testing/'):
                    if not authorized:
                        return self.send_json({'error': 'Testing API unavailable'}, 403)
                    action = self.path.rsplit('/', 1)[-1]
                    if action == 'reset':
                        store.reset(body.get('seed'))
                        return self.send_json({'ok': True})
                    if action == 'checkpoint':
                        return self.send_json(store.checkpoint())
                    if action == 'restore':
                        return self.send_json(store.restore(body.get('checkpoint')))
                    return self.send_json({'error': 'Not found'}, 404)
                if not self.path.startswith('/api/reservation/'):
                    return self.send_json({'error': 'Not found'}, 404)
                selector = self.headers.get('X-Choice')
                if selector is not None and not authorized:
                    return self.send_json({'error': 'Choice control unavailable'}, 403)
                answer = store.invoke(self.path.rsplit('/', 1)[-1], body,
                                      int(selector) if selector is not None else None)
                self.send_json(answer, 409 if answer['status'] == 'refused' else 200)
            except (ValueError, TypeError, json.JSONDecodeError) as error:
                self.send_json({'error': str(error)}, 400)
            except Exception as error:
                self.send_json({'error': type(error).__name__ + ': ' + str(error)}, 500)

    server = HTTPServer(('127.0.0.1', port), Handler)
    print(f'Reservation SUT ready {port}', flush=True)
    try:
        server.serve_forever()
    finally:
        server.server_close()
        store.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--db', default='reservation.sqlite3')
    parser.add_argument('--port', type=int, default=8891)
    parser.add_argument('--test-mode', action='store_true')
    parser.add_argument('--variant', choices=VARIANTS, default='none')
    args = parser.parse_args()
    serve(args.db, args.port, args.test_mode, args.variant)
