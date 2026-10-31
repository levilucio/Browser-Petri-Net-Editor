// Execute one adaptive trial against an already available, unopened reservation.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root, playwright} from '../experiments/runtime.mjs';
import {trial} from './trial.mjs';

const [url, kind = 'automatic', transport = 'api'] = process.argv.slice(2);
if (!url || !['automatic', 'manual-a', 'manual-b'].includes(kind) || !['api', 'ui'].includes(transport)) {
  throw Error('Usage: node public-campaign/live.mjs PUBLIC_URL [automatic|manual-a|manual-b] [api|ui]');
}
const corpus = JSON.parse(readFileSync(resolve(root, 'results/corpus.json')));
let browser;
try {
  if (transport === 'ui') {
    const pw = await playwright();
    browser = await pw.chromium.launch({headless: true, executablePath: process.env.SATEL_CHROMIUM || undefined});
  }
  const result = await trial(corpus, kind, url.replace(/\/$/, ''), browser ? await browser.newPage() : null);
  console.log(JSON.stringify(result, null, 2));
  if (result.verdict !== 'compatible') process.exitCode = 1;
} finally {
  await browser?.close();
}
