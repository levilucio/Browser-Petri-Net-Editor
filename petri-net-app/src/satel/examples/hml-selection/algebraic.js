import { builder, pairValue } from '../exercises/builder.js';
import { modal } from '../nondeterminism/editor.js';

const scenarios = [
  { id: 'string', name: 'String label', sort: 'String', initial: '', wrong: '"wrong"',
    equation: 'rule label(x: String): seed(x) = true if length(x) >= 1 and length(x) <= 4',
    ready: 'length(v) >= 2 and isSubstringOf("ok", v)', description: 'Choose a short label containing “ok”, shared by both open outcomes.' },
  { id: 'list', name: 'List queue', sort: 'List', initial: [], wrong: '[]',
    equation: 'rule single(n: Int): seed([n]) = true if n >= 1 and n <= 5',
    ready: 'length(v) == 1 and asInt(head(v)) >= 3', description: 'Choose a one-item integer list whose head is at least 3.' },
  { id: 'pair', name: 'Pair permit', sort: 'Pair', initial: pairValue(0, false), wrong: '(0, false)',
    equation: 'rule permit(n: Int, enabled: Bool): seed((n, enabled)) = true if n >= 1 and n <= 5',
    ready: 'asInt(fst(v)) >= 3 and asBool(snd(v))', description: 'Choose a permit with an integer of at least 3 and a true flag.' },
];
export const hmlAlgebraicExamples = scenarios.flatMap(s => [
  ['reference', 'Reference', s.description],
  ['missing-finish', 'Mutant: missing finish', 'The second open outcome cannot finish.'],
  ['wrong-value', 'Mutant: wrong value', 'Finish returns an incorrect algebraic value.'],
].map(([variant, label, description]) => ({ filename: `hml-adt-${s.id}-${variant}`, displayName: `SATEL HML ADT selection — ${s.name} — ${label}`, description })));

export function createHmlAlgebraicExample(filename) {
  const entry = hmlAlgebraicExamples.find(e => e.filename === filename), s = scenarios.find(s => filename.startsWith(`hml-adt-${s.id}-`));
  if (!entry || !s) throw new Error('Unknown algebraic HML selection example');
  const b = builder();
  b.place('state', 'Int', [0]); b.place('value', s.sort, [s.initial]);
  b.place('ack', 'Bool', [], true); b.place('item', s.sort, [], true);
  for (const [id, state] of [['openA', 1], ['openB', 2]]) b.rule(id, 'open', { x: s.sort }, 's == 0', [['state', 's'], ['value', 'old']], [['state', String(state)], ['value', 'x'], ['ack', 'true']]);
  b.rule('finish', 'finish', {}, filename.endsWith('missing-finish') ? 's == 1' : `s == 1 or (s == 2 and (${s.ready}))`, [['state', 's'], ['value', 'v']], [['state', '3'], ['value', 'v'], ['ack', 'true'], ['item', filename.endsWith('wrong-value') ? s.wrong : 'v']]);
  const finish = modal('diamond', 'finish', { ack: [true], item: ['$x'] });
  const base = {
    kind: 'symbolic',
    symbolic: {
      source: `operation seed(${s.sort}): Bool\n${s.equation}`,
      operation: 'seed', variablesText: `x: ${s.sort}`, argsText: 'x', conditionsText: '', maxDepth: 4,
      protocolSource: `case open(x: ${s.sort}):\ninputs x\nresult true\npair open(x=x) => ack(true)`,
    },
  };
  b.net.testIntentions = [
    { ...base, id: `hml-adt-${s.id}-progress`, name: `${s.name}: every open outcome can finish`, branchingProperty: modal('box', 'open', null, finish, { x: '$x' }) },
    { ...base, id: `hml-adt-${s.id}-no-dead-end`, name: `${s.name}: no open outcome is a dead end`, branchingExpectedTruth: false, branchingProperty: modal('diamond', 'open', null, { op: 'not', child: finish }, { x: '$x' }) },
  ];
  b.net.satelExample = { id: filename, name: entry.displayName, role: filename.endsWith('reference') ? 'reference' : 'mutant', description: entry.description };
  return b.net;
}
