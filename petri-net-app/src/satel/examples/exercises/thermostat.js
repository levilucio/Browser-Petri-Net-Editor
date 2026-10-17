import { builder, pairValue, intention, cases, mutation, changedOutput, changedMarking } from './builder.js';
function thermostat() {
  const b = builder();
  b.place('temperature', 'Int', [20]);
  b.place('band', 'Int', [], true);
  b.place('reading', 'Int', [], true);
  for (const [id, guard, band] of [['cold', 'delta < 0', -1], ['steady', 'delta == 0', 0], ['warm', 'delta > 0', 1]]) {
    b.rule(id, 'adjust', {
      delta: 'Int'
    }, `${guard} and delta >= -5 and delta <= 5`, [['temperature', 't']], [['temperature', 't + delta'], ['band', String(band)]]);
  }
  b.rule('read', 'read', {}, '', [['temperature', 't']], [['temperature', 't'], ['reading', 't']]);
  b.net.testIntentions = [intention('thermostat', 'Thermostat — signed adjustment (2 pairs)', `operation direction(Int): Int
rule below(d: Int): direction(d) = -1 if d < 0
rule steady(d: Int): direction(d) = 0 if d == 0
rule above(d: Int): direction(d) = 1 if d > 0`, 'd: Int', 'd', 'direction', 'd >= -5 and d <= 5', cases('d: Int, k: Int', 'd', 'k', ['pair adjust(delta=d) => band(k)', 'pair read() => reading(20 + d)']))];
  return b.net;
}
export default {
  id: 'thermostat',
  name: 'Thermostat',
  depth: 2,
  classes: 3,
  types: 'Int',
  description: 'Signed adjustments: below, equal to, and above zero.',
  build: thermostat,
  mutants: [mutation('wrong-direction', 'Wrong cooling direction', 'Cooling adds the opposite adjustment.', changedOutput('cold', 'temperature', 't - delta')), mutation('wrong-initial', 'Wrong initial temperature', 'Starts at 21 instead of 20.', changedMarking('temperature', [21]))]
};
