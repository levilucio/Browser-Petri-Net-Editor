import { builder, pairValue, intention, cases, mutation, changedOutput, changedMarking } from './builder.js';
function coordinates() {
  const b = builder();
  b.place('position', 'Pair', [pairValue(0, 0)]);
  b.place('ack', 'Bool', [], true);
  b.place('point', 'Pair', [], true);
  b.rule('load', 'load', {
    p: 'Pair'
  }, '', [['position', 'old']], [['position', 'p'], ['ack', 'true']]);
  b.rule('read', 'read', {}, '', [['position', 'p']], [['position', 'p'], ['point', 'p']]);
  b.rule('move', 'move', {
    dx: 'Int',
    dy: 'Int'
  }, '', [['position', 'p']], [['position', '(asInt(fst(p)) + dx, asInt(snd(p)) + dy)'], ['ack', 'true']]);
  b.rule('mirror', 'mirror', {}, '', [['position', 'p']], [['position', '(-asInt(fst(p)), -asInt(snd(p)))'], ['ack', 'true']]);
  b.rule('reset', 'reset', {}, '', [['position', 'p']], [['position', '(0, 0)'], ['ack', 'true']]);
  b.net.testIntentions = [intention('coordinates', 'Coordinates — translate, mirror and reset (10 pairs)', `operation quadrant(Pair): Nat
rule southwest(x: Int, y: Int): quadrant((x, y)) = 0 if x < 0 and y < 0
rule northwest(x: Int, y: Int): quadrant((x, y)) = 1 if x < 0 and y >= 0
rule southeast(x: Int, y: Int): quadrant((x, y)) = 2 if x >= 0 and y < 0
rule northeast(x: Int, y: Int): quadrant((x, y)) = 3 if x >= 0 and y >= 0`, 'x: Int, y: Int', '(x, y)', 'quadrant', 'x >= -2 and x <= 2 and y >= -2 and y <= 2', cases('x: Int, y: Int, q: Nat', '(x, y)', 'q', ['pair load(p=(x, y)) => ack(true)', 'pair read() => point((x, y))', 'pair move(dx=1, dy=0) => ack(true)', 'pair read() => point((x + 1, y))', 'pair move(dx=0, dy=1) => ack(true)', 'pair read() => point((x + 1, y + 1))', 'pair mirror() => ack(true)', 'pair read() => point((-(x + 1), -(y + 1)))', 'pair reset() => ack(true)', 'pair read() => point((0, 0))']))];
  return b.net;
}
export default {
  id: 'coordinates',
  name: 'Coordinate cursor',
  depth: 10,
  classes: 4,
  types: 'Pair, Int',
  description: 'Four sign regions; translations, reflection, and reset.',
  build: coordinates,
  mutants: [mutation('swapped-axes', 'Swapped movement axes', 'Applies dy to x and dx to y.', changedOutput('move', 'position', '(asInt(fst(p)) + dy, asInt(snd(p)) + dx)')), mutation('bad-origin', 'Wrong reset origin', 'Reset goes to (1, 0).', changedOutput('reset', 'position', '(1, 0)'))]
};
