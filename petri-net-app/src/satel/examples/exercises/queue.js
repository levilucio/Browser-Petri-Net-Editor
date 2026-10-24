import { builder, pairValue, intention, cases, mutation, changedOutput, changedMarking } from './builder.js';
function queue() {
  const b = builder();
  b.place('queue', 'List', [[]]);
  b.place('ack', 'Bool', [], true);
  b.place('items', 'List', [], true);
  b.place('removed', 'Int', [], true);
  b.rule('load', 'load', {
    xs: 'List'
  }, '', [['queue', 'old']], [['queue', 'xs'], ['ack', 'true']]);
  b.rule('enqueue', 'enqueue', {
    n: 'Int'
  }, '', [['queue', 'xs']], [['queue', 'append(xs, n)'], ['ack', 'true']]);
  b.rule('read', 'read', {}, '', [['queue', 'xs']], [['queue', 'xs'], ['items', 'xs']]);
  b.rule('dequeue', 'dequeue', {}, 'length(xs) > 0', [['queue', 'xs']], [['queue', 'tail(xs)'], ['removed', 'asInt(head(xs))']]);
  b.rule('clear', 'clear', {}, '', [['queue', 'xs']], [['queue', '[]'], ['ack', 'true']]);
  // A deliberately partial operation defines exactly the three bounded input
  // shapes, with integer elements. It makes no claim about longer input lists.
  const source = `operation seedShape(List): Nat
rule empty(): seedShape([]) = 0
rule single(a: Int): seedShape([a]) = 1
rule double(a: Int, b: Int): seedShape([a, b]) = 2`;
  const full = 'concat(xs, [7, 8])',
    tail = `tail(${full})`,
    next = `append(${tail}, 9)`;
  b.net.testIntentions = [intention('queue', 'FIFO queue — bounded constructor seeds (12 pairs)', source, 'xs: List', 'xs', 'seedShape', '', cases('xs: List, size: Nat', 'xs', 'size', ['pair load(xs=xs) => ack(true)', 'pair enqueue(n=7) => ack(true)', 'pair enqueue(n=8) => ack(true)', `pair read() => items(${full})`, `pair dequeue() => removed(asInt(head(${full})))`, `pair read() => items(${tail})`, 'pair enqueue(n=9) => ack(true)', `pair read() => items(${next})`, `pair dequeue() => removed(asInt(head(${next})))`, `pair read() => items(tail(${next}))`, 'pair clear() => ack(true)', 'pair read() => items([])']))];
  return b.net;
}
export default {
  id: 'queue',
  name: 'FIFO queue',
  depth: 12,
  classes: 3,
  types: 'List, Int',
  description: 'Empty, one-item and two-item integer seeds; enqueue and dequeue.',
  build: queue,
  mutants: [mutation('prepend', 'Enqueues at the front', 'Insertion uses prepend instead of append.', changedOutput('enqueue', 'queue', '[n | xs]')), mutation('no-removal', 'Dequeue keeps head', 'Reports the correct removed item but leaves it in the queue.', changedOutput('dequeue', 'queue', 'xs'))]
};
