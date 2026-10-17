import { builder, pairValue, intention, cases, mutation, changedOutput, changedMarking } from './builder.js';
function door() {
  const b = builder();
  b.place('settings', 'Pair', [pairValue(false, false)]);
  b.place('opened', 'Bool', [false]);
  b.place('ack', 'Bool', [], true);
  b.place('access', 'Bool', [], true);
  b.place('doorState', 'Bool', [], true);
  b.rule('configure', 'configure', {
    enabled: 'Bool',
    jammed: 'Bool'
  }, '', [['settings', 'old']], [['settings', '(enabled, jammed)'], ['ack', 'true']]);
  b.rule('attempt', 'attempt', {}, '', [['settings', 's'], ['opened', 'old']], [['settings', 's'], ['opened', 'asBool(fst(s)) and not asBool(snd(s))'], ['access', 'asBool(fst(s)) and not asBool(snd(s))']]);
  b.rule('reset', 'reset', {}, '', [['opened', 'old']], [['opened', 'false'], ['ack', 'true']]);
  b.rule('inspect', 'inspect', {}, '', [['opened', 'v']], [['opened', 'v'], ['doorState', 'v']]);
  b.net.testIntentions = [intention('door', 'Door interlock — permission and obstruction (4 pairs)', `operation permitted(Bool, Bool): Bool
rule offClear(): permitted(false, false) = false
rule offJammed(): permitted(false, true) = false
rule onClear(): permitted(true, false) = true
rule onJammed(): permitted(true, true) = false`, 'e: Bool, j: Bool', 'e, j', 'permitted', '', cases('e: Bool, j: Bool, allowed: Bool', 'e, j', 'allowed', ['pair configure(enabled=e, jammed=j) => ack(true)', 'pair attempt() => access(allowed)', 'pair reset() => ack(true)', 'pair inspect() => doorState(false)']))];
  return b.net;
}
export default {
  id: 'door',
  name: 'Door interlock',
  depth: 4,
  classes: 4,
  types: 'Bool, Pair',
  description: 'Four permission/obstruction combinations, followed by reset.',
  build: door,
  mutants: [mutation('ignore-jam', 'Ignores obstruction', 'The access response ignores the jammed flag.', changedOutput('attempt', 'access', 'asBool(fst(s))')), mutation('stuck-open', 'Reset leaves door open', 'Reset preserves the open state.', changedOutput('reset', 'opened', 'old'))]
};
