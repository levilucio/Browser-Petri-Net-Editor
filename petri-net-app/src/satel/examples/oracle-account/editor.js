import { accountNet, accountMutants } from './net.js';
import { createAccountSymbolicIntentions } from './intentions.js';

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
  const places = { balance: [420, 300], ack: [720, 120], paidAmount: [720, 320], balanceResult: [720, 520] };
  const transitions = { deposit: [180, 100], withdrawAccepted: [180, 240],
    withdrawRefused: [180, 360], withdrawAll: [180, 480], query: [480, 540] };
  const labels = { balance: 'balance', ack: 'ack', paidAmount: 'paid', balanceResult: 'result',
    deposit: 'deposit(n)', withdrawAccepted: 'withdraw(n): pay', withdrawRefused: 'withdraw(n): refuse',
    withdrawAll: 'withdrawAll()', query: 'query()' };
  net.places.forEach(p => { [p.x, p.y] = places[p.id]; p.label = labels[p.id]; });
  net.transitions.forEach(t => { [t.x, t.y] = transitions[t.id]; t.label = labels[t.id]; });
  net.arcs.forEach(a => { a.type = `${a.sourceType}-to-${a.targetType}`; a.weight = 1; });
  net.satelExample = { id: filename, name: mutant ? `Account mutant: ${mutant.id}` : 'Account reference',
    description: mutant?.description || 'Deposit, withdraw and query a Nat balance.',
    role: mutant ? 'mutant' : 'reference' };
  // Model-owned intentions replace the former localStorage transfer mechanism.
  net.testIntentions = createAccountSymbolicIntentions();
  return net;
}
