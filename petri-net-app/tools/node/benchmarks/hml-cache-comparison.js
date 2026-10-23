import { buildHmlConstraints } from '../../../src/satel/core/HmlConstraints.js';
import { hmlCacheNames } from '../../../src/satel/core/HmlCacheDiagnostics.js';
import { evaluateFormula } from '../../../src/satel/core/HmlEvaluator.js';
import { instantiateFormula } from '../../../src/satel/core/HmlFormula.js';
import { publicInterface } from '../../../src/satel/core/TestCase.js';
import { parseSymbolicSource } from '../../../src/satel/core/SymbolicSource.js';
import { evaluateGround, substitute } from '../../../src/satel/core/SymbolicTerms.js';
import { valueToSymbolic } from '../../../src/utils/builtin-values.js';

export const cacheModes = [
  { name: 'all', hmlCaches: {} },
  ...hmlCacheNames.map(name => ({ name: `without-${name}`, hmlCaches: { [name]: false } })),
  { name: 'none', hmlCaches: Object.fromEntries(hmlCacheNames.map(name => [name, false])) }
];

/** Finite-domain differential check, deliberately independent of witness choice.
 * Resource exhaustion is an incomplete comparison, never agreement or false.
 * Does not claim an independent implementation of symbolic construction. */
export async function compareHmlAssignments({ net, formula, sorts, assignments, options = {} }) {
  const io = publicInterface(net), roots = Object.fromEntries(Object.keys(sorts).map(n => [n, { var: n }]));
  const expected = [];
  for (const values of assignments) {
    const result = await evaluateFormula(instantiateFormula(formula, values), net, io, options);
    if (result.value === null) throw new Error('Incomplete concrete comparison');
    expected.push(result.value);
  }
  const rows = [];
  for (const mode of cacheModes) {
    const stats = [];
    for (const expectedTruth of [true, false]) {
      const built = await buildHmlConstraints(formula, net, io, roots, sorts, parseSymbolicSource(''),
        { ...options, hmlCaches: mode.hmlCaches, expectedTruth });
      const actual = assignments.map(values => {
        const env = new Map(Object.entries(values).map(([n, v]) => [n, valueToSymbolic(v)]));
        return built.conditions.every(c => evaluateGround(substitute(c, env)) === true);
      });
      if (actual.some((value, i) => value !== (expected[i] === expectedTruth))) {
        throw new Error(`Cache/concrete mismatch: ${mode.name}, expectedTruth=${expectedTruth}, actual=${JSON.stringify(actual)}, concrete=${JSON.stringify(expected)}`);
      }
      stats.push({ expectedTruth, ...built.stats });
    }
    rows.push({ mode: mode.name, stats });
  }
  return { assignments, concreteTruth: expected, rows };
}
