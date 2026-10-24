import { builder, pairValue, intention, cases } from '../exercises/builder.js';
import { all, modal } from '../nondeterminism/editor.js';

export const inventoryMutants = ['stock-leak', 'missing-cancel', 'wrong-held', 'lost-permit'];

/** Reservation service abstraction. A reservation borrows two equal permit
 * tokens, debits a warehouse and records (quantity, permit). Cancellation must
 * restore both stock and permits for either nondeterministic acceptance route.
 * Audit history remains in the full state; it is never projected away. */
export function inventory({ sites = 1, cycles = 1, permitKinds = 1, copies = 2,
  stock = 6, audit = false, rounds = 1, mutant = null } = {}) {
  for (const [name, n, max] of [['sites', sites, 64], ['cycles', cycles, 8], ['permitKinds', permitKinds, 16],
    ['copies', copies, 8], ['stock', stock, 1000], ['rounds', rounds, 8]]) {
    if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`${name} must be in 1..${max}`);
  }
  if (mutant !== null && !inventoryMutants.includes(mutant)) throw new Error('Unknown inventory mutant');
  const b = builder();
  b.place('ack', 'Bool', [], true); b.place('held', 'Int', [], true); b.place('available', 'Int', [], true);
  for (let w = 0; w < sites; w++) {
    const p = name => `${name}_${w}`;
    b.place(p('stock'), 'Int', [stock]); b.place(p('phase'), 'Bool', [false]);
    b.place(p('reservation'), 'Pair', [pairValue(0, 0)]); b.place(p('route'), 'Bool', [false]);
    b.place(p('permits'), 'Int', Array.from({ length: permitKinds }, (_, i) => Array(copies).fill(i + 1)).flat());
    if (audit) b.place(p('audit'), 'List', [[]]);
    const args = { w: 'Nat', q: 'Int' };
    for (const route of [false, true]) {
      b.rule(`reserve_${w}_${route}`, 'reserve', args,
        `w == ${w} and not busy and q > 0 and q <= s and (q <= 2 or q >= 3) and k > 0`,
        [[p('stock'), 's'], [p('phase'), 'busy'], [p('reservation'), 'old'], [p('route'), 'oldRoute'], [p('permits'), 'k'], [p('permits'), 'k']],
        [[p('stock'), mutant === 'stock-leak' ? 's' : 's - q'], [p('phase'), 'true'], [p('reservation'), '(q, k)'], [p('route'), String(route)], ['ack', 'true']]);
    }
    b.rule(`inspect_${w}`, 'inspect', { w: 'Nat' }, `w == ${w} and busy`,
      [[p('phase'), 'busy'], [p('reservation'), 'r']],
      [[p('phase'), 'busy'], [p('reservation'), 'r'], ['held', mutant === 'wrong-held' ? 'asInt(fst(r)) + 1' : 'asInt(fst(r))']]);
    b.rule(`cancel_${w}`, 'cancel', { w: 'Nat' }, `w == ${w} and busy${mutant === 'missing-cancel' ? ' and not route' : ''}`,
      [[p('phase'), 'busy'], [p('stock'), 's'], [p('reservation'), 'r'], [p('route'), 'route'], ...(audit ? [[p('audit'), 'xs']] : [])],
      [[p('phase'), 'false'], [p('stock'), 's + asInt(fst(r))'], [p('reservation'), '(0, 0)'], [p('route'), 'false'],
        [p('permits'), 'asInt(snd(r))'], ...(mutant === 'lost-permit' ? [] : [[p('permits'), 'asInt(snd(r))']]),
        ['ack', 'true'], ...(audit ? [[p('audit'), 'append(xs, (route, asInt(snd(r))))']] : [])]);
    b.rule(`report_stock_${w}`, 'stock', { w: 'Nat' }, `w == ${w}`, [[p('stock'), 's']], [[p('stock'), 's'], ['available', 's']]);
    b.rule(`ready_${w}`, 'ready', { w: 'Nat' }, `w == ${w} and not busy`,
      [[p('phase'), 'busy'], [p('permits'), 'k'], [p('permits'), 'k']],
      [[p('phase'), 'busy'], [p('permits'), 'k'], [p('permits'), 'k'], ['ack', 'true']]);
  }
  const lines = [];
  for (let i = 0; i < cycles; i++) {
    const w = i % sites;
    lines.push(`pair reserve(w=${w}, q=q) => ack(true)`, `pair inspect(w=${w}) => held(q)`,
      `pair cancel(w=${w}) => ack(true)`, `pair stock(w=${w}) => available(${stock})`, `pair ready(w=${w}) => ack(true)`);
  }
  const ti = intention('inventory', `Inventory reservations: ${cycles * 5} pairs`,
    'operation quantity(Int): Bool\nrule small(q: Int): quantity(q) = true if q >= 1 and q <= 2\nrule bulk(q: Int): quantity(q) = true if q >= 3 and q <= 5',
    'q: Int', 'q', 'quantity', '', cases('q: Int', 'q', 'true', lines), 4);
  let property = { op: 'true' };
  for (let j = rounds - 1; j >= 0; j--) {
    const w = j % sites;
    // The diamond prevents vacuous success; the unfiltered box includes every
    // enabled route and token selection, even an unexpected acknowledgement.
    const continuation = modal('diamond', 'cancel', { ack: [true] },
      modal('diamond', 'stock', { available: [stock] }, modal('diamond', 'ready', { ack: [true] }, property, { w }), { w }), { w });
    property = all(modal('diamond', 'reserve', { ack: [true] }, { op: 'true' }, { w, q: '$q' }),
      modal('box', 'reserve', null, continuation, { w, q: '$q' }));
  }
  ti.branchingProperty = property;
  b.net.testIntentions = [ti];
  b.net.satelExample = { id: `inventory-${sites}-${cycles}-${permitKinds}-${copies}-${audit}-${rounds}-${mutant || 'reference'}`,
    name: `Inventory reservations — ${mutant || 'reference'}`, role: mutant ? 'mutant' : 'reference',
    description: 'Reserve, inspect, cancel and observe restored stock and reusable permits. Both acceptance routes must allow recovery.' };
  b.net.places.forEach(p => {
    const w = Number(p.id.match(/_(\d+)$/)?.[1]);
    if (Number.isFinite(w)) { p.x = 140 + w * 800; p.y = 100 + b.net.places.filter(x => x.id.endsWith(`_${w}`)).indexOf(p) * 140; }
  });
  b.net.transitions.forEach((t, i) => { t.x = 420 + Math.floor(i / 6) * 800; t.y = 100 + i % 6 * 140; });
  return b.net;
}
