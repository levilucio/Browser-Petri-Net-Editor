/** Canonical equations for the editor's built-in ADTs. Names are private to the compiler. */
const v = name => ({ var: name });
const c = (name, ...args) => ({ ctor: name, args });
const f = (name, ...args) => ({ call: name, args });
const op = (name, left, right) => ({ op: name, left, ...(right === undefined ? {} : { right }) });
export const NIL = '_ListNil', CONS = '_ListCons', PAIR = '_Pair';
export const ANY_TAGS = { Int: '_AnyInt', Bool: '_AnyBool', String: '_AnyString', List: '_AnyList', Pair: '_AnyPair' };
export const builtinNames = new Set(['length', 'concat', 'head', 'tail', 'append', 'sublist', 'isSublistOf', 'fst', 'snd', 'substring', 'isSubstringOf', 'asInt', 'asBool', 'asString', 'asList', 'asPair']);
export function addBuiltins(algebra) {
  if (algebra.builtins) return algebra;
  const constructors = { ...algebra.constructors }, operations = { ...algebra.operations };
  const ctor = (name, parameters, result) => { if (constructors[name] || operations[name]) throw new Error(`Reserved built-in name: ${name}`); constructors[name] = { parameters, result, builtin: true }; };
  ctor(NIL, [], 'List'); ctor(CONS, ['Any', 'List'], 'List'); ctor(PAIR, ['Any', 'Any'], 'Pair');
  const tags = { ...ANY_TAGS };
  for (const sort of new Set(Object.values(algebra.constructors).map(s => s.result))) if (!tags[sort]) tags[sort] = `_AnyCustom_${sort}`;
  for (const [sort, name] of Object.entries(tags)) ctor(name, [sort], 'Any');
  const define = (name, parameters, result, rules, primitive) => {
    if (operations[name] || constructors[name]) throw new Error(`Reserved built-in name: ${name}`);
    operations[name] = { parameters, result, rules, primitive, builtin: true };
  };
  const rule = (id, variables, patterns, result, conditions = []) => ({ id, variables, patterns, result, conditions });
  const nil = c(NIL), cons = (h, t) => c(CONS, h, t);
  const xs = v('xs'), ys = v('ys'), h = v('h'), t = v('t'), a = v('a'), b = v('b'), n = v('n');
  define('_listLength', ['List'], 'Int', [
    rule('List.length.empty', {}, [nil], 0),
    rule('List.length.cons', { h: 'Any', t: 'List' }, [cons(h, t)], op('+', 1, f('_listLength', t))),
  ]);
  define('_listConcat', ['List', 'List'], 'List', [
    rule('List.concat.empty', { ys: 'List' }, [nil, ys], ys),
    rule('List.concat.cons', { h: 'Any', t: 'List', ys: 'List' }, [cons(h, t), ys], cons(h, f('_listConcat', t, ys))),
  ]);
  define('_listHead', ['List'], 'Any', [
    rule('List.head.empty', {}, [nil], { undefined: 'head requires a non-empty list' }),
    rule('List.head.cons', { h: 'Any', t: 'List' }, [cons(h, t)], h),
  ]);
  define('_listTail', ['List'], 'List', [
    rule('List.tail.empty', {}, [nil], nil), rule('List.tail.cons', { h: 'Any', t: 'List' }, [cons(h, t)], t),
  ]);
  define('_listAppend', ['List', 'Any'], 'List', [
    rule('List.append.empty', { a: 'Any' }, [nil, a], cons(a, nil)),
    rule('List.append.cons', { h: 'Any', t: 'List', a: 'Any' }, [cons(h, t), a], cons(h, f('_listAppend', t, a))),
  ]);
  define('_listPrefix', ['List', 'List'], 'Bool', [
    rule('List.prefix.empty', { xs: 'List' }, [nil, xs], true),
    rule('List.prefix.noTarget', { h: 'Any', t: 'List' }, [cons(h, t), nil], false),
    rule('List.prefix.match', { a: 'Any', b: 'Any', xs: 'List', ys: 'List' }, [cons(a, xs), cons(b, ys)], f('_listPrefix', xs, ys), [op('==', a, b)]),
    rule('List.prefix.mismatch', { a: 'Any', b: 'Any', xs: 'List', ys: 'List' }, [cons(a, xs), cons(b, ys)], false, [op('!=', a, b)]),
  ]);
  define('_listContains', ['List', 'List'], 'Bool', [
    rule('List.contains.empty', { xs: 'List' }, [nil, xs], true),
    rule('List.contains.noTarget', { h: 'Any', t: 'List' }, [cons(h, t), nil], false),
    rule('List.contains.here', { a: 'Any', b: 'Any', xs: 'List', ys: 'List' }, [cons(a, xs), cons(b, ys)], true, [f('_listPrefix', cons(a, xs), cons(b, ys))]),
    rule('List.contains.later', { a: 'Any', b: 'Any', xs: 'List', ys: 'List' }, [cons(a, xs), cons(b, ys)], f('_listContains', cons(a, xs), ys), [op('not', f('_listPrefix', cons(a, xs), cons(b, ys)))]),
  ]);
  // Slice indices are normalized exactly like Array.slice(start, start + length).
  define('_listSublist', ['List', 'Int', 'Int'], 'List', [rule('List.sublist', { xs: 'List', a: 'Int', b: 'Int' }, [xs, a, b],
    f('_listSlice', xs, f('_sliceIndex', a, f('_listLength', xs)), f('_sliceIndex', op('+', a, b), f('_listLength', xs))))]);
  define('_listSlice', ['List', 'Int', 'Int'], 'List', [
    rule('List.slice.empty', { a: 'Int', b: 'Int' }, [nil, a, b], nil),
    rule('List.slice.done', { h: 'Any', t: 'List', a: 'Int', b: 'Int' }, [cons(h, t), a, b], nil, [op('<=', b, 0)]),
    rule('List.slice.skip', { h: 'Any', t: 'List', a: 'Int', b: 'Int' }, [cons(h, t), a, b], f('_listSlice', t, op('-', a, 1), op('-', b, 1)), [op('>', b, 0), op('>', a, 0)]),
    rule('List.slice.take', { h: 'Any', t: 'List', a: 'Int', b: 'Int' }, [cons(h, t), a, b], cons(h, f('_listSlice', t, 0, op('-', b, 1))), [op('>', b, 0), op('<=', a, 0)]),
  ]);
  define('_sliceIndex', ['Int', 'Int'], 'Int', [], 'sliceIndex');
  for (const [name, index] of [['fst', 0], ['snd', 1]]) define(`_pair_${name}`, ['Pair'], 'Any', [rule(`Pair.${name}`, { a: 'Any', b: 'Any' }, [c(PAIR, a, b)], index ? b : a)]);
  const primitives = { length: [['String'], 'Int'], concat: [['String', 'String'], 'String'], substring: [['String', 'Int', 'Int'], 'String'], isSubstringOf: [['String', 'String'], 'Bool'] };
  for (const [name, [parameters, result]] of Object.entries(primitives)) {
    const vars = Object.fromEntries(parameters.map((s, i) => [`p${i}`, s]));
    define(`_string_${name}_value`, parameters, result, [], name);
    define(`_string_${name}`, parameters, result, [rule(`String.${name}`, vars, parameters.map((_, i) => v(`p${i}`)), f(`_string_${name}_value`, ...parameters.map((_, i) => v(`p${i}`))))]);
  }
  // Explicit projections keep heterogeneous Any fields sound: other tags are undefined cases.
  for (const sort of ['Int', 'Bool', 'String', 'List', 'Pair']) define(`_as${sort}`, ['Any'], sort,
    Object.entries(tags).map(([s, tag]) => rule(`Any.as${sort}.${s}`, { a: s }, [c(tag, a)], s === sort ? a : { undefined: `as${sort} requires ${sort}, received ${s}` })));
  return { ...algebra, constructors, operations, builtins: true, anyTags: tags };
}
export function resolveBuiltin(name, args, sortOf) {
  if (!builtinNames.has(name)) throw new Error(`Unknown operation: ${name || '(empty)'}`);
  const sort = args.length ? sortOf(args[0]) : null;
  const arities = { length: 1, concat: 2, head: 1, tail: 1, append: 2, sublist: 3, isSublistOf: 2, fst: 1, snd: 1, substring: 3, isSubstringOf: 2, asInt: 1, asBool: 1, asString: 1, asList: 1, asPair: 1 };
  if (args.length !== arities[name]) throw new Error(`Wrong arity for ${name}`);
  if (name.startsWith('as')) return '_' + name;
  if (['fst', 'snd'].includes(name)) return `_pair_${name}`;
  if (['substring', 'isSubstringOf'].includes(name) || (['length', 'concat'].includes(name) && sort === 'String')) return `_string_${name}`;
  const list = { length: '_listLength', concat: '_listConcat', head: '_listHead', tail: '_listTail', append: '_listAppend', sublist: '_listSublist', isSublistOf: '_listContains' };
  if (list[name] && sort === 'List') return list[name];
  throw new Error(`No built-in overload of ${name} for ${sort}`);
}
export const builtinDisplay = name => ({ _listLength: 'length', _listConcat: 'concat', _listHead: 'head', _listTail: 'tail', _listAppend: 'append', _listSublist: 'sublist', _listContains: 'isSublistOf', _pair_fst: 'fst', _pair_snd: 'snd' })[name] || name.replace(/^_string_/, '').replace(/_value$/, '').replace(/^_as/, 'as');
