import { builder, pairValue, intention, cases } from '../exercises/builder.js';
import { modal } from '../nondeterminism/editor.js';

/** A bounded abstraction of regional order fulfilment, not a production model.
 * Reservations debit stock/wallet; packing, dispatch, delivery and settlement
 * preserve the order and parcel identity. Each region has independent resources.
 */
export function fulfilment({ sites = 2, cycles = 2, policies = 4, mutant = null } = {}) {
  if (cycles < 1 || cycles > 6) throw new Error('Use 1–6 orders (5–30 pairs)');
  const b = builder();
  b.place('ack', 'Bool', [], true); b.place('receipt', 'Int', [], true); b.place('parcelOut', 'Pair', [], true);
  for (let i = 0; i < sites; i++) {
    const p = name => `${name}_${i}`;
    for (const [name, sort, v] of [['stock', 'Int', 100], ['order', 'Int', 0], ['phase', 'Int', 0], ['wallet', 'Int', 10000], ['permit', 'Pair', pairValue(10, true)], ['enabled', 'Bool', true], ['parcel', 'Pair', pairValue('', 0)]]) b.place(p(name), sort, [v]);
    for (let j = 0; j < policies; j++) b.place(p(`resource${j}`), 'Int', [(5 + j % 5) * (j + 1)]);
    const incoming = [['stock', 's'], ['order', 'old'], ['phase', 'ph'], ['wallet', 'bal'], ['permit', 'permit'], ['enabled', 'ok'], ['parcel', 'previous']].map(([name, v]) => [p(name), v]);
    const conditions = [`w == ${i}`, 'ph == 0', 'q > 0', 'q <= s', 'bal >= q * 10', 'ok', 'asBool(snd(permit))', 'q <= asInt(fst(permit))', 'length(label) >= 2', 'length(label) <= 8', 'isSubstringOf("BOX", label)'];
    const outgoing = [[p('stock'), mutant === 'stock-leak' ? 's' : 's - q'], [p('order'), 'q'], [p('phase'), '1'], [p('wallet'), 'bal - q * 10'], [p('permit'), 'permit'], [p('enabled'), 'ok'], [p('parcel'), '(label, q)'], ['ack', 'true']];
    for (let j = 0; j < policies; j++) { incoming.push([p(`resource${j}`), `r${j}`]); outgoing.push([p(`resource${j}`), `r${j}`]); conditions.push(`q * ${j + 1} <= r${j}`); }
    b.rule(`reserve_${i}`, 'reserve', { w: 'Nat', q: 'Int', label: 'String' }, conditions.join(' and '), incoming, outgoing);
    for (const [name, from, to] of [['pack', 1, 2], ['dispatch', 2, 3]]) b.rule(`${name}_${i}`, name, { w: 'Nat' }, `w == ${i} and ph == ${from}${name === 'dispatch' ? ' and q >= 3' : ''}${mutant === 'missing-dispatch' && name === 'dispatch' && i === 0 ? ' and false' : ''}`, [[p('phase'), 'ph'], [p('order'), 'q']], [[p('phase'), String(to)], [p('order'), 'q'], ['ack', 'true']]);
    b.rule(`deliver_${i}`, 'deliver', { w: 'Nat' }, `w == ${i} and ph == 3 and asInt(snd(parcel)) == q and length(asString(fst(parcel))) >= 2`, [[p('phase'), 'ph'], [p('order'), 'q'], [p('parcel'), 'parcel']], [[p('phase'), '4'], [p('order'), 'q'], [p('parcel'), 'parcel'], ['receipt', mutant === 'wrong-receipt' ? 'q + 1' : 'q'], ['parcelOut', 'parcel']]);
    b.rule(`settle_${i}`, 'settle', { w: 'Nat' }, `w == ${i} and ph == 4`, [[p('phase'), 'ph'], [p('order'), 'q']], [[p('phase'), '0'], [p('order'), '0'], ['ack', 'true']]);
  }
  const lines = [];
  for (let j = 0; j < cycles; j++) {
    const w = j % sites;
    lines.push(`pair reserve(w=${w}, q=q, label="BOX") => ack(true)`, `pair pack(w=${w}) => ack(true)`, `pair dispatch(w=${w}) => ack(true)`, `pair deliver(w=${w}) => receipt(q), parcelOut(("BOX", q))`, `pair settle(w=${w}) => ack(true)`);
  }
  b.net.testIntentions = [intention('regional-fulfilment', `Regional fulfilment: ${sites} sites / ${cycles * 5} pairs`, 'operation offer(Int): Bool\nrule quantity(q: Int): offer(q) = true if q >= 1 and q <= 5', 'q: Int', 'q', 'offer', '', cases('q: Int', 'q', 'true', lines), 4)];
  b.net.satelExample = { id: `scale-fulfilment-${sites}-${policies}-${cycles}-${mutant || 'reference'}`, role: mutant ? 'mutant' : 'reference', name: 'Regional fulfilment', description: 'Independent regional stock, wallet, permit and resource policies; continuous reserve/pack/dispatch/deliver/settle lifecycle.' };
  // Lay out region columns so a loaded large example remains navigable.
  b.net.places.forEach(p => { const i = Number(p.id.match(/_(\d+)$/)?.[1]); if (Number.isFinite(i)) { p.x = 120 + i * 700; p.y = 80 + b.net.places.filter(x => x.id.endsWith(`_${i}`)).indexOf(p) * 100; } });
  b.net.transitions.forEach((t, j) => { t.x = 460 + Math.floor(j / 5) * 700; t.y = 150 + j % 5 * 170; });
  return b.net;
}

/** Replicated worker service. Keeping the audit log exposes history-dependent
 * states; omitting it allows equivalent full markings to be memoized. */
export function workerService({ workers = 2, rounds = 2, audit = false, mutant = null } = {}) {
  const b = builder(); b.place('state', 'Int', [0]); b.place('job', 'Pair', [pairValue(0, false)]);
  b.place('ack', 'Bool', [], true); b.place('receipt', 'Pair', [], true);
  if (audit) b.place('audit', 'List', [[]]);
  for (let i = 1; i <= workers; i++) {
    b.rule(`submit_${i}`, 'submit', { p: 'Pair' }, 's == 0', [['state', 's'], ['job', 'old']], [['state', String(i)], ['job', 'p'], ['ack', 'true']]);
    b.rule(`complete_${i}`, 'complete', {}, `s == ${i} and asBool(snd(p))${i === workers ? ' and asInt(fst(p)) >= 3' : ''}${mutant === 'missing-worker' && i === workers ? ' and false' : ''}`, [['state', 's'], ['job', 'p'], ...(audit ? [['audit', 'xs']] : [])], [['state', '0'], ['job', 'p'], ['receipt', mutant === 'wrong-receipt' ? '(0, false)' : 'p'], ...(audit ? [['audit', `append(xs, ${i})`]] : [])]);
  }
  let property = { op: 'true' };
  for (let j = 0; j < rounds; j++) property = modal('box', 'submit', null, modal('diamond', 'complete', { receipt: ['$p'] }, property), { p: '$p' });
  const ti = intention('worker-service', `${workers} workers / ${rounds} rounds / ${audit ? 'audit history' : 'merged states'}`, 'operation admissible(Pair): Bool\nrule permit(n: Int): admissible((n, true)) = true if n >= 1 and n <= 5', 'p: Pair', 'p', 'admissible', '', cases('p: Pair', 'p', 'true', ['pair submit(p=p) => ack(true)', 'pair complete() => receipt(p)']), 4);
  ti.branchingProperty = property; b.net.testIntentions = [ti];
  b.net.satelExample = { id: `scale-workers-${workers}-${rounds}-${audit}-${mutant || 'reference'}`, name: 'Replicated worker service', role: mutant ? 'mutant' : 'reference', description: 'A shared job must complete regardless of which worker accepts it. Optional append-only audit retains the worker history.' };
  return b.net;
}

/** Multi-resource allocation: every quantity remains symbolic until the complete
 * allocation/confirmation path is solved. All resources interact through the
 * total target and neighboring resource policies. */
export function allocationService({ size = 8, mutant = null } = {}) {
  const b = builder(), names = Array.from({ length: size }, (_, i) => `q${i}`);
  b.place('phase', 'Int', [0]); b.place('plan', 'List', [[]]); b.place('ack', 'Bool', [], true); b.place('allocation', 'List', [], true);
  const inputs = [['phase', 'ph'], ['plan', 'old']], outputs = [['phase', '1'], ['plan', `[${names.join(', ')}]`], ['ack', 'true']];
  const conditions = ['ph == 0'];
  names.forEach((q, i) => {
    b.place(`available_${i}`, 'Int', [100]); inputs.push([`available_${i}`, `s${i}`]); outputs.push([`available_${i}`, `s${i} - ${q}`]);
    conditions.push(`${q} >= 1`, `${q} <= s${i}`);
    if (i) conditions.push(`${q} + q${i - 1} >= 12`, `2 * ${q} + q${i - 1} <= 40`);
  });
  conditions.push(`${names.join(' + ')} == ${10 * size}`);
  b.rule('allocate', 'allocate', Object.fromEntries(names.map(n => [n, 'Int'])), conditions.join(' and '), inputs, outputs);
  b.rule('confirm', 'confirm', {}, mutant === 'missing-confirmation' ? 'false' : 'ph == 1', [['phase', 'ph'], ['plan', 'xs']], [['phase', '0'], ['plan', '[]'], ['allocation', mutant === 'wrong-allocation' ? 'tail(xs)' : 'xs']]);
  const declarations = names.map(n => `${n}: Int`).join(', '), args = names.join(', ');
  b.net.testIntentions = [intention('resource-allocation', `Coupled allocation of ${size} resources`, `operation candidate(${names.map(() => 'Int').join(', ')}): Bool\nrule candidate.all(${declarations}): candidate(${args}) = true`, declarations, args, 'candidate', '', cases(declarations, args, 'true', [`pair allocate(${names.map(n => `${n}=${n}`).join(', ')}) => ack(true)`, `pair confirm() => allocation([${args}])`]), 2)];
  b.net.satelExample = { id: `scale-allocation-${size}-${mutant || 'reference'}`, name: 'Coupled resource allocator', role: mutant ? 'mutant' : 'reference', description: 'Select a vector of quantities satisfying all stock, neighboring resource and total-budget constraints, then confirm exactly that allocation.' };
  return b.net;
}
