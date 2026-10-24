import fs from 'node:fs';
import { generateIntention } from '../../src/satel/core/IntentionPipeline.js';
import { createNondeterminismExample } from '../../src/satel/examples/nondeterminism/editor.js';
import { createHmlSelectionExample } from '../../src/satel/examples/hml-selection/editor.js';
import { runBlackBoxCampaign } from '../../src/satel/blackbox/Campaign.js';
import { createDemoSystem } from '../../src/satel/blackbox/DemoSystems.js';

const cases = [
  [createNondeterminismExample('nondeterminism-bag-reference'), 0, ['bag', 'bag-missing-duplicate', 'bag-wrong-output']],
  [createNondeterminismExample('nondeterminism-bag-reference'), 1, ['bag', 'bag-wrong-output']],
  [createNondeterminismExample('nondeterminism-branch-reference'), 0, ['branch', 'branch-early-choice']],
  [createHmlSelectionExample(), 0, ['jobs', 'jobs-missing-finish', 'jobs-wrong-receipt']],
];
const reports = [];
for (const [net, intentionIndex, systems] of cases) {
  const { suite } = await generateIntention(net.testIntentions[intentionIndex], net);
  for (const id of systems) {
    const report = await runBlackBoxCampaign({ suite, createSut: () => createDemoSystem(id), sutName: id, repetitions: 16 });
    reports.push({ intention: net.testIntentions[intentionIndex].name, ...report });
    console.log(`${id}: ${JSON.stringify(report.counts)}; property evidence ${JSON.stringify(report.evidenceCounts)}`);
    if (report.counts.error || report.counts.inconclusive) throw new Error(`Unexpected execution problem: ${id}`);
    if (['bag', 'branch', 'jobs'].includes(id) && report.counts.mismatch) throw new Error(`Reference implementation mismatch: ${id}`);
    if (!['bag', 'branch', 'jobs'].includes(id) && !report.counts.mismatch) throw new Error(`Expected fault not exercised: ${id}`);
  }
}
const out = process.argv[2];
if (out) fs.writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), reports }, null, 2) + '\n');
