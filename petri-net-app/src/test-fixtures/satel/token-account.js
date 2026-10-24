/** Legacy request-token APN retained only for direct-transition regression tests. */
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
