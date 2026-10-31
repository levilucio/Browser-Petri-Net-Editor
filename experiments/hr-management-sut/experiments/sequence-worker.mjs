import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { root, editorImport } from './runtime.mjs';
import { sequenceFixture, selectionOptions, derivationOptions, entries, browserKinds } from './sequence-fixture.mjs';
import { auditDomains } from './depth-audit.mjs';
const { compileSymbolicIntention, encodeProtocolWitness } = await editorImport('src/satel/core/SymbolicSource.js');
const { deriveGenericSubdomains } = await editorImport('src/satel/core/GenericSubuniformity.js');
const { selectExecutableRepresentatives } = await editorImport('src/satel/core/ExecutableSequence.js');
const { admitIntention } = await editorImport('src/satel/core/Admission.js');
const { publicInterface } = await editorImport('src/satel/core/TestCase.js');
const { validateFormula, sequenceFormula } = await editorImport('src/satel/core/HmlFormula.js');
const { getContext } = await editorImport('src/utils/z3/context.js');
const config = JSON.parse(process.argv[2]), hash = x => createHash('sha256').update(JSON.stringify(x)).digest('hex');
mkdirSync(resolve(root, 'results'), { recursive: true });
const workerStarted = performance.now();
const row = { config, complete: false, runtime: { node: process.version, platform: process.platform, arch: process.arch }, phases: {}, rss: {} }, out = resolve(root, `results/sequence-trial-${config.length}-${config.trial}.json`);
const phase = async (name, task) => {
  const start = performance.now(), result = await task();
  row.phases[name] = performance.now() - start; row.rss[name] = process.memoryUsage().rss;
  writeFileSync(out, JSON.stringify(row, null, 2)); console.log(JSON.stringify({ length: config.length, trial: config.trial, phase: name, ms: row.phases[name] }));
  return result;
};
try {
  await phase('initialization', () => getContext());
  const { net, intention } = sequenceFixture(config.length), io = publicInterface(net);
  const { goal, protocol } = await phase('compilation', () => compileSymbolicIntention(intention));
  row.goalSha256 = hash(goal); row.markingSha256 = hash(net.places.map(p => [p.id, p.valueTokens]));
  row.model = { places: net.places.length, transitions: net.transitions.length, tokens: net.places.reduce((n, p) => n + p.tokens, 0) };
  const decomposition = await phase('derivation', () => deriveGenericSubdomains(goal, derivationOptions));
  row.algebra = { regions: decomposition.domains.length, unresolved: decomposition.unresolved, overlaps: decomposition.overlaps,
    signatureSha256: hash(decomposition.domains.map(d => ({ patterns: d.patterns, conditions: d.conditions, result: d.resultPattern, variables: d.variables }))),
    profile: decomposition.unfoldingProfile, coverage: decomposition.coverage };
  assert.equal(decomposition.domains.length, 25); assert.equal(decomposition.unresolved.length, 0); assert.equal(decomposition.overlaps.length, 0);
  const execution = await phase('selection', () => selectExecutableRepresentatives(goal, protocol, decomposition, net, io, selectionOptions));
  row.selection = { selected: execution.selected.length, unresolved: execution.unresolved, blocked: execution.blocked, visited: execution.visited, profile: execution.profile, maxSequencePairs: execution.maxSequencePairs };
  const candidates = await phase('encoding', () => execution.selected.map(d => ({ ...encodeProtocolWitness(protocol, d.witnessArgs, d.witnessResult, io, goal.algebra), id: `${intention.id}::${d.id}`, symbolicDomain: d })));
  const suite = await phase('admission', () => admitIntention({ symbolicGoal: goal, intention, interface: io, decomposition, execution, candidates }, net));
  assert.equal(suite.selectedTests.length, 25);
  row.validation = suite.validation;
  const tests = suite.selectedTests.map(t => {
    const data = entries(t.symbolicDomain.witnessArgs[0]), kinds = data.map(e => e[0]), minutes = data.map(e => e[1]);
    assert.equal(t.pairs.length, config.length);
    return { id: t.id, region: t.symbolicDomain.id, kinds, minutes, witnessArgs: t.symbolicDomain.witnessArgs, witnessResult: t.symbolicDomain.witnessResult,
      pairs: t.pairs, pairsSha256: hash(t.pairs), browser: browserKinds.some(k => JSON.stringify(k) === JSON.stringify(kinds)) };
  });
  row.finiteAudit = await phase('finiteAudit', () => auditDomains(execution.selected, 2));
  assert(row.finiteAudit.partitionAndWitnessChecksPass && row.finiteAudit.finiteCoverageComplete);
  if (config.trial === 1) {
    const limited = await selectExecutableRepresentatives(goal, protocol, decomposition, net, io, { ...selectionOptions, maxSequenceBranches: 1 });
    assert.equal(limited.selected.length, 0); assert.equal(limited.blocked.length, 0); assert.equal(limited.unresolved.length, 25);
    row.searchBudgetProbe = { selected: 0, blocked: 0, unresolved: 25, codes: [...new Set(limited.unresolved.map(x => x.diagnostic.code))] };
    if (config.length > 32) {
      const defaults = await selectExecutableRepresentatives(goal, protocol, decomposition, net, io, { ...selectionOptions, maxSequencePairs: 32 });
      assert.equal(defaults.selected.length, 0); assert.equal(defaults.unresolved.length, 25); assert.equal(defaults.blocked.length, 0);
      row.defaultLengthProbe = { selected: 0, blocked: 0, unresolved: 25, codes: [...new Set(defaults.unresolved.map(x => x.diagnostic.code))] };
    }
    try { validateFormula(sequenceFormula(tests[0].pairs)); row.explicitHmlValidation = { status: 'accepted' }; }
    catch (error) { row.explicitHmlValidation = { status: 'rejected', reason: error.message }; }
  }
  const frozen = { length: config.length, referenceNet: net, interface: io, intention, tests };
  row.tests = tests.map(({ pairs, ...metadata }) => metadata);
  row.suiteSha256 = hash(frozen); row.peakRss = process.resourceUsage().maxRSS * 1024; row.workerMs = performance.now() - workerStarted;
  row.complete = true;
  writeFileSync(resolve(root, `results/sequence-suite-${config.length}-trial-${config.trial}.json`), JSON.stringify(frozen));
  writeFileSync(out, JSON.stringify(row, null, 2)); console.log(JSON.stringify({ complete: true, length: config.length, trial: config.trial, phases: row.phases }));
} catch (error) {
  row.error = { message: error.message, code: error.code }; row.peakRss = process.resourceUsage().maxRSS * 1024;
  writeFileSync(out, JSON.stringify(row, null, 2)); console.error(error); process.exit(1);
}
process.exit();
