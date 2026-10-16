/** A deliberately small numeric APN: Nat with +, -, <= and >. */
const place = (id, io_type, valueTokens = []) => ({
  id,
  label: id,
  sort: 'Nat',
  io_type,
  valueTokens,
  tokens: valueTokens.length
});
const input = (source, target, binding) => ({
  id: `${source}-${target}`,
  source,
  target,
  binding,
  sourceType: 'place',
  targetType: 'transition'
});
const output = (source, target, binding) => ({
  id: `${source}-${target}`,
  source,
  target,
  binding,
  sourceType: 'transition',
  targetType: 'place'
});
export const accountNet = {
  mode: 'algebraic',
  places: [place('balance', 'internal', [0]), place('ack', 'output'), place('paidAmount', 'output'), place('balanceResult', 'output')],
  transitions: [{
    id: 'deposit',
    guard: '',
    method: {
      name: 'deposit',
      parameters: [{
        name: 'n',
        sort: 'Nat'
      }]
    }
  }, {
    id: 'withdrawAccepted',
    guard: 'n <= b',
    method: {
      name: 'withdraw',
      parameters: [{
        name: 'n',
        sort: 'Nat'
      }]
    }
  }, {
    id: 'withdrawRefused',
    guard: 'n > b',
    method: {
      name: 'withdraw',
      parameters: [{
        name: 'n',
        sort: 'Nat'
      }]
    }
  }, {
    id: 'withdrawAll',
    guard: '',
    method: {
      name: 'withdrawAll',
      parameters: []
    }
  }, {
    id: 'query',
    guard: '',
    method: {
      name: 'query',
      parameters: []
    }
  }],
  arcs: [input('balance', 'deposit', 'b'), output('deposit', 'balance', 'b + n'), output('deposit', 'ack', '1'), input('balance', 'withdrawAccepted', 'b'), output('withdrawAccepted', 'balance', 'b - n'), output('withdrawAccepted', 'ack', '1'), output('withdrawAccepted', 'paidAmount', 'n'), input('balance', 'withdrawRefused', 'b'), output('withdrawRefused', 'balance', 'b'), output('withdrawRefused', 'ack', '0'), input('balance', 'withdrawAll', 'b'), output('withdrawAll', 'balance', '0'), output('withdrawAll', 'ack', '1'), output('withdrawAll', 'paidAmount', 'b'), input('balance', 'query', 'b'), output('query', 'balance', 'b'), output('query', 'balanceResult', 'b')]
};

// The harness chooses public requests, never the expected internal transition.
export const accountInterface = {
  methods: [{
    name: 'deposit',
    parameters: [{
      name: 'n',
      sort: 'Nat'
    }]
  }, {
    name: 'withdraw',
    parameters: [{
      name: 'n',
      sort: 'Nat'
    }]
  }, {
    name: 'withdrawAll',
    parameters: []
  }, {
    name: 'query',
    parameters: []
  }],
  outputs: ['ack', 'paidAmount', 'balanceResult']
};

// Optional finite audit sample: never used to discover symbolic subdomains.
export function accountAuditCandidates() {
  return Array.from({
    length: 13
  }, (_, i) => ({
    id: `audit-withdraw-${i}`,
    steps: [{
      method: 'deposit',
      arguments: {
        n: 10
      }
    }, {
      method: 'withdraw',
      arguments: {
        n: i
      }
    }, {
      method: 'query',
      arguments: {}
    }],
    // Independent arithmetic expectation; never learned by executing this net.
    expected: [{
      ack: [1],
      paidAmount: [],
      balanceResult: []
    }, {
      ack: [i <= 10 ? 1 : 0],
      paidAmount: i <= 10 ? [i] : [],
      balanceResult: []
    }, {
      ack: [],
      paidAmount: [],
      balanceResult: [i <= 10 ? 10 - i : 10]
    }]
  }));
}
export function accountMutants() {
  const change = (id, description, edit) => {
    const net = JSON.parse(JSON.stringify(accountNet));
    edit(net);
    return {
      id,
      description,
      net
    };
  };
  return [change('no-debit', 'Accepted withdrawal leaves the balance unchanged.', net => {
    net.arcs.find(a => a.id === 'withdrawAccepted-balance').binding = 'b';
  }), change('refusal-resets-balance', 'Refused withdrawal resets the balance to zero.', net => {
    net.arcs.find(a => a.id === 'withdrawRefused-balance').binding = '0';
  }), change('reject-exact-balance', 'Withdrawal of exactly the available balance is refused.', net => {
    net.transitions.find(t => t.id === 'withdrawAccepted').guard = 'n < b';
    net.transitions.find(t => t.id === 'withdrawRefused').guard = 'n >= b';
  }), change('wrong-initial-balance', 'Account starts with balance one instead of zero.', net => {
    net.places.find(p => p.id === 'balance').valueTokens = [1];
  })];
}
