const source = `constructor Standard(): Delivery
constructor Express(): Delivery
constructor Receipt(Nat, Nat): Settlement
operation settle(Nat, Delivery, Nat): Settlement
rule standard.small(q: Nat, r: Nat): settle(q, Standard(), r) = Receipt(2, 100 - 10 * q - 2 + 10 * r) if q < 4
rule standard.bulk(q: Nat, r: Nat): settle(q, Standard(), r) = Receipt(0, 100 - 10 * q + 10 * r) if q >= 4
rule express.small(q: Nat, r: Nat): settle(q, Express(), r) = Receipt(5, 100 - 10 * q - 5 + 10 * r) if q < 4
rule express.bulk(q: Nat, r: Nat): settle(q, Express(), r) = Receipt(3, 100 - 10 * q - 3 + 10 * r) if q >= 4`;

export function createFulfilmentIntention() {
  const sequence = rush => `pair open(rush=${rush}) => ack(true)
pair add(quantity=q) => cartAmount(q)
pair reserve() => reservedAmount(q)
pair pay() => charged(10 * q)
pair pack() => packedAmount(q)
pair ship() => shippingFee(fee)
pair deliver() => deliveredAmount(q)
pair returnItems(quantity=r) => refunded(10 * r)
pair close() => ack(true)
pair audit() => stockLevel(10), walletBalance(cash), netRevenue(20 + fee), loyalty(2), shipmentCount(1), returnCount(1)`;
  return { id: 'fulfilment-ten-pairs', kind: 'symbolic', name: 'Fulfilment — purchase, delivery, partial return and audit (10 pairs)',
    description: 'Four constructor/equation classes. Initial stock 12 and final stock 10 force q − r = 2 across the complete lifecycle. Each admitted test has exactly ten calls.',
    symbolic: { source, operation: 'settle', argsText: 'q, delivery, r', variablesText: 'q: Nat, delivery: Delivery, r: Nat',
      conditionsText: 'q >= 2 and q <= 8 and r > 0 and r < q', maxDepth: 2,
      protocolSource: `case standard(q: Nat, r: Nat, fee: Nat, cash: Nat):
inputs q, Standard(), r
result Receipt(fee, cash)
${sequence(false)}

case express(q: Nat, r: Nat, fee: Nat, cash: Nat):
inputs q, Express(), r
result Receipt(fee, cash)
${sequence(true)}` } };
}

export const fulfilmentMutations = [
  { id: 'stock-not-reserved', label: 'Stock not reserved', description: 'Reservation reports success but does not deduct stock.', arc: 'reserve-stock', binding: 's' },
  { id: 'payment-not-debited', label: 'Payment not debited', description: 'Payment reports the right charge but leaves the wallet unchanged.', arc: 'pay-wallet', binding: 'cash' },
  { id: 'express-bulk-fee', label: 'Wrong express bulk fee', description: 'Express bulk orders pay 5 instead of the specified 3.', editFee: true },
  { id: 'refund-not-credited', label: 'Refund not credited', description: 'Return reports the right refund but does not credit the wallet.', arc: 'returnItems-wallet', binding: 'cash' },
  { id: 'one-packing-crate', label: 'Only one packing crate', description: 'Initial marking has one crate; packing requires two distinct occurrences.', initialCrates: [1] },
  { id: 'loyalty-before-return', label: 'Loyalty ignores returns', description: 'Close credits the original quantity instead of the retained quantity.', arc: 'close-points', binding: 'p + q + returned' },
];
export const fulfilmentExamples = [
  { filename: 'fulfilment-reference', displayName: 'SATEL Fulfilment — Reference (10 pairs)' },
  ...fulfilmentMutations.map(m => ({ filename: `fulfilment-${m.id}`, displayName: `SATEL Fulfilment — Mutant: ${m.label}` })),
];

/** One independent APN per example. Every method has explicit state inputs. */
export function createFulfilmentExample(filename = 'fulfilment-reference') {
  const mutant = fulfilmentMutations.find(m => filename === `fulfilment-${m.id}`);
  if (filename !== 'fulfilment-reference' && !mutant) throw new Error('Unknown fulfilment example');
  const net = { mode: 'algebraic', places: [], transitions: [], arcs: [] };
  const place = (id, sort, tokens, x, y, output = false) => net.places.push({ id, label: id, sort, io_type: output ? 'output' : 'internal', valueTokens: tokens, tokens: tokens.length, x, y });
  // Two rows follow the lifecycle left to right, then right to left.
  const stages = ['open', 'add', 'reserve', 'pay', 'pack', 'ship', 'deliver', 'returnItems', 'close', 'audit'];
  const position = stage => { const i = stages.indexOf(stage); return [220 + (i < 5 ? i : 9 - i) * 440, i < 5 ? 350 : 1000]; };
  const phases = ['idle', 'draft', 'cart', 'reserved', 'paid', 'packed', 'transit', 'delivered', 'returned'];
  phases.forEach((id, i) => {
    const [x, y] = position(stages[Math.min(i, 8)]);
    place(id, 'Nat', id === 'idle' ? [1] : [], x - (i < 5 ? 140 : -140), y);
  });
  const resources = [
    ['stock', 'Nat', [12], 1100, 100], ['wallet', 'Nat', [100], 1550, 100],
    ['revenue', 'Nat', [0], 650, 750], ['points', 'Nat', [0], 550, 1250],
    ['shipments', 'Nat', [0], 1550, 1250], ['returns', 'Nat', [0], 1100, 1250],
    ['crates', 'Nat', [1, 1], 1980, 100], ['crateLoan', 'Nat', [], 2140, 700],
    ['deliveryMode', 'Bool', [], 250, 100], ['escrow', 'Nat', [], 1550, 750],
    ['returnedQuantity', 'Nat', [], 950, 750],
  ];
  resources.forEach(args => place(...args));
  const outputs = [
    ['ack', 'Bool', 210, 650], ['cartAmount', 'Nat', 660, 600], ['reservedAmount', 'Nat', 1100, 600],
    ['charged', 'Nat', 1540, 600], ['packedAmount', 'Nat', 1980, 600], ['shippingFee', 'Nat', 1980, 1250],
    ['deliveredAmount', 'Nat', 1700, 1450], ['refunded', 'Nat', 1100, 1450],
    ['stockLevel', 'Nat', 60, 1500], ['walletBalance', 'Nat', 280, 1500], ['netRevenue', 'Nat', 500, 1500],
    ['loyalty', 'Nat', 60, 1700], ['shipmentCount', 'Nat', 280, 1700], ['returnCount', 'Nat', 500, 1700],
  ];
  outputs.forEach(([id, sort, x, y]) => place(id, sort, [], x, y, true));
  const arc = (id, source, target, binding, input) => net.arcs.push({ id, source, target, binding, weight: 1,
    sourceType: input ? 'place' : 'transition', targetType: input ? 'transition' : 'place', type: input ? 'place-to-transition' : 'transition-to-place' });
  const rule = (id, method, parameters, guard, inputs, outputs, offset = 0) => {
    const [x, y] = position(method);
    net.transitions.push({ id, label: id, x, y: y + offset, guard, method: { name: method, parameters: parameters.map(([name, sort]) => ({ name, sort })) } });
    inputs.forEach(([p, term], i) => arc(`${p}-${id}-${i}`, p, id, term, true));
    outputs.forEach(([p, term], i) => arc(`${id}-${p}${outputs.findIndex(o => o[0] === p) === i ? '' : '-' + i}`, id, p, term, false));
  };
  rule('open', 'open', [['rush', 'Bool']], '', [['idle', 'ready']], [['draft', 'ready'], ['deliveryMode', 'rush'], ['ack', 'true']]);
  rule('add', 'add', [['quantity', 'Nat']], 'quantity > 0 and quantity <= s', [['draft', 'ready'], ['stock', 's']], [['cart', 'quantity'], ['stock', 's'], ['cartAmount', 'quantity']]);
  rule('addRefused', 'add', [['quantity', 'Nat']], 'quantity == 0 or quantity > s', [['draft', 'ready'], ['stock', 's']], [['draft', 'ready'], ['stock', 's'], ['ack', 'false']], -110);
  rule('reserve', 'reserve', [], 'q <= s', [['cart', 'q'], ['stock', 's']], [['reserved', 'q'], ['stock', 's - q'], ['reservedAmount', 'q']]);
  rule('reserveRefused', 'reserve', [], 'q > s', [['cart', 'q'], ['stock', 's']], [['cart', 'q'], ['stock', 's'], ['ack', 'false']], -110);
  rule('pay', 'pay', [], 'cash >= 10 * q', [['reserved', 'q'], ['wallet', 'cash']], [['paid', 'q'], ['wallet', 'cash - 10 * q'], ['escrow', '10 * q'], ['charged', '10 * q']]);
  rule('payRefused', 'pay', [], 'cash < 10 * q', [['reserved', 'q'], ['wallet', 'cash']], [['reserved', 'q'], ['wallet', 'cash'], ['ack', 'false']], -110);
  rule('pack', 'pack', [], '', [['paid', 'q'], ['crates', 'c'], ['crates', 'c']], [['packed', 'q'], ['crateLoan', 'c'], ['crateLoan', 'c'], ['packedAmount', 'q']]);
  for (const [id, guard, fee, offset] of [
    ['shipStandardSmall', 'not rush and q < 4', 2, -150], ['shipStandardBulk', 'not rush and q >= 4', 0, -50],
    ['shipExpressSmall', 'rush and q < 4', 5, 50], ['shipExpressBulk', 'rush and q >= 4', 3, 150],
  ]) rule(id, 'ship', [], `${guard} and cash >= ${fee}`, [['packed', 'q'], ['deliveryMode', 'rush'], ['wallet', 'cash'], ['revenue', 'rev']], [['transit', 'q'], ['wallet', `cash - ${fee}`], ['revenue', `rev + ${fee}`], ['shippingFee', String(fee)]], offset);
  rule('deliver', 'deliver', [], '', [['transit', 'q'], ['crateLoan', 'c'], ['crateLoan', 'c'], ['shipments', 's']], [['delivered', 'q'], ['crates', 'c'], ['crates', 'c'], ['shipments', 's + 1'], ['deliveredAmount', 'q']]);
  rule('returnItems', 'returnItems', [['quantity', 'Nat']], 'quantity > 0 and quantity <= q', [['delivered', 'q'], ['stock', 's'], ['wallet', 'cash'], ['escrow', 'held'], ['returns', 'r']], [['returned', 'q - quantity'], ['returnedQuantity', 'quantity'], ['stock', 's + quantity'], ['wallet', 'cash + 10 * quantity'], ['escrow', 'held - 10 * quantity'], ['returns', 'r + 1'], ['refunded', '10 * quantity']]);
  rule('returnRefused', 'returnItems', [['quantity', 'Nat']], 'quantity == 0 or quantity > q', [['delivered', 'q']], [['delivered', 'q'], ['ack', 'false']], -110);
  rule('close', 'close', [], '', [['returned', 'q'], ['returnedQuantity', 'returned'], ['escrow', 'held'], ['revenue', 'rev'], ['points', 'p']], [['idle', '1'], ['revenue', 'rev + held'], ['points', 'p + q'], ['ack', 'true']]);
  rule('audit', 'audit', [], '', [['idle', 'ready'], ['stock', 's'], ['wallet', 'cash'], ['revenue', 'rev'], ['points', 'p'], ['shipments', 'sent'], ['returns', 'r']], [['idle', 'ready'], ['stock', 's'], ['wallet', 'cash'], ['revenue', 'rev'], ['points', 'p'], ['shipments', 'sent'], ['returns', 'r'], ['stockLevel', 's'], ['walletBalance', 'cash'], ['netRevenue', 'rev'], ['loyalty', 'p'], ['shipmentCount', 'sent'], ['returnCount', 'r']]);
  if (mutant?.arc) net.arcs.find(a => a.id === mutant.arc).binding = mutant.binding;
  if (mutant?.editFee) {
    net.transitions.find(t => t.id === 'shipExpressBulk').guard = 'rush and q >= 4 and cash >= 5';
    for (const [p, value] of [['wallet', 'cash - 5'], ['revenue', 'rev + 5'], ['shippingFee', '5']]) net.arcs.find(a => a.id === `shipExpressBulk-${p}`).binding = value;
  }
  if (mutant?.initialCrates) { const p = net.places.find(p => p.id === 'crates'); p.valueTokens = [...mutant.initialCrates]; p.tokens = p.valueTokens.length; }
  net.testIntentions = [createFulfilmentIntention()];
  net.satelExample = { id: filename, name: mutant ? `Fulfilment mutant: ${mutant.label}` : 'Fulfilment reference — ten pairs', role: mutant ? 'mutant' : 'reference',
    description: mutant?.description || 'Order lifecycle with stock, wallet, escrow, revenue, two packing crates, delivery, returns and loyalty. Four classes, ten pairs each.' };
  return net;
}
