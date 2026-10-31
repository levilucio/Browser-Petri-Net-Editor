import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {root, editorImport} from './runtime.mjs';
import {reference} from './model.mjs';
const {generateIntention} = await editorImport('src/satel/core/IntentionPipeline.js');
const {publicInterface} = await editorImport('src/satel/core/TestCase.js');
const {serializeMethodGateSource, parseMethodGateSource} = await editorImport('src/domain/apn/MethodGateSyntax.js');
const net = reference(), selectedTests = [], admission = [];
for (const intention of net.testIntentions) {
  const {suite} = await generateIntention(intention, net);
  assert.equal(suite.selectedTests.length, 1);
  selectedTests.push(...suite.selectedTests);
  admission.push({id: intention.id, tests: suite.selectedTests.length, validation: suite.validation});
}
const source = serializeMethodGateSource(net);
// Verify the exported concrete syntax is accepted by the editor parser.
if (typeof parseMethodGateSource === 'function') parseMethodGateSource(source);
writeFileSync(resolve(root, 'specification/reservation.apn.json'), JSON.stringify(net, null, 2) + '\n');
writeFileSync(resolve(root, 'specification/reservation.copn'), source);
writeFileSync(resolve(root, 'results/corpus.json'), JSON.stringify({referenceNet: net, interface: publicInterface(net), selectedTests, admission}, null, 2) + '\n');
console.log(JSON.stringify({properties: selectedTests.length, transitions: net.transitions.length, admission}));
