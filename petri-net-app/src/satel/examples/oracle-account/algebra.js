import { accountInitialMarking } from './net.js';
const v = name => ({ var: name });
const ctor = (name, ...args) => ({ ctor: name, args });
const call = (name, ...args) => ({ call: name, args });
const cmp = (op, left, right) => ({ op, left, right });

/** Source equations for symbolic selection, not inferred from sampled traces. */
export const accountAlgebra = {
  constructors: {
    All: { parameters: [], result: 'Request' },
    Amount: { parameters: ['Nat'], result: 'Request' },
    Paid: { parameters: ['Nat'], result: 'Reply' },
    Refused: { parameters: ['Nat'], result: 'Reply' },
    Result: { parameters: ['Nat', 'Reply'], result: 'WithdrawalResult' },
  },
  operations: {
    affordable: {
      parameters: ['Nat', 'Nat'], result: 'Bool',
      rules: [
        { id: 'affordable.less', variables: { n: 'Nat', b: 'Nat' }, patterns: [v('n'), v('b')],
          conditions: [cmp('<', v('n'), v('b'))], result: true },
        { id: 'affordable.equal', variables: { n: 'Nat', b: 'Nat' }, patterns: [v('n'), v('b')],
          conditions: [cmp('==', v('n'), v('b'))], result: true },
        { id: 'affordable.greater', variables: { n: 'Nat', b: 'Nat' }, patterns: [v('n'), v('b')],
          conditions: [cmp('>', v('n'), v('b'))], result: false },
      ],
    },
    withdraw: {
      parameters: ['Nat', 'Request'], result: 'WithdrawalResult',
      rules: [
        { id: 'withdraw.all', variables: { b: 'Nat' }, patterns: [v('b'), ctor('All')], conditions: [],
          result: ctor('Result', 0, ctor('Paid', v('b'))) },
        { id: 'withdraw.amount.accept', variables: { b: 'Nat', n: 'Nat' }, patterns: [v('b'), ctor('Amount', v('n'))],
          conditions: [cmp('==', call('affordable', v('n'), v('b')), true)],
          result: ctor('Result', { op: '-', left: v('b'), right: v('n') }, ctor('Paid', v('n'))) },
        { id: 'withdraw.amount.refuse', variables: { b: 'Nat', n: 'Nat' }, patterns: [v('b'), ctor('Amount', v('n'))],
          conditions: [cmp('==', call('affordable', v('n'), v('b')), false)],
          result: ctor('Result', v('b'), ctor('Refused', v('n'))) },
      ],
    },
  },
};

export const withdrawalGoal = {
  algebra: accountAlgebra, operation: 'withdraw',
  args: [10, v('request')], variables: { request: 'Request' }, maxDepth: 2,
};

// Same operation semantics, coarser equation structure. Comparing these two
// goals demonstrates why grouping concrete transition traces loses refinement.
export function coarseWithdrawalGoal() {
  const goal = JSON.parse(JSON.stringify(withdrawalGoal));
  goal.algebra.operations.affordable.rules = [
    { id: 'affordable.yes', variables: { n: 'Nat', b: 'Nat' }, patterns: [v('n'), v('b')],
      conditions: [cmp('<=', v('n'), v('b'))], result: true },
    { id: 'affordable.no', variables: { n: 'Nat', b: 'Nat' }, patterns: [v('n'), v('b')],
      conditions: [cmp('>', v('n'), v('b'))], result: false },
  ];
  return goal;
}

/** Explicit constructor-to-public-request encoding for the current numeric APN. */
export function requestSteps(request) {
  let withdrawal;
  if (request?.ctor === 'All' && request.args?.length === 0) withdrawal = { action: 'withdrawAll', value: 0 };
  else if (request?.ctor === 'Amount' && request.args?.length === 1 && Number.isInteger(request.args[0]) && request.args[0] >= 0 && request.args[0] <= 2147483647) {
    withdrawal = { action: 'withdraw', value: request.args[0] };
  } else throw new Error('Unsupported withdrawal constructor');
  return [{ action: 'deposit', value: 10 }, withdrawal, { action: 'query', value: 0 }];
}

// The APN protocol represents Paid/Refused by ack 1/0, observes the actual paid
// amount separately, and reads the new balance through a subsequent query.
export function encodeAccountWitness(args, result) {
  if (args[0] !== 10 || result?.ctor !== 'Result' || result.args?.length !== 2) throw new Error('Unsupported account setup/result');
  const [balance, reply] = result.args;
  if (!['Paid', 'Refused'].includes(reply?.ctor) || reply.args?.length !== 1) throw new Error('Unsupported reply constructor');
  return {
    initialMarking: accountInitialMarking(args[1]),
    steps: requestSteps(args[1]),
    expected: [
      { ack: [1], paidAmount: [], balanceResult: [] },
      { ack: [reply.ctor === 'Paid' ? 1 : 0], paidAmount: reply.ctor === 'Paid' ? [reply.args[0]] : [], balanceResult: [] },
      { ack: [], paidAmount: [], balanceResult: [balance] },
    ],
  };
}
