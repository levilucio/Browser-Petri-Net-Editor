import { createExerciseExample } from '../exercises/editor.js';

export const refusalExamples = [
  { filename: 'refusal-quota-reference', displayName: 'SATEL Refusal — Quota reference', description: 'Reserve three resources, then reject a zero release.' },
  { filename: 'refusal-quota-mutant', displayName: 'SATEL Refusal — Quota mutant: accepts zero', description: 'The release guard incorrectly admits a zero amount.' },
  { filename: 'refusal-thermostat-reference', displayName: 'SATEL Refusal — Thermostat reference', description: 'Adjust and read, then reject an adjustment outside the permitted range.' },
  { filename: 'refusal-thermostat-mutant', displayName: 'SATEL Refusal — Thermostat mutant: missing upper bound', description: 'The warm rule accepts adjustments larger than five.' },
];
export function createRefusalExample(filename) {
  const entry = refusalExamples.find(e => e.filename === filename);
  if (!entry) throw new Error('Unknown refusal example');
  const quota = filename.includes('quota'), mutant = filename.endsWith('mutant');
  const net = createExerciseExample(`exercise-${quota ? 'quota' : 'thermostat'}-reference`);
  const intention = quota ? {
    id: 'refusal-quota', name: 'Reserve then refuse zero release', kind: 'symbolic', symbolic: {
      source: 'operation identity(Nat): Nat\nrule identity.def(n: Nat): identity(n) = n', operation: 'identity', variablesText: 'n: Nat', argsText: 'n', conditionsText: 'n == 0', maxDepth: 1,
      protocolSource: 'case zero(n: Nat):\ninputs n\nresult n\npair reserve(n=3) => eligible(true)\npair audit() => free(7), reserved(3)\npair release(n=n) => refused'
    }
  } : {
    id: 'refusal-thermostat', name: 'Adjust, read, then refuse an excessive adjustment', kind: 'symbolic', symbolic: {
      source: 'operation direction(Int): Bool\nrule low(d: Int): direction(d) = false if d < 0\nrule high(d: Int): direction(d) = true if d >= 0', operation: 'direction', variablesText: 'd: Int', argsText: 'd', conditionsText: 'd >= -6 and d <= 6', maxDepth: 2,
      protocolSource: 'case outside(d: Int, sign: Bool):\ninputs d\nresult sign\npair adjust(delta=1) => band(1)\npair read() => reading(21)\npair adjust(delta=d) => refused'
    }
  };
  // Retain the original positive intention unchanged alongside the refusal exercise.
  net.testIntentions.unshift(intention);
  if (mutant) net.transitions.find(t => t.id === (quota ? 'release' : 'warm')).guard = quota ? 'n >= 0 and n <= h' : 'delta > 0 and delta >= -5';
  net.satelExample = { id: filename, name: entry.displayName, role: mutant ? 'mutant' : 'reference', description: entry.description };
  return net;
}
