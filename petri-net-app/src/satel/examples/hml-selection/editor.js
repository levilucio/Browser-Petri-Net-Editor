import { builder } from '../exercises/builder.js';
import { modal } from '../nondeterminism/editor.js';

export const hmlSelectionExamples = [
  ['reference', 'Reference', 'Both open outcomes can finish only when the shared amount is at least 3. Sequence-only selection picks 1.'],
  ['missing-finish', 'Mutant: missing finish', 'The second open outcome can never finish.'],
  ['wrong-receipt', 'Mutant: wrong receipt', 'Finishing produces 99 instead of 0.'],
].map(([id, label, description]) => ({ filename: `hml-selection-${id}`, displayName: `SATEL HML selection — ${label}`, description }));

export function createHmlSelectionExample(filename = 'hml-selection-reference') {
  const entry = hmlSelectionExamples.find(e => e.filename === filename);
  if (!entry) throw new Error('Unknown HML selection example');
  const b = builder();
  b.place('state', 'Int', [0]); b.place('amount', 'Nat', [0]); b.place('reply', 'Nat', [], true);
  for (const [id, state] of [['openA', 1], ['openB', 2]]) b.rule(id, 'open', { n: 'Nat' }, 's == 0', [['state', 's'], ['amount', 'old']], [['state', String(state)], ['amount', 'n'], ['reply', 'n']]);
  b.rule('finish', 'finish', {}, filename.endsWith('missing-finish') ? 's == 1' : 's == 1 or (s == 2 and a >= 3)', [['state', 's'], ['amount', 'a']], [['state', '3'], ['amount', 'a'], ['reply', filename.endsWith('wrong-receipt') ? '99' : '0']]);
  const finish = modal('diamond', 'finish', { reply: [0] });
  const base = {
    kind: 'symbolic',
    symbolic: {
      source: 'operation positive(Nat): Bool\nrule positive.case(n: Nat): positive(n) = true if n > 0',
      operation: 'positive', variablesText: 'n: Nat', argsText: 'n', conditionsText: 'n > 0 and n <= 5', maxDepth: 2,
      protocolSource: 'case open(n: Nat):\ninputs n\nresult true\npair open(n=n) => reply(n)',
    },
  };
  b.net.testIntentions = [
    { ...base, id: 'hml-select-progress', name: 'Choose an amount allowing every open outcome to finish', branchingProperty: modal('box', 'open', null, finish, { n: '$n' }) },
    { ...base, id: 'hml-select-no-dead-end', name: 'Choose an amount with no dead-end open outcome', branchingExpectedTruth: false, branchingProperty: modal('diamond', 'open', null, { op: 'not', child: finish }, { n: '$n' }) },
  ];
  b.net.satelExample = { id: filename, name: entry.displayName, role: filename.endsWith('reference') ? 'reference' : 'mutant', description: entry.description };
  return b.net;
}
