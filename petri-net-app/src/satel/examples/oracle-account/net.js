/** A deliberately small numeric APN: Nat with +, -, <= and >. */
const place = (id, io_type, valueTokens = []) => ({
  id, label: id, sort: 'Nat', io_type, valueTokens, tokens: valueTokens.length,
});
const input = (source, target, binding) => ({
  id: `${source}-${target}`, source, target, binding,
  sourceType: 'place', targetType: 'transition',
});
const output = (source, target, binding) => ({
  id: `${source}-${target}`, source, target, binding,
  sourceType: 'transition', targetType: 'place',
});

export const accountNet = {
  mode: 'algebraic',
  places: [
    place('depositRequest', 'input', [10]), place('withdrawRequest', 'input', [10]),
    place('queryRequest', 'input', [0]), place('allRequest', 'input'), place('balance', 'internal', [0]),
    place('ack', 'output'), place('paidAmount', 'output'), place('balanceResult', 'output'),
  ],
  transitions: [
    { id: 'deposit', guard: '' },
    { id: 'withdrawAccepted', guard: 'n <= b' },
    { id: 'withdrawRefused', guard: 'n > b' },
    { id: 'withdrawAll', guard: '' },
    { id: 'query', guard: '' },
  ],
  arcs: [
    input('depositRequest', 'deposit', 'n'), input('balance', 'deposit', 'b'),
    output('deposit', 'balance', 'b + n'), output('deposit', 'ack', '1'),
    input('withdrawRequest', 'withdrawAccepted', 'n'), input('balance', 'withdrawAccepted', 'b'),
    output('withdrawAccepted', 'balance', 'b - n'), output('withdrawAccepted', 'ack', '1'),
    output('withdrawAccepted', 'paidAmount', 'n'),
    input('withdrawRequest', 'withdrawRefused', 'n'), input('balance', 'withdrawRefused', 'b'),
    output('withdrawRefused', 'balance', 'b'), output('withdrawRefused', 'ack', '0'),
    input('allRequest', 'withdrawAll', 'q'), input('balance', 'withdrawAll', 'b'),
    output('withdrawAll', 'balance', '0'), output('withdrawAll', 'ack', '1'),
    output('withdrawAll', 'paidAmount', 'b'),
    input('queryRequest', 'query', 'q'), input('balance', 'query', 'b'),
    output('query', 'balance', 'b'), output('query', 'balanceResult', 'b'),
  ],
};

// The harness chooses public requests, never the expected internal transition.
export const accountInterface = {
  actions: { deposit: 'depositRequest', withdraw: 'withdrawRequest', withdrawAll: 'allRequest', query: 'queryRequest' },
  outputs: ['ack', 'paidAmount', 'balanceResult'],
};

// Optional finite audit sample: never used to discover symbolic subdomains.
export function accountAuditCandidates() {
  return Array.from({ length: 13 }, (_, i) => ({
    id: `audit-withdraw-${i}`,
    initialMarking: accountInitialMarking({ ctor: 'Amount', args: [i] }),
    steps: [
      { action: 'deposit', value: 10 },
      { action: 'withdraw', value: i },
      { action: 'query', value: 0 },
    ],
  }));
}

export function accountMutants() {
  const change = (id, description, edit) => {
    const net = JSON.parse(JSON.stringify(accountNet));
    edit(net);
    return { id, description, net };
  };
  return [
    change('no-debit', 'Accepted withdrawal leaves the balance unchanged.', net => {
      net.arcs.find(a => a.id === 'withdrawAccepted-balance').binding = 'b';
    }),
    change('refusal-resets-balance', 'Refused withdrawal resets the balance to zero.', net => {
      net.arcs.find(a => a.id === 'withdrawRefused-balance').binding = '0';
    }),
    change('reject-exact-balance', 'Withdrawal of exactly the available balance is refused.', net => {
      net.transitions.find(t => t.id === 'withdrawAccepted').guard = 'n < b';
      net.transitions.find(t => t.id === 'withdrawRefused').guard = 'n >= b';
    }),
  ];
}

// Explicit parameterized test-environment setup, applied only at initialization.
// The current model supplies internal state; no pair may replace it.
export function accountInitialMarking(request) {
  return { depositRequest: [10], withdrawRequest: request.ctor === 'Amount' ? [request.args[0]] : [],
    allRequest: request.ctor === 'All' ? [0] : [], queryRequest: [0] };
}
