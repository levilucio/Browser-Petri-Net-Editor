/** @jest-environment node */
import { cacheModes, compareHmlAssignments } from '../../../tools/node/benchmarks/hml-cache-comparison.js';
import { createHmlRuleEffects } from '../../satel/core/HmlRuleEffects.js';
import { createHmlTerms } from '../../satel/core/HmlTerms.js';
import { buildHmlConstraints } from '../../satel/core/HmlConstraints.js';
import { compilePublicNet, enumerateMethodSuccessors } from '../../domain/apn/PublicMethods.js';
import { publicInterface } from '../../satel/core/TestCase.js';
import { parseSymbolicSource } from '../../satel/core/SymbolicSource.js';
import { evaluateGround } from '../../satel/core/SymbolicTerms.js';
import { builder } from '../../satel/examples/exercises/builder.js';
import { modal } from '../../satel/examples/nondeterminism/editor.js';

const algebra = parseSymbolicSource('');
const normalize = marking => Object.fromEntries(Object.entries(marking).sort().map(([id, tokens]) => [id, [...tokens].sort()]));

test.each(cacheModes)('$name: successor sets agree with concrete multiset firing across repeated and reordered inputs', ({ hmlCaches }) => {
  const b = builder(); b.place('bag', 'Int', [1, 1, 2]); b.place('gate', 'Int', [1]); b.place('out', 'Int', [7], true);
  b.rule('take', 'take', { n: 'Int' }, 'n == x', [['bag', 'x'], ['bag', 'x'], ['gate', 'x']], [['out', 'x'], ['gate', 'x']]);
  const stats = { bindingVisits: 0, guardEvaluations: 0, ruleRequests: 0 }, options = { hmlCaches, profileHmlCaches: true };
  const effects = createHmlRuleEffects(new Map(b.net.places.map(p => [p.id, p])), createHmlTerms(algebra, () => {}, stats, options), () => {}, stats, options);
  const plan = compilePublicNet(b.net).plans.take[0];
  for (const bag of [[1, 1, 2], [1, 1, 2], [2, 1, 1], [1, 2], [2, 2, 1], []]) {
    for (const gate of [[1], [2], []]) for (const n of [1, 2]) {
      // Also vary an unread/output marking: reusing effects must not restore an
      // old output bag or forget multiplicity.
      const marking = { bag, gate, out: [7, n, n] };
      const net = { ...b.net, places: b.net.places.map(p => ({ ...p, valueTokens: marking[p.id], tokens: marking[p.id].length })) };
      const actual = [];
      for (const event of effects(plan, { n }, marking)) {
        expect(evaluateGround(event.guardSafety)).toBe(true);
        if (!evaluateGround(event.enabled)) continue;
        expect(evaluateGround(event.outputSafety)).toBe(true);
        const next = Object.fromEntries(Object.entries(marking).map(([id, tokens]) => [id, tokens.filter((_, i) => !event.picks.some(p => p.place === id && p.index === i))]));
        for (const [id, values] of Object.entries(event.produced)) next[id].push(...values.map(v => evaluateGround(v)));
        actual.push(JSON.stringify([normalize(next), normalize(Object.fromEntries(Object.entries(event.produced).map(([id, values]) => [id, values.map(v => evaluateGround(v))])))]));
      }
      const concrete = enumerateMethodSuccessors(net, 'take', { n });
      expect(concrete.complete).toBe(true);
      const expected = concrete.successors.map(s => JSON.stringify([normalize(Object.fromEntries(s.next.places.map(p => [p.id, p.valueTokens]))), normalize(s.produced)]));
      expect([...new Set(actual)].sort()).toEqual([...new Set(expected)].sort());
    }
  }
  if (hmlCaches.ruleEffects === false) expect(stats.ruleCacheHits).toBe(0);
  if (hmlCaches.bindingPrefixes === false) expect(stats.bindingCacheHits).toBe(0);
  if (hmlCaches.expressions === false) expect(stats.expressionCacheHits).toBe(0);
  if (Object.values(hmlCaches).length === 5) expect(stats.cacheProfile.rules.keyCharacters).toBe(0);
});

test.each(cacheModes)('$name: errors, interruption and partial iteration cannot create accepted negative tests', async ({ hmlCaches }) => {
  for (const fault of ['guard', 'output']) {
    const b = builder(); b.place('bag', 'Int', [1]); b.place('out', 'Int', [], true);
    b.rule('bad', 'bad', {}, fault === 'guard' ? 'asInt(head([])) == 0' : 'true', [['bag', 'x']], [['out', fault === 'output' ? '2147483647 + 1' : 'x']]);
    const atom = modal('diamond', 'bad', null), formula = { op: 'and', children: [atom, { ...atom }] };
    for (const expectedTruth of [true, false]) {
      const built = await buildHmlConstraints(formula, b.net, publicInterface(b.net), {}, {}, algebra, { hmlCaches, expectedTruth });
      expect(built.conditions.every(c => evaluateGround(c) === true)).toBe(false);
      expect(built.stats.cacheProfile).toBeUndefined();
    }
    await expect(buildHmlConstraints(formula, b.net, publicInterface(b.net), {}, {}, algebra, { hmlCaches, maxHmlSelectionWork: 1 })).rejects.toMatchObject({ code: 'resource-limit' });
    const controller = new AbortController(); controller.abort();
    await expect(buildHmlConstraints(formula, b.net, publicInterface(b.net), {}, {}, algebra, { hmlCaches, signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
    const stats = { ruleRequests: 0, guardEvaluations: 0, bindingVisits: 0 };
    const effects = createHmlRuleEffects(new Map(b.net.places.map(p => [p.id, p])), createHmlTerms(algebra, () => {}, stats, { hmlCaches }), () => {}, stats, { hmlCaches });
    const run = () => effects(compilePublicNet(b.net).plans.bad[0], {}, { bag: [1], out: [] });
    const partial = run(); partial.next(); partial.return();
    expect(stats.ruleCacheHits).toBe(0);
    expect([...run()]).toHaveLength(1);
    expect(stats.ruleCacheHits).toBe(0);
  }
});

test('finite comparison covers observation complements, false guards, shared variables and empty inputs', async () => {
  const b = builder(); b.place('bag', 'Int', [1, 1, 2]); b.place('out', 'Int', [], true);
  b.rule('take', 'take', { n: 'Int' }, 'n > 0', [['bag', 'n'], ['bag', 'n']], [['out', 'n']]);
  const observation = modal('box', 'take', { out: ['$n'] }, { op: 'false' }, { n: '$n' });
  observation.excludeObservation = true;
  const formula = { op: 'and', children: [modal('diamond', 'take', { out: ['$n'] }, { op: 'true' }, { n: '$n' }), observation] };
  expect((await compareHmlAssignments({ net: b.net, formula, sorts: { n: 'Int' }, assignments: [0, 1, 2].map(n => ({ n })) })).concreteTruth).toEqual([false, true, false]);
  b.net.places[0].valueTokens = []; b.net.places[0].tokens = 0;
  expect((await compareHmlAssignments({ net: b.net, formula, sorts: { n: 'Int' }, assignments: [{ n: 1 }] })).concreteTruth).toEqual([false]);
});
