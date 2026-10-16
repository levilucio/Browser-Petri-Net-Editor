import { builder, pairValue, intention, cases, mutation, changedOutput, changedMarking } from './builder.js';
function quota() {
  const b = builder();
  b.place('available', 'Nat', [10]);
  b.place('held', 'Nat', [0]);
  b.place('eligible', 'Bool', [], true);
  b.place('ack', 'Bool', [], true);
  b.place('free', 'Nat', [], true);
  b.place('reserved', 'Nat', [], true);
  b.rule('reserve', 'reserve', {
    n: 'Nat'
  }, 'n > 0 and n <= free', [['available', 'free'], ['held', 'h']], [['available', 'free - n'], ['held', 'h + n'], ['eligible', 'n > 0 and (n < 4 or n == 7)']]);
  b.rule('release', 'release', {
    n: 'Nat'
  }, 'n > 0 and n <= h', [['available', 'free'], ['held', 'h']], [['available', 'free + n'], ['held', 'h - n'], ['ack', 'true']]);
  b.rule('audit', 'audit', {}, '', [['available', 'free'], ['held', 'h']], [['available', 'free'], ['held', 'h'], ['free', 'free'], ['reserved', 'h']]);
  const lines = ['pair reserve(n=n) => eligible(ok)', 'pair audit() => free(10 - n), reserved(n)', 'pair release(n=3) => ack(true)', 'pair audit() => free(13 - n), reserved(n - 3)', 'pair reserve(n=4) => eligible(false)', 'pair audit() => free(9 - n), reserved(n + 1)', 'pair release(n=n) => ack(true)', 'pair audit() => free(9), reserved(1)', 'pair reserve(n=1) => eligible(true)', 'pair audit() => free(8), reserved(2)', 'pair release(n=2) => ack(true)', 'pair audit() => free(10), reserved(0)', 'pair reserve(n=3) => eligible(true)', 'pair audit() => free(7), reserved(3)', 'pair release(n=3) => ack(true)', 'pair audit() => free(10), reserved(0)'];
  b.net.testIntentions = [intention('quota', 'Resource quota — whole-sequence feasibility (16 pairs)', `operation priority(Nat): Bool
rule small(n: Nat): priority(n) = true if n > 0 and n < 4
rule special(n: Nat): priority(n) = true if n == 7
rule ordinary(n: Nat): priority(n) = false if n >= 4 and n != 7`, 'n: Nat', 'n', 'priority', 'n > 0 and n <= 8', cases('n: Nat, ok: Bool', 'n', 'ok', lines))];
  return b.net;
}
export default {
  id: 'quota',
  name: 'Resource quota',
  depth: 16,
  classes: 3,
  types: 'Nat, Bool',
  description: 'Repeated reservations/releases; a later release forces n ≥ 3.',
  build: quota,
  mutants: [mutation('lost-release', 'Release loses capacity', 'Release reduces held resources but does not restore free capacity.', changedOutput('release', 'available', 'free')), mutation('missing-special', 'Missing priority boundary', 'Priority forgets the n = 7 alternative.', changedOutput('reserve', 'eligible', 'n > 0 and n < 4'))]
};
