import { builder, pairValue, intention, cases, mutation, changedOutput, changedMarking } from './builder.js';
function parcel() {
  const b = builder();
  b.place('parcel', 'Pair', [pairValue('', false)]);
  b.place('phase', 'Nat', [0]);
  b.place('ack', 'Bool', [], true);
  b.place('metadata', 'Pair', [], true);
  b.place('stage', 'Nat', [], true);
  const update = (name, params, from, to, term) => b.rule(name, name, params, `stageNo == ${from}`, [['parcel', 'p'], ['phase', 'stageNo']], [['parcel', term], ['phase', String(to)], ['ack', 'true']]);
  update('create', {
    meta: 'Pair'
  }, 0, 1, 'meta');
  update('relabel', {}, 1, 2, '(concat("ID:", asString(fst(p))), snd(p))');
  update('markFragile', {}, 2, 3, '(fst(p), true)');
  update('dispatch', {}, 3, 4, 'p');
  update('deliver', {}, 4, 5, 'p');
  update('returnToSender', {}, 5, 6, '(concat(asString(fst(p)), ":RETURN"), snd(p))');
  update('reset', {}, 6, 0, '("", false)');
  b.rule('read', 'read', {}, '', [['parcel', 'p'], ['phase', 's']], [['parcel', 'p'], ['phase', 's'], ['metadata', 'p'], ['stage', 's']]);
  const lines = [];
  for (const [call, value, phase] of [['create(meta=(s, fragile))', '(s, fragile)', 1], ['relabel()', '(concat("ID:", s), fragile)', 2], ['markFragile()', '(concat("ID:", s), true)', 3], ['dispatch()', '(concat("ID:", s), true)', 4], ['deliver()', '(concat("ID:", s), true)', 5], ['returnToSender()', '(concat(concat("ID:", s), ":RETURN"), true)', 6], ['reset()', '("", false)', 0]]) lines.push(`pair ${call} => ack(true)`, `pair read() => metadata(${value}), stage(${phase})`);
  b.net.testIntentions = [intention('parcel', 'Parcel — label, handling flag and lifecycle (14 pairs)', `operation handling(Pair): Nat
rule emptyRegular(): handling(("", false)) = 0
rule emptyFragile(): handling(("", true)) = 1
rule namedRegular(s: String): handling((s, false)) = 2 if length(s) > 0
rule namedFragile(s: String): handling((s, true)) = 3 if length(s) > 0`, 's: String, fragile: Bool', '(s, fragile)', 'handling', 'length(s) <= 4 and isSubstringOf(s, "BOX1")', cases('s: String, fragile: Bool, kind: Nat', '(s, fragile)', 'kind', lines))];
  return b.net;
}
export default {
  id: 'parcel',
  name: 'Parcel lifecycle',
  depth: 14,
  classes: 4,
  types: 'Pair, String, Bool, Nat',
  description: 'Empty/named × regular/fragile metadata through seven lifecycle stages.',
  build: parcel,
  mutants: [mutation('not-fragile', 'Loses fragile flag', 'Mark-fragile stores false.', changedOutput('markFragile', 'parcel', '(fst(p), false)')), mutation('no-return-label', 'Missing return label', 'Return-to-sender preserves the old label.', changedOutput('returnToSender', 'parcel', 'p'))]
};
