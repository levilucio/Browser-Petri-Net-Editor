/** Ten small, stateful case studies. Equations and expected observations are
 * authored explicitly; mutants change only the APN, never its intention. */
const clone = x => JSON.parse(JSON.stringify(x));
const pairValue = (fst, snd) => ({ __pair__: true, fst, snd });

function builder() {
  const net = { mode: 'algebraic', places: [], transitions: [], arcs: [] };
  const place = (id, sort, values = [], output = false) => {
    const i = net.places.filter(p => p.io_type === (output ? 'output' : 'internal')).length;
    net.places.push({ id, label: id, sort, io_type: output ? 'output' : 'internal', valueTokens: clone(values), tokens: values.length,
      x: output ? 1000 : 140, y: 100 + i * 140 });
  };
  const rule = (id, name, parameters, guard, inputs, outputs) => {
    const i = net.transitions.length;
    net.transitions.push({ id, label: id, x: 430 + (i % 2) * 260, y: 130 + Math.floor(i / 2) * 200, guard,
      method: { name, parameters: Object.entries(parameters).map(([name, sort]) => ({ name, sort })) } });
    for (const [input, entries] of [[true, inputs], [false, outputs]]) entries.forEach(([p, binding], j) => net.arcs.push({
      id: `${id}-${input ? 'in' : 'out'}-${p}-${j}`, source: input ? p : id, target: input ? id : p,
      sourceType: input ? 'place' : 'transition', targetType: input ? 'transition' : 'place',
      type: input ? 'place-to-transition' : 'transition-to-place', binding, weight: 1,
    }));
  };
  return { net, place, rule };
}
const changedOutput = (rule, place, binding) => net => {
  const arc = net.arcs.find(a => a.source === rule && a.target === place);
  if (!arc) throw new Error(`Missing mutation site ${rule}/${place}`);
  arc.binding = binding;
};
const changedMarking = (place, values) => net => {
  const p = net.places.find(p => p.id === place); p.valueTokens = clone(values); p.tokens = values.length;
};
const mutation = (id, label, description, apply) => ({ id, label, description, apply });
const intention = (id, name, source, variablesText, argsText, operation, conditionsText, protocolSource, maxDepth = 12) => ({
  id: `exercise-${id}`, name, kind: 'symbolic', symbolic: { source, variablesText, argsText, operation, conditionsText, protocolSource, maxDepth },
});
const cases = (declarations, inputs, result, lines, id = 'run') => `case ${id}(${declarations}):\ninputs ${inputs}\nresult ${result}\n${lines.join('\n')}`;

function thermostat() {
  const b = builder();
  b.place('temperature', 'Int', [20]); b.place('band', 'Int', [], true); b.place('reading', 'Int', [], true);
  for (const [id, guard, band] of [['cold', 'delta < 0', -1], ['steady', 'delta == 0', 0], ['warm', 'delta > 0', 1]]) {
    b.rule(id, 'adjust', { delta: 'Int' }, `${guard} and delta >= -5 and delta <= 5`, [['temperature', 't']], [['temperature', 't + delta'], ['band', String(band)]]);
  }
  b.rule('read', 'read', {}, '', [['temperature', 't']], [['temperature', 't'], ['reading', 't']]);
  b.net.testIntentions = [intention('thermostat', 'Thermostat — signed adjustment (2 pairs)', `operation direction(Int): Int
rule below(d: Int): direction(d) = -1 if d < 0
rule steady(d: Int): direction(d) = 0 if d == 0
rule above(d: Int): direction(d) = 1 if d > 0`, 'd: Int', 'd', 'direction', 'd >= -5 and d <= 5',
  cases('d: Int, k: Int', 'd', 'k', ['pair adjust(delta=d) => band(k)', 'pair read() => reading(20 + d)']))];
  return b.net;
}
function door() {
  const b = builder();
  b.place('settings', 'Pair', [pairValue(false, false)]); b.place('opened', 'Bool', [false]);
  b.place('ack', 'Bool', [], true); b.place('access', 'Bool', [], true); b.place('doorState', 'Bool', [], true);
  b.rule('configure', 'configure', { enabled: 'Bool', jammed: 'Bool' }, '', [['settings', 'old']], [['settings', '(enabled, jammed)'], ['ack', 'true']]);
  b.rule('attempt', 'attempt', {}, '', [['settings', 's'], ['opened', 'old']], [['settings', 's'], ['opened', 'asBool(fst(s)) and not asBool(snd(s))'], ['access', 'asBool(fst(s)) and not asBool(snd(s))']]);
  b.rule('reset', 'reset', {}, '', [['opened', 'old']], [['opened', 'false'], ['ack', 'true']]);
  b.rule('inspect', 'inspect', {}, '', [['opened', 'v']], [['opened', 'v'], ['doorState', 'v']]);
  b.net.testIntentions = [intention('door', 'Door interlock — permission and obstruction (4 pairs)', `operation permitted(Bool, Bool): Bool
rule offClear(): permitted(false, false) = false
rule offJammed(): permitted(false, true) = false
rule onClear(): permitted(true, false) = true
rule onJammed(): permitted(true, true) = false`, 'e: Bool, j: Bool', 'e, j', 'permitted', '',
    cases('e: Bool, j: Bool, allowed: Bool', 'e, j', 'allowed', ['pair configure(enabled=e, jammed=j) => ack(true)', 'pair attempt() => access(allowed)', 'pair reset() => ack(true)', 'pair inspect() => doorState(false)']))];
  return b.net;
}
function tickets() {
  const b = builder(); b.place('remaining', 'Nat', [0]); b.place('ack', 'Bool', [], true); b.place('count', 'Nat', [], true);
  b.rule('issue', 'issue', { n: 'Nat' }, 'n >= 2 and n <= 4', [['remaining', 'old']], [['remaining', 'n'], ['ack', 'true']]);
  b.rule('use', 'use', {}, 'n > 0', [['remaining', 'n']], [['remaining', 'n - 1'], ['ack', 'true']]);
  b.rule('inspect', 'inspect', {}, '', [['remaining', 'n']], [['remaining', 'n'], ['count', 'n']]);
  b.rule('finish', 'finish', {}, '', [['remaining', 'n']], [['remaining', '0'], ['count', 'n']]);
  b.net.testIntentions = [intention('tickets', 'Ticket booklet — two uses and settlement (6 pairs)', `operation afterTwo(Nat): Nat
rule exhausted(): afterTwo(2) = 0
rule spare(n: Nat): afterTwo(n) = n - 2 if n > 2`, 'n: Nat', 'n', 'afterTwo', 'n >= 2 and n <= 4',
    cases('n: Nat, left: Nat', 'n', 'left', ['pair issue(n=n) => ack(true)', 'pair use() => ack(true)', 'pair inspect() => count(n - 1)', 'pair use() => ack(true)', 'pair inspect() => count(left)', 'pair finish() => count(left)']))];
  return b.net;
}
function labels() {
  const b = builder(); b.place('label', 'String', ['']); b.place('accepted', 'Bool', [], true); b.place('text', 'String', [], true); b.place('ack', 'Bool', [], true);
  b.rule('register', 'register', { s: 'String' }, 'length(s) <= 6', [['label', 'old']], [['label', 's'], ['accepted', 'length(s) > 0 and length(s) <= 3']]);
  b.rule('read', 'read', {}, '', [['label', 's']], [['label', 's'], ['text', 's']]);
  b.rule('prefix', 'prefix', {}, '', [['label', 's']], [['label', 'concat("#", s)'], ['ack', 'true']]);
  b.rule('suffix', 'suffix', {}, '', [['label', 's']], [['label', 'concat(s, "!")'], ['ack', 'true']]);
  b.rule('clear', 'clear', {}, '', [['label', 's']], [['label', '""'], ['ack', 'true']]);
  b.net.testIntentions = [intention('labels', 'Label editor — empty, short and long text (8 pairs)', `operation shortLabel(String): Bool
rule empty(s: String): shortLabel(s) = false if length(s) == 0
rule short(s: String): shortLabel(s) = true if length(s) > 0 and length(s) <= 3
rule long(s: String): shortLabel(s) = false if length(s) > 3`, 's: String', 's', 'shortLabel', 'length(s) <= 6 and isSubstringOf(s, "ABCDEF")',
    cases('s: String, ok: Bool', 's', 'ok', ['pair register(s=s) => accepted(ok)', 'pair read() => text(s)', 'pair prefix() => ack(true)', 'pair read() => text(concat("#", s))', 'pair suffix() => ack(true)', 'pair read() => text(concat(concat("#", s), "!"))', 'pair clear() => ack(true)', 'pair read() => text("")']))];
  return b.net;
}
function coordinates() {
  const b = builder(); b.place('position', 'Pair', [pairValue(0, 0)]); b.place('ack', 'Bool', [], true); b.place('point', 'Pair', [], true);
  b.rule('load', 'load', { p: 'Pair' }, '', [['position', 'old']], [['position', 'p'], ['ack', 'true']]);
  b.rule('read', 'read', {}, '', [['position', 'p']], [['position', 'p'], ['point', 'p']]);
  b.rule('move', 'move', { dx: 'Int', dy: 'Int' }, '', [['position', 'p']], [['position', '(asInt(fst(p)) + dx, asInt(snd(p)) + dy)'], ['ack', 'true']]);
  b.rule('mirror', 'mirror', {}, '', [['position', 'p']], [['position', '(-asInt(fst(p)), -asInt(snd(p)))'], ['ack', 'true']]);
  b.rule('reset', 'reset', {}, '', [['position', 'p']], [['position', '(0, 0)'], ['ack', 'true']]);
  b.net.testIntentions = [intention('coordinates', 'Coordinates — translate, mirror and reset (10 pairs)', `operation quadrant(Pair): Nat
rule southwest(x: Int, y: Int): quadrant((x, y)) = 0 if x < 0 and y < 0
rule northwest(x: Int, y: Int): quadrant((x, y)) = 1 if x < 0 and y >= 0
rule southeast(x: Int, y: Int): quadrant((x, y)) = 2 if x >= 0 and y < 0
rule northeast(x: Int, y: Int): quadrant((x, y)) = 3 if x >= 0 and y >= 0`, 'x: Int, y: Int', '(x, y)', 'quadrant', 'x >= -2 and x <= 2 and y >= -2 and y <= 2',
    cases('x: Int, y: Int, q: Nat', '(x, y)', 'q', ['pair load(p=(x, y)) => ack(true)', 'pair read() => point((x, y))', 'pair move(dx=1, dy=0) => ack(true)', 'pair read() => point((x + 1, y))', 'pair move(dx=0, dy=1) => ack(true)', 'pair read() => point((x + 1, y + 1))', 'pair mirror() => ack(true)', 'pair read() => point((-(x + 1), -(y + 1)))', 'pair reset() => ack(true)', 'pair read() => point((0, 0))']))];
  return b.net;
}
function queue() {
  const b = builder(); b.place('queue', 'List', [[]]); b.place('ack', 'Bool', [], true); b.place('items', 'List', [], true); b.place('removed', 'Int', [], true);
  b.rule('load', 'load', { xs: 'List' }, '', [['queue', 'old']], [['queue', 'xs'], ['ack', 'true']]);
  b.rule('enqueue', 'enqueue', { n: 'Int' }, '', [['queue', 'xs']], [['queue', 'append(xs, n)'], ['ack', 'true']]);
  b.rule('read', 'read', {}, '', [['queue', 'xs']], [['queue', 'xs'], ['items', 'xs']]);
  b.rule('dequeue', 'dequeue', {}, 'length(xs) > 0', [['queue', 'xs']], [['queue', 'tail(xs)'], ['removed', 'asInt(head(xs))']]);
  b.rule('clear', 'clear', {}, '', [['queue', 'xs']], [['queue', '[]'], ['ack', 'true']]);
  // A deliberately partial operation defines exactly the three bounded input
  // shapes, with integer elements. It makes no claim about longer input lists.
  const source = `operation seedShape(List): Nat
rule empty(): seedShape([]) = 0
rule single(a: Int): seedShape([a]) = 1
rule double(a: Int, b: Int): seedShape([a, b]) = 2`;
  const full = 'concat(xs, [7, 8])', tail = `tail(${full})`, next = `append(${tail}, 9)`;
  b.net.testIntentions = [intention('queue', 'FIFO queue — bounded constructor seeds (12 pairs)', source, 'xs: List', 'xs', 'seedShape', '',
    cases('xs: List, size: Nat', 'xs', 'size', ['pair load(xs=xs) => ack(true)', 'pair enqueue(n=7) => ack(true)', 'pair enqueue(n=8) => ack(true)', `pair read() => items(${full})`, `pair dequeue() => removed(asInt(head(${full})))`, `pair read() => items(${tail})`, 'pair enqueue(n=9) => ack(true)', `pair read() => items(${next})`, `pair dequeue() => removed(asInt(head(${next})))`, `pair read() => items(tail(${next}))`, 'pair clear() => ack(true)', 'pair read() => items([])']))];
  return b.net;
}
function parcel() {
  const b = builder(); b.place('parcel', 'Pair', [pairValue('', false)]); b.place('phase', 'Nat', [0]); b.place('ack', 'Bool', [], true); b.place('metadata', 'Pair', [], true); b.place('stage', 'Nat', [], true);
  const update = (name, params, from, to, term) => b.rule(name, name, params, `stageNo == ${from}`, [['parcel', 'p'], ['phase', 'stageNo']], [['parcel', term], ['phase', String(to)], ['ack', 'true']]);
  update('create', { meta: 'Pair' }, 0, 1, 'meta'); update('relabel', {}, 1, 2, '(concat("ID:", asString(fst(p))), snd(p))');
  update('markFragile', {}, 2, 3, '(fst(p), true)'); update('dispatch', {}, 3, 4, 'p'); update('deliver', {}, 4, 5, 'p');
  update('returnToSender', {}, 5, 6, '(concat(asString(fst(p)), ":RETURN"), snd(p))'); update('reset', {}, 6, 0, '("", false)');
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
function quota() {
  const b = builder(); b.place('available', 'Nat', [10]); b.place('held', 'Nat', [0]); b.place('eligible', 'Bool', [], true); b.place('ack', 'Bool', [], true); b.place('free', 'Nat', [], true); b.place('reserved', 'Nat', [], true);
  b.rule('reserve', 'reserve', { n: 'Nat' }, 'n > 0 and n <= free', [['available', 'free'], ['held', 'h']], [['available', 'free - n'], ['held', 'h + n'], ['eligible', 'n > 0 and (n < 4 or n == 7)']]);
  b.rule('release', 'release', { n: 'Nat' }, 'n > 0 and n <= h', [['available', 'free'], ['held', 'h']], [['available', 'free + n'], ['held', 'h - n'], ['ack', 'true']]);
  b.rule('audit', 'audit', {}, '', [['available', 'free'], ['held', 'h']], [['available', 'free'], ['held', 'h'], ['free', 'free'], ['reserved', 'h']]);
  const lines = ['pair reserve(n=n) => eligible(ok)', 'pair audit() => free(10 - n), reserved(n)', 'pair release(n=3) => ack(true)', 'pair audit() => free(13 - n), reserved(n - 3)', 'pair reserve(n=4) => eligible(false)', 'pair audit() => free(9 - n), reserved(n + 1)', 'pair release(n=n) => ack(true)', 'pair audit() => free(9), reserved(1)', 'pair reserve(n=1) => eligible(true)', 'pair audit() => free(8), reserved(2)', 'pair release(n=2) => ack(true)', 'pair audit() => free(10), reserved(0)', 'pair reserve(n=3) => eligible(true)', 'pair audit() => free(7), reserved(3)', 'pair release(n=3) => ack(true)', 'pair audit() => free(10), reserved(0)'];
  b.net.testIntentions = [intention('quota', 'Resource quota — whole-sequence feasibility (16 pairs)', `operation priority(Nat): Bool
rule small(n: Nat): priority(n) = true if n > 0 and n < 4
rule special(n: Nat): priority(n) = true if n == 7
rule ordinary(n: Nat): priority(n) = false if n >= 4 and n != 7`, 'n: Nat', 'n', 'priority', 'n > 0 and n <= 8', cases('n: Nat, ok: Bool', 'n', 'ok', lines))];
  return b.net;
}
function kits() {
  const b = builder(); b.place('stock', 'Pair', [pairValue('bolt', true), pairValue('bolt', true)]); b.place('loan', 'Pair', []); b.place('product', 'Pair', []); b.place('idle', 'Bool', [true]);
  b.place('ack', 'Bool', [], true); b.place('parts', 'Pair', [], true); b.place('kit', 'Pair', [], true);
  b.rule('take', 'take', {}, '', [['stock', 'part'], ['stock', 'part'], ['idle', 'ready']], [['loan', 'part'], ['loan', 'part'], ['ack', 'ready']]);
  b.rule('inspectLoan', 'inspectLoan', {}, '', [['loan', 'part'], ['loan', 'part']], [['loan', 'part'], ['loan', 'part'], ['parts', 'part'], ['parts', 'part']]);
  b.rule('assemble', 'assemble', { recyclable: 'Bool' }, '', [['loan', 'part'], ['loan', 'part']], [['product', '("kit", recyclable)'], ['ack', 'true']]);
  b.rule('inspectProduct', 'inspectProduct', {}, '', [['product', 'p']], [['product', 'p'], ['kit', 'p']]);
  b.rule('disassemble', 'disassemble', {}, '', [['product', 'p']], [['loan', '("bolt", true)'], ['loan', '("bolt", true)'], ['ack', 'true']]);
  b.rule('returnParts', 'returnParts', {}, '', [['loan', 'part'], ['loan', 'part']], [['stock', 'part'], ['stock', 'part'], ['idle', 'true'], ['ack', 'true']]);
  const cycle = ['pair take() => ack(true)', 'pair inspectLoan() => parts(("bolt", true)), parts(("bolt", true))', 'pair assemble(recyclable=b) => ack(true)', 'pair inspectProduct() => kit(("kit", b))', 'pair disassemble() => ack(true)', 'pair returnParts() => ack(true)'];
  b.net.testIntentions = [intention('kits', 'Assembly kits — two equal occurrences, three cycles (18 pairs)', `operation recycling(Bool): Bool
rule disposable(): recycling(false) = false
rule reusable(): recycling(true) = true`, 'b: Bool', 'b', 'recycling', '', cases('b: Bool', 'b', 'b', [...cycle, ...cycle, ...cycle]))];
  return b.net;
}
function journal() {
  const b = builder(); b.place('current', 'Int', [0]); b.place('journal', 'List', [[]]); b.place('label', 'String', ['sensor']);
  b.place('alarm', 'Bool', [], true); b.place('records', 'List', [], true); b.place('source', 'String', [], true);
  b.rule('record', 'record', { delta: 'Int', armed: 'Bool' }, 'delta >= -2 and delta <= 2 and delta != 0', [['current', 'v'], ['journal', 'xs']], [['current', 'v + delta'], ['journal', 'append(xs, (v + delta, armed))'], ['alarm', 'armed and delta > 0']]);
  b.rule('read', 'read', {}, '', [['journal', 'xs'], ['label', 's']], [['journal', 'xs'], ['label', 's'], ['records', 'xs'], ['source', 's']]);
  const lines = [];
  for (let i = 1; i <= 10; i++) lines.push('pair record(delta=d, armed=b) => alarm(a)', `pair read() => records([${Array.from({ length: i }, (_, k) => `(${k + 1} * d, b)`).join(', ')}]), source("sensor")`);
  b.net.testIntentions = [intention('journal', 'Sensor journal — ten cumulative readings (20 pairs)', `operation alarmFor(Int, Bool): Bool
rule fallingQuiet(d: Int): alarmFor(d, false) = false if d < 0
rule fallingArmed(d: Int): alarmFor(d, true) = false if d < 0
rule risingQuiet(d: Int): alarmFor(d, false) = false if d > 0
rule risingArmed(d: Int): alarmFor(d, true) = true if d > 0`, 'd: Int, b: Bool', 'd, b', 'alarmFor', 'd >= -2 and d <= 2 and d != 0', cases('d: Int, b: Bool, a: Bool', 'd, b', 'a', lines))];
  return b.net;
}

export const exerciseScenarios = [
  { id: 'thermostat', name: 'Thermostat', depth: 2, classes: 3, types: 'Int', description: 'Signed adjustments: below, equal to, and above zero.', build: thermostat, mutants: [
    mutation('wrong-direction', 'Wrong cooling direction', 'Cooling adds the opposite adjustment.', changedOutput('cold', 'temperature', 't - delta')),
    mutation('wrong-initial', 'Wrong initial temperature', 'Starts at 21 instead of 20.', changedMarking('temperature', [21])),
  ] },
  { id: 'door', name: 'Door interlock', depth: 4, classes: 4, types: 'Bool, Pair', description: 'Four permission/obstruction combinations, followed by reset.', build: door, mutants: [
    mutation('ignore-jam', 'Ignores obstruction', 'The access response ignores the jammed flag.', changedOutput('attempt', 'access', 'asBool(fst(s))')),
    mutation('stuck-open', 'Reset leaves door open', 'Reset preserves the open state.', changedOutput('reset', 'opened', 'old')),
  ] },
  { id: 'tickets', name: 'Ticket booklet', depth: 6, classes: 2, types: 'Nat', description: 'Two uses distinguish exhaustion from remaining tickets.', build: tickets, mutants: [
    mutation('free-use', 'Use does not debit', 'A use leaves the counter unchanged.', changedOutput('use', 'remaining', 'n')),
    mutation('extra-ticket', 'Issues an extra ticket', 'The booklet starts with n + 1 tickets.', changedOutput('issue', 'remaining', 'n + 1')),
  ] },
  { id: 'labels', name: 'Label editor', depth: 8, classes: 3, types: 'String, Bool', description: 'Empty, short and long labels; prefix, suffix, and clear.', build: labels, mutants: [
    mutation('wrong-prefix', 'Wrong prefix', 'Uses @ instead of #.', changedOutput('prefix', 'label', 'concat("@", s)')),
    mutation('stale-clear', 'Clear keeps text', 'Clearing leaves the decorated label behind.', changedOutput('clear', 'label', 's')),
  ] },
  { id: 'coordinates', name: 'Coordinate cursor', depth: 10, classes: 4, types: 'Pair, Int', description: 'Four sign regions; translations, reflection, and reset.', build: coordinates, mutants: [
    mutation('swapped-axes', 'Swapped movement axes', 'Applies dy to x and dx to y.', changedOutput('move', 'position', '(asInt(fst(p)) + dy, asInt(snd(p)) + dx)')),
    mutation('bad-origin', 'Wrong reset origin', 'Reset goes to (1, 0).', changedOutput('reset', 'position', '(1, 0)')),
  ] },
  { id: 'queue', name: 'FIFO queue', depth: 12, classes: 3, types: 'List, Int', description: 'Empty, one-item and two-item integer seeds; enqueue and dequeue.', build: queue, mutants: [
    mutation('prepend', 'Enqueues at the front', 'Insertion uses prepend instead of append.', changedOutput('enqueue', 'queue', '[n | xs]')),
    mutation('no-removal', 'Dequeue keeps head', 'Reports the correct removed item but leaves it in the queue.', changedOutput('dequeue', 'queue', 'xs')),
  ] },
  { id: 'parcel', name: 'Parcel lifecycle', depth: 14, classes: 4, types: 'Pair, String, Bool, Nat', description: 'Empty/named × regular/fragile metadata through seven lifecycle stages.', build: parcel, mutants: [
    mutation('not-fragile', 'Loses fragile flag', 'Mark-fragile stores false.', changedOutput('markFragile', 'parcel', '(fst(p), false)')),
    mutation('no-return-label', 'Missing return label', 'Return-to-sender preserves the old label.', changedOutput('returnToSender', 'parcel', 'p')),
  ] },
  { id: 'quota', name: 'Resource quota', depth: 16, classes: 3, types: 'Nat, Bool', description: 'Repeated reservations/releases; a later release forces n ≥ 3.', build: quota, mutants: [
    mutation('lost-release', 'Release loses capacity', 'Release reduces held resources but does not restore free capacity.', changedOutput('release', 'available', 'free')),
    mutation('missing-special', 'Missing priority boundary', 'Priority forgets the n = 7 alternative.', changedOutput('reserve', 'eligible', 'n > 0 and n < 4')),
  ] },
  { id: 'kits', name: 'Assembly kits', depth: 18, classes: 2, types: 'Pair, String, Bool', description: 'Three cycles consume two distinct equal tokens, respecting shared bindings.', build: kits, mutants: [
    mutation('missing-part', 'Only one initial part', 'The initial marking lacks the second equal part.', changedMarking('stock', [pairValue('bolt', true)])),
    mutation('wrong-material', 'Wrong recycling flag', 'Assembly always reports a disposable kit.', changedOutput('assemble', 'product', '("kit", false)')),
  ] },
  { id: 'journal', name: 'Sensor journal', depth: 20, classes: 4, types: 'List, Pair, Int, Bool, String', description: 'Ten record/read rounds; growing lists of cumulative readings and alarm flags.', build: journal, mutants: [
    mutation('reverse-log', 'Newest record first', 'Prepends each new reading instead of appending.', changedOutput('record', 'journal', '[(v + delta, armed) | xs]')),
    mutation('no-accumulation', 'Forgets accumulated value', 'The stored sensor value becomes delta instead of v + delta.', changedOutput('record', 'current', 'delta')),
  ] },
];
export const exerciseExamples = exerciseScenarios.flatMap(s => [
  { filename: `exercise-${s.id}-reference`, displayName: `${s.name} — Reference (${s.depth} pairs)`, description: `${s.types}. ${s.description}` },
  ...s.mutants.map(m => ({ filename: `exercise-${s.id}-${m.id}`, displayName: `${s.name} — Mutant: ${m.label}`, description: m.description })),
]);
export function createExerciseExample(filename) {
  const scenario = exerciseScenarios.find(s => filename === `exercise-${s.id}-reference` || s.mutants.some(m => filename === `exercise-${s.id}-${m.id}`));
  if (!scenario) throw new Error(`Unknown SATEL exercise: ${filename}`);
  const mutant = scenario.mutants.find(m => filename === `exercise-${scenario.id}-${m.id}`);
  const net = scenario.build();
  mutant?.apply(net);
  for (const entry of net.testIntentions) entry.description = `${scenario.description} ${scenario.classes} algebraic classes; ${scenario.depth} stimulation/observation pairs per test.`;
  net.satelExample = { id: filename, name: `${scenario.name} ${mutant ? `mutant — ${mutant.label}` : `reference — ${scenario.depth} pairs`}`, role: mutant ? 'mutant' : 'reference', description: mutant?.description || scenario.description };
  return net;
}
