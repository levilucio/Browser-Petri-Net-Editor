import { builder, pairValue, intention, cases, mutation, changedOutput, changedMarking } from './builder.js';
function tickets() {
  const b = builder();
  b.place('remaining', 'Nat', [0]);
  b.place('ack', 'Bool', [], true);
  b.place('count', 'Nat', [], true);
  b.rule('issue', 'issue', {
    n: 'Nat'
  }, 'n >= 2 and n <= 4', [['remaining', 'old']], [['remaining', 'n'], ['ack', 'true']]);
  b.rule('use', 'use', {}, 'n > 0', [['remaining', 'n']], [['remaining', 'n - 1'], ['ack', 'true']]);
  b.rule('inspect', 'inspect', {}, '', [['remaining', 'n']], [['remaining', 'n'], ['count', 'n']]);
  b.rule('finish', 'finish', {}, '', [['remaining', 'n']], [['remaining', '0'], ['count', 'n']]);
  b.net.testIntentions = [intention('tickets', 'Ticket booklet — two uses and settlement (6 pairs)', `operation afterTwo(Nat): Nat
rule exhausted(): afterTwo(2) = 0
rule spare(n: Nat): afterTwo(n) = n - 2 if n > 2`, 'n: Nat', 'n', 'afterTwo', 'n >= 2 and n <= 4', cases('n: Nat, left: Nat', 'n', 'left', ['pair issue(n=n) => ack(true)', 'pair use() => ack(true)', 'pair inspect() => count(n - 1)', 'pair use() => ack(true)', 'pair inspect() => count(left)', 'pair finish() => count(left)']))];
  return b.net;
}
export default {
  id: 'tickets',
  name: 'Ticket booklet',
  depth: 6,
  classes: 2,
  types: 'Nat',
  description: 'Two uses distinguish exhaustion from remaining tickets.',
  build: tickets,
  mutants: [mutation('free-use', 'Use does not debit', 'A use leaves the counter unchanged.', changedOutput('use', 'remaining', 'n')), mutation('extra-ticket', 'Issues an extra ticket', 'The booklet starts with n + 1 tickets.', changedOutput('issue', 'remaining', 'n + 1'))]
};
