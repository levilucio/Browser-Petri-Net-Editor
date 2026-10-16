import { builder, pairValue, intention, cases, mutation, changedOutput, changedMarking } from './builder.js';
function labels() {
  const b = builder();
  b.place('label', 'String', ['']);
  b.place('accepted', 'Bool', [], true);
  b.place('text', 'String', [], true);
  b.place('ack', 'Bool', [], true);
  b.rule('register', 'register', {
    s: 'String'
  }, 'length(s) <= 6', [['label', 'old']], [['label', 's'], ['accepted', 'length(s) > 0 and length(s) <= 3']]);
  b.rule('read', 'read', {}, '', [['label', 's']], [['label', 's'], ['text', 's']]);
  b.rule('prefix', 'prefix', {}, '', [['label', 's']], [['label', 'concat("#", s)'], ['ack', 'true']]);
  b.rule('suffix', 'suffix', {}, '', [['label', 's']], [['label', 'concat(s, "!")'], ['ack', 'true']]);
  b.rule('clear', 'clear', {}, '', [['label', 's']], [['label', '""'], ['ack', 'true']]);
  b.net.testIntentions = [intention('labels', 'Label editor — empty, short and long text (8 pairs)', `operation shortLabel(String): Bool
rule empty(s: String): shortLabel(s) = false if length(s) == 0
rule short(s: String): shortLabel(s) = true if length(s) > 0 and length(s) <= 3
rule long(s: String): shortLabel(s) = false if length(s) > 3`, 's: String', 's', 'shortLabel', 'length(s) <= 6 and isSubstringOf(s, "ABCDEF")', cases('s: String, ok: Bool', 's', 'ok', ['pair register(s=s) => accepted(ok)', 'pair read() => text(s)', 'pair prefix() => ack(true)', 'pair read() => text(concat("#", s))', 'pair suffix() => ack(true)', 'pair read() => text(concat(concat("#", s), "!"))', 'pair clear() => ack(true)', 'pair read() => text("")']))];
  return b.net;
}
export default {
  id: 'labels',
  name: 'Label editor',
  depth: 8,
  classes: 3,
  types: 'String, Bool',
  description: 'Empty, short and long labels; prefix, suffix, and clear.',
  build: labels,
  mutants: [mutation('wrong-prefix', 'Wrong prefix', 'Uses @ instead of #.', changedOutput('prefix', 'label', 'concat("@", s)')), mutation('stale-clear', 'Clear keeps text', 'Clearing leaves the decorated label behind.', changedOutput('clear', 'label', 's'))]
};
