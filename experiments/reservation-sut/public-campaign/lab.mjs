// Lab provisioning is outside the tester. The trial function receives only the public URL.
import {createServer, request} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync, rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {root} from '../experiments/runtime.mjs';

export async function withInstance(variant, execute) {
  const directory = mkdtempSync(resolve(tmpdir(), 'public-reservation-'));
  const port = Number(process.env.RESERVATION_BACKEND_PORT || 8906);
  const params = [resolve(root, 'backend/app.py'), '--port', String(port), '--db', resolve(directory, 'app.sqlite3')];
  if (variant !== 'none') params.push('--test-mode', '--variant', variant);
  const backend = spawn(process.env.PYTHON || 'python', params, {stdio: ['ignore', 'pipe', 'pipe']});
  const exit = once(backend, 'close');
  let startupError = '';
  backend.stderr.on('data', d => startupError += d);
  const audit = {methods: [], denied: []};
  const gateway = createServer((incoming, outgoing) => {
    const asset = incoming.method === 'GET' && ['/', '/style.css', '/app.js', '/favicon.ico'].includes(incoming.url);
    const business = incoming.method === 'POST' && /^\/api\/reservation\/(open|allocate|reserve|finish)$/.test(incoming.url);
    if ((!asset && !business) || 'x-choice' in incoming.headers || 'x-test-key' in incoming.headers) {
      audit.denied.push([incoming.method, incoming.url]);
      outgoing.writeHead(403).end();
      return;
    }
    if (business) audit.methods.push(incoming.url.split('/').at(-1));
    const upstream = request({hostname: '127.0.0.1', port, path: incoming.url, method: incoming.method,
      headers: {'Content-Type': 'application/json', 'Content-Length': incoming.headers['content-length'] || 0}}, response => {
      outgoing.writeHead(response.statusCode, response.headers);
      response.pipe(outgoing);
    });
    upstream.on('error', () => outgoing.writeHead(502).end());
    incoming.pipe(upstream);
  });
  try {
    let timer;
    try {
      const ready = once(backend.stdout, 'data').then(([chunk]) => {
        if (!chunk.toString().includes('Reservation SUT ready')) throw Error('Unexpected startup response');
      });
      await Promise.race([ready, exit.then(() => {throw Error(startupError || 'Backend exited');}),
        new Promise((_, reject) => {timer = setTimeout(() => reject(Error('Startup timeout')), 10000);})]);
    } finally {clearTimeout(timer);}
    gateway.listen(0, '127.0.0.1');
    await once(gateway, 'listening');
    return await execute('http://127.0.0.1:' + gateway.address().port, audit);
  } finally {
    if (gateway.listening) {
      const closed = once(gateway, 'close');
      gateway.close(); gateway.closeAllConnections(); await closed;
    }
    if (backend.exitCode === null) backend.kill();
    await exit;
    rmSync(directory, {recursive: true, force: true});
  }
}
