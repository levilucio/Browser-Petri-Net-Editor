import { accountNet, accountMutants } from './net.js';

export const oracleAccountExamples = [
  { filename: 'oracle-account-reference', displayName: 'SATEL Account — Reference' },
  ...accountMutants().map(m => ({ filename: `oracle-account-${m.id}`,
    displayName: `SATEL Account — Mutant: ${m.id}` })),
];

/** Real, independent APNs, with editor coordinates and arc types. */
export function createOracleAccountExample(filename) {
  const mutant = accountMutants().find(m => filename === `oracle-account-${m.id}`);
  if (filename !== 'oracle-account-reference' && !mutant) throw new Error('Unknown account example');
  const net = JSON.parse(JSON.stringify(mutant?.net || accountNet));
  const places = {
    depositRequest: [120, 100], withdrawRequest: [120, 260], allRequest: [120, 460],
    queryRequest: [120, 620], balance: [420, 340], ack: [720, 180],
    paidAmount: [720, 400], balanceResult: [720, 620],
  };
  const transitions = { deposit: [300, 100], withdrawAccepted: [300, 240],
    withdrawRefused: [300, 360], withdrawAll: [300, 480], query: [540, 620] };
  const labels = { depositRequest: 'deposit', withdrawRequest: 'amount', queryRequest: 'query',
    allRequest: 'all', balance: 'balance', ack: 'ack', paidAmount: 'paid', balanceResult: 'result',
    deposit: 'add', withdrawAccepted: 'pay', withdrawRefused: 'deny', withdrawAll: 'all', query: 'read' };
  net.places.forEach(p => { [p.x, p.y] = places[p.id]; p.label = labels[p.id]; });
  net.transitions.forEach(t => { [t.x, t.y] = transitions[t.id]; t.label = labels[t.id]; });
  net.arcs.forEach(a => { a.type = `${a.sourceType}-to-${a.targetType}`; a.weight = 1; });
  net.satelExample = { id: filename, name: mutant ? `Account mutant: ${mutant.id}` : 'Account reference',
    description: mutant?.description || 'Deposit, withdraw and query a Nat balance.',
    role: mutant ? 'mutant' : 'reference' };
  // Model-owned intentions replace the former localStorage transfer mechanism.
  net.testIntentions = [];
  return net;
}
