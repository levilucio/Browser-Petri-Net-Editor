import { builder, pairValue, intention, cases, mutation, changedOutput, changedMarking } from './builder.js';
function kits() {
  const b = builder();
  b.place('stock', 'Pair', [pairValue('bolt', true), pairValue('bolt', true)]);
  b.place('loan', 'Pair', []);
  b.place('product', 'Pair', []);
  b.place('idle', 'Bool', [true]);
  b.place('ack', 'Bool', [], true);
  b.place('parts', 'Pair', [], true);
  b.place('kit', 'Pair', [], true);
  b.rule('take', 'take', {}, '', [['stock', 'part'], ['stock', 'part'], ['idle', 'ready']], [['loan', 'part'], ['loan', 'part'], ['ack', 'ready']]);
  b.rule('inspectLoan', 'inspectLoan', {}, '', [['loan', 'part'], ['loan', 'part']], [['loan', 'part'], ['loan', 'part'], ['parts', 'part'], ['parts', 'part']]);
  b.rule('assemble', 'assemble', {
    recyclable: 'Bool'
  }, '', [['loan', 'part'], ['loan', 'part']], [['product', '("kit", recyclable)'], ['ack', 'true']]);
  b.rule('inspectProduct', 'inspectProduct', {}, '', [['product', 'p']], [['product', 'p'], ['kit', 'p']]);
  b.rule('disassemble', 'disassemble', {}, '', [['product', 'p']], [['loan', '("bolt", true)'], ['loan', '("bolt", true)'], ['ack', 'true']]);
  b.rule('returnParts', 'returnParts', {}, '', [['loan', 'part'], ['loan', 'part']], [['stock', 'part'], ['stock', 'part'], ['idle', 'true'], ['ack', 'true']]);
  const cycle = ['pair take() => ack(true)', 'pair inspectLoan() => parts(("bolt", true)), parts(("bolt", true))', 'pair assemble(recyclable=b) => ack(true)', 'pair inspectProduct() => kit(("kit", b))', 'pair disassemble() => ack(true)', 'pair returnParts() => ack(true)'];
  b.net.testIntentions = [intention('kits', 'Assembly kits — two equal occurrences, three cycles (18 pairs)', `operation recycling(Bool): Bool
rule disposable(): recycling(false) = false
rule reusable(): recycling(true) = true`, 'b: Bool', 'b', 'recycling', '', cases('b: Bool', 'b', 'b', [...cycle, ...cycle, ...cycle]))];
  return b.net;
}
export default {
  id: 'kits',
  name: 'Assembly kits',
  depth: 18,
  classes: 2,
  types: 'Pair, String, Bool',
  description: 'Three cycles consume two distinct equal tokens, respecting shared bindings.',
  build: kits,
  mutants: [mutation('missing-part', 'Only one initial part', 'The initial marking lacks the second equal part.', changedMarking('stock', [pairValue('bolt', true)])), mutation('wrong-material', 'Wrong recycling flag', 'Assembly always reports a disposable kit.', changedOutput('assemble', 'product', '("kit", false)'))]
};
