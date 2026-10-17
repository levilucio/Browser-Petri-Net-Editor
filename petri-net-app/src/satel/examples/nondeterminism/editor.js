import { builder } from '../exercises/builder.js';
const yes = () => ({ op: 'true' });
const no = () => ({ op: 'false' });
export const modal = (op, method, outputs, child = yes(), args = {}) => ({ op, stimulation: { method, arguments: args }, ...(outputs === null ? {} : { observation: { outputs } }), child });
export const all = (...children) => ({ op: 'and', children });
const property = (id, name, formula, expectedTruth = true) => ({ id, name, testType: 'positive', variables: [], pairs: [], formula, expectedTruth });
function multiset() {
  const b = builder();
  b.place('stock', 'Int', [1, 1, 2]); b.place('picked', 'Int', [], true);
  b.rule('take', 'take', {}, '', [['stock', 'x']], [['picked', 'x']]);
  const refused = modal('box', 'take', null, no());
  const sequence = values => values.reduceRight((child, x) => modal('diamond', 'take', { picked: [x] }, child), refused);
  b.net.testIntentions = [property('bag-orders', 'Both token orders, multiplicity and final refusal', all(sequence([1, 1, 2]), sequence([2, 1, 1]))),
    property('bag-no-third', 'No third value may be reported', { op: 'not', child: modal('diamond', 'take', { picked: [99] }) })];
  return b.net;
}
function branching() {
  const b = builder();
  b.place('state', 'Int', [0]); b.place('reply', 'Int', [], true);
  b.rule('openBoth', 'open', {}, 's == 0', [['state', 's']], [['state', '1'], ['reply', '0']]);
  b.rule('openLeft', 'open', {}, 's == 0', [['state', 's']], [['state', '2'], ['reply', '0']]);
  b.rule('left', 'left', {}, 's == 1 or s == 2', [['state', 's']], [['state', '3'], ['reply', '1']]);
  b.rule('right', 'right', {}, 's == 1 or s == 4', [['state', 's']], [['state', '3'], ['reply', '2']]);
  const both = () => all(modal('diamond', 'left', { reply: [1] }), modal('diamond', 'right', { reply: [2] }));
  b.net.testIntentions = [property('branch-both', 'One open outcome retains both choices', modal('diamond', 'open', { reply: [0] }, both())),
    property('branch-restricted', 'Not every open outcome retains both choices', modal('box', 'open', null, both()), false),
    property('branch-progress', 'Every open outcome has a continuation', modal('box', 'open', null, { op: 'or', children: [modal('diamond', 'left', { reply: [1] }), modal('diamond', 'right', { reply: [2] })] }))];
  return b.net;
}
export const nondeterminismExamples = [
  ['bag-reference', 'Multiset reference', 'Choose from {1, 1, 2}; repeated tokens are significant.'],
  ['bag-missing-choice', 'Multiset mutant: missing choice', 'Only value 1 can be consumed.'],
  ['bag-multiplicity', 'Multiset mutant: missing duplicate', 'Starts with {1, 2}, losing one occurrence.'],
  ['bag-extra-output', 'Multiset mutant: extra output', 'An additional enabled take rule can report 99.'],
  ['branch-reference', 'Branching reference', 'Two open rules return the same observation but leave different future choices.'],
  ['branch-early-choice', 'Branching mutant: early choice', 'Same observable traces, but open commits to left or right.'],
  ['branch-missing-restriction', 'Branching mutant: lost alternative', 'Every open now retains both choices; the restricted alternative has disappeared.'],
].map(([id, title, description]) => ({ filename: `nondeterminism-${id}`, displayName: `SATEL Nondeterminism — ${title}`, description }));
export function createNondeterminismExample(filename) {
  const entry = nondeterminismExamples.find(e => e.filename === filename);
  if (!entry) throw new Error('Unknown nondeterminism example');
  const net = filename.includes('-bag-') ? multiset() : branching();
  if (filename.endsWith('missing-choice')) net.transitions[0].guard = 'x == 1';
  if (filename.endsWith('multiplicity')) { net.places[0].valueTokens = [1, 2]; net.places[0].tokens = 2; }
  if (filename.endsWith('extra-output')) {
    net.transitions.push({ ...net.transitions[0], id: 'takeBad', label: 'takeBad', x: 690 });
    net.arcs.push(...net.arcs.map(a => ({ ...a, id: a.id + '-bad', source: a.source === 'take' ? 'takeBad' : a.source, target: a.target === 'take' ? 'takeBad' : a.target, binding: a.source === 'take' ? '99' : a.binding })));
  }
  if (filename.endsWith('early-choice')) net.arcs.find(a => a.source === 'openBoth' && a.target === 'state').binding = '4';
  if (filename.endsWith('missing-restriction')) net.transitions.find(t => t.id === 'openLeft').guard = 'false';
  net.satelExample = { id: filename, name: entry.displayName, role: filename.endsWith('reference') ? 'reference' : 'mutant', description: entry.description };
  return net;
}
