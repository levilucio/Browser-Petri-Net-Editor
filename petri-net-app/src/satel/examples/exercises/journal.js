import { builder, pairValue, intention, cases, mutation, changedOutput, changedMarking } from './builder.js';
function journal() {
  const b = builder();
  b.place('current', 'Int', [0]);
  b.place('journal', 'List', [[]]);
  b.place('label', 'String', ['sensor']);
  b.place('alarm', 'Bool', [], true);
  b.place('records', 'List', [], true);
  b.place('source', 'String', [], true);
  b.rule('record', 'record', {
    delta: 'Int',
    armed: 'Bool'
  }, 'delta >= -2 and delta <= 2 and delta != 0', [['current', 'v'], ['journal', 'xs']], [['current', 'v + delta'], ['journal', 'append(xs, (v + delta, armed))'], ['alarm', 'armed and delta > 0']]);
  b.rule('read', 'read', {}, '', [['journal', 'xs'], ['label', 's']], [['journal', 'xs'], ['label', 's'], ['records', 'xs'], ['source', 's']]);
  const lines = [];
  for (let i = 1; i <= 10; i++) lines.push('pair record(delta=d, armed=b) => alarm(a)', `pair read() => records([${Array.from({
    length: i
  }, (_, k) => `(${k + 1} * d, b)`).join(', ')}]), source("sensor")`);
  b.net.testIntentions = [intention('journal', 'Sensor journal — ten cumulative readings (20 pairs)', `operation alarmFor(Int, Bool): Bool
rule fallingQuiet(d: Int): alarmFor(d, false) = false if d < 0
rule fallingArmed(d: Int): alarmFor(d, true) = false if d < 0
rule risingQuiet(d: Int): alarmFor(d, false) = false if d > 0
rule risingArmed(d: Int): alarmFor(d, true) = true if d > 0`, 'd: Int, b: Bool', 'd, b', 'alarmFor', 'd >= -2 and d <= 2 and d != 0', cases('d: Int, b: Bool, a: Bool', 'd, b', 'a', lines))];
  return b.net;
}
export default {
  id: 'journal',
  name: 'Sensor journal',
  depth: 20,
  classes: 4,
  types: 'List, Pair, Int, Bool, String',
  description: 'Ten record/read rounds; growing lists of cumulative readings and alarm flags.',
  build: journal,
  mutants: [mutation('reverse-log', 'Newest record first', 'Prepends each new reading instead of appending.', changedOutput('record', 'journal', '[(v + delta, armed) | xs]')), mutation('no-accumulation', 'Forgets accumulated value', 'The stored sensor value becomes delta instead of v + delta.', changedOutput('record', 'current', 'delta'))]
};
