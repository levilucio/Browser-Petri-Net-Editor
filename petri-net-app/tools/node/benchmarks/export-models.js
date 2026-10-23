#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { fulfilment, workerService, allocationService } from '../../../src/satel/examples/scale/models.js';
import { generatePNML } from '../../../src/utils/pnml/writer.js';
const directory = resolve(process.argv[2] || '../docs/satel/performance/models');
mkdirSync(directory, { recursive: true });
const dom = new JSDOM(); globalThis.document = dom.window.document; globalThis.XMLSerializer = dom.window.XMLSerializer;
const entries = [
  ['allocation-8-resources', allocationService, { size: 8 }],
  ['allocation-32-resources', allocationService, { size: 32 }],
  ['fulfilment-4-sites', fulfilment, { sites: 4, policies: 8, cycles: 4 }],
  ['fulfilment-16-sites', fulfilment, { sites: 16, policies: 8, cycles: 4 }],
  ['fulfilment-128-sites', fulfilment, { sites: 128, policies: 8, cycles: 4 }],
  ['workers-audit-small', workerService, { workers: 2, rounds: 2, audit: true }],
  ['workers-merged-large', workerService, { workers: 8, rounds: 8, audit: false }],
  ['workers-audit-stress', workerService, { workers: 4, rounds: 4, audit: true }],
];
const index = [];
for (const [id, build, config] of entries) {
  const mutations = build === fulfilment ? ['missing-dispatch', 'wrong-receipt', 'stock-leak'] : build === allocationService ? ['missing-confirmation', 'wrong-allocation'] : ['missing-worker', 'wrong-receipt'];
  for (const mutant of [null, ...mutations]) {
    const net = build({ ...config, mutant }), filename = `${id}-${mutant || 'reference'}.pnml`, xml = generatePNML(net);
    writeFileSync(resolve(directory, filename), xml);
    index.push({ filename, config, mutant, places: net.places.length, transitions: net.transitions.length, arcs: net.arcs.length, bytes: Buffer.byteLength(xml), note: mutant === 'stock-leak' ? 'Expected survivor: current public observations do not inspect remaining inventory.' : 'Large/stress references may exhaust default budgets; a limit is not a failed test.' });
  }
}
writeFileSync(resolve(directory, 'index.json'), JSON.stringify(index, null, 2) + '\n');
const guide = [
  '# Loadable scalability models', '',
  'Open a reference using the app’s Load action, then SATEL → Intentions / Generated tests. Generate on the reference before loading a matching mutant and replaying the frozen suite. Large/stress examples may exhaust generation limits. See [the experiment report](../../increment-20-scalability.md) for measured limits and model assumptions.', '',
  '| Reference | Places / rules | Matching mutants |', '|---|---:|---|',
];
for (const [id] of entries) {
  const reference = index.find(r => r.filename === `${id}-reference.pnml`);
  const mutants = index.filter(r => r.filename.startsWith(`${id}-`) && r.mutant);
  guide.push(`| [${id}](${reference.filename}) | ${reference.places} / ${reference.transitions} | ${mutants.map(r => `[${r.mutant}](${r.filename})`).join(', ')} |`);
}
guide.push('', 'The stock-leak mutant is an expected survivor of the current bounded public observations; this exposes a coverage gap. Custom invoice/List/Tree ADT analysis workloads are defined in `tools/node/benchmarks/solver-cases.js`, separately from these executable built-in-sort APNs.', '');
guide.push('## Inventory reservations', '', '[Inventory examples and mutants](inventory/README.md) provide 5-, 10- and 20-pair intentions with branching recovery requirements: three references and twelve mutants.', 'Their PNML files include the intentions. Regenerate them from `petri-net-app` with `node tools/node/benchmarks/export-inventory.js`.', '');
writeFileSync(resolve(directory, 'README.md'), guide.join('\n'));
console.log(`Exported ${index.length} loadable PNML models to ${directory}`); dom.window.close();
