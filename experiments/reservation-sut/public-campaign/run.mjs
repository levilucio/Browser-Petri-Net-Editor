import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, mkdirSync, copyFileSync, cpSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import {resolve, join} from 'node:path';
import {root, playwright, editorRoot} from '../experiments/runtime.mjs';
import {withInstance} from './lab.mjs';
import {trial} from './trial.mjs';
const stage = process.argv[2];
if (!stage) throw Error('Usage: node public-campaign/run.mjs NEW_OUTPUT_DIRECTORY');
mkdirSync(stage); // Never replace a prior run.
const corpus = JSON.parse(readFileSync(join(root, 'results/corpus.json')));
const sources = ['backend/app.py','frontend/app.js','frontend/index.html','frontend/style.css',
  'experiments/adapters.mjs','experiments/runtime.mjs','results/corpus.json',...['PROTOCOL.md','lab.mjs','trial.mjs','run.mjs','summary.mjs'].map(x=>'public-campaign/'+x)];
const sha = data => createHash('sha256').update(data).digest('hex');
const hashes = Object.fromEntries(sources.map(p => [p, sha(readFileSync(resolve(root,p)))]));
const engine = resolve(editorRoot, 'src/satel/blackbox/Campaign.js');
hashes['editor/Campaign.js'] = sha(readFileSync(engine));
writeFileSync(join(stage,'manifest.json'),JSON.stringify({hashes,node:process.version,python:process.env.PYTHON || 'python',corpusParent:'0303fed6cf70d05a900d1eca876b3dc29355da25'},null,2)+'\n');
const pw = await playwright();
const browser = await pw.chromium.launch({headless:true, executablePath:process.env.SATEL_CHROMIUM || undefined, args:['--no-sandbox','--disable-dev-shm-usage']});
try {
  for (const variant of ['none','illegal-output','missing-b','early-commitment','bad-b-receipt']) {
    for (const transport of ['api','ui']) {
      const page = transport === 'ui' ? await browser.newPage() : null;
      const rows = [];
      for (let i=0; i<48; i++) {
        // Distribute eight trials of each manual request throughout the schedule.
        const kind = ['automatic','automatic','manual-a','automatic','automatic','manual-b'][i % 6];
        const row = await withInstance(variant, async (url, audit) => {
          const r = await trial(corpus,kind,url,page);
          return {...r,audit};
        });
        rows.push(row);
        if (variant === 'none' && (row.verdict !== 'compatible' || Object.values(row.hml).includes('counterexample'))) {
          const evidence = join(stage,'baseline-discrepancy');
          mkdirSync(evidence);
          cpSync(join(root,'backend'), join(evidence,'backend'), {recursive:true});
          cpSync(join(root,'frontend'), join(evidence,'frontend'), {recursive:true});
          cpSync(join(root,'public-campaign'),join(evidence,'public-campaign'),{recursive:true});
          copyFileSync(engine,join(evidence,'Campaign.js'));
          copyFileSync(join(root,'results/corpus.json'),join(evidence,'corpus.json'));
          writeFileSync(join(evidence,'trace.json'),JSON.stringify({transport,variant,rows},null,2));
          throw Error('Unexpected baseline evidence saved at ' + evidence);
        }
        assert.equal(row.audit.denied.length,0);
        assert.deepEqual(row.audit.methods,row.events.map(e=>e.stimulation.method));
        assert(['compatible','mismatch'].includes(row.verdict),row.reason);
      }
      await page?.close();
      writeFileSync(join(stage,variant+'-'+transport+'.json.gz'), gzipSync(JSON.stringify({variant,transport,browser:page?browser.version():null,rows})));
      console.log(variant, transport, rows.length, 'trials complete');
    }
  }
} finally { await browser.close(); }
