export const compoundGuard = 'x > 0 and (x < 5 or x == 10)';
export function createGuardIntention() {
  return { id: 'compound-guard', name: 'Shared x — compound guard classes', kind: 'symbolic',
    description: 'One variable shared across three guard terms; disjoint true/false regions before oracle execution.',
    symbolic: { source: '', goalKind: 'guard', guardText: compoundGuard, variablesText: 'x: Int', maxDepth: 4,
      protocolSource: `case accepted(x: Int):
inputs x
result true
pair check(x=x) => accepted(1)
case refused(x: Int):
inputs x
result false
pair check(x=x) => accepted(0)` } };
}
export function createCompoundGuardExample(mutant = false) {
  const guard = mutant ? 'x > 0 and x < 5' : compoundGuard;
  const arc = (source, target, binding, sourceType, targetType) => ({ id: `${source}-${target}`, source, target, binding, sourceType, targetType, type: `${sourceType}-to-${targetType}`, weight: 1 });
  return { mode: 'algebraic',
    places: [ { id: 'ready', label: 'ready', sort: 'Int', io_type: 'internal', valueTokens: [1], tokens: 1, x: 200, y: 280 },
      { id: 'accepted', label: 'accepted', sort: 'Int', io_type: 'output', valueTokens: [], tokens: 0, x: 640, y: 280 } ],
    transitions: ['accept', 'refuse'].map((id, i) => ({ id, label: i ? 'no' : 'yes', x: 420, y: 170 + i * 220,
      guard: i ? `not (${guard})` : guard, method: { name: 'check', parameters: [{ name: 'x', sort: 'Int' }] } })),
    arcs: ['accept', 'refuse'].flatMap((id, i) => [arc('ready', id, 'r', 'place', 'transition'), arc(id, 'ready', 'r', 'transition', 'place'), arc(id, 'accepted', String(1 - i), 'transition', 'place')]),
    testIntentions: [createGuardIntention()],
    satelExample: { id: mutant ? 'compound-guard-mutant' : 'compound-guard', name: mutant ? 'Compound guard — missing x = 10 mutant' : 'Compound guard reference', role: mutant ? 'mutant' : 'reference',
      description: 'check(x) preserves the initial ready token and emits 1 or 0. A single x determines every guard term.' } };
}
export function createBuiltinTypesExample() {
  const intention = (id, name, symbolic) => ({ id, name, kind: 'symbolic', symbolic: { source: '', maxDepth: 8, protocolSource: '', conditionsText: '', ...symbolic } });
  return { mode: 'algebraic', places: [], transitions: [], arcs: [],
    testIntentions: [
      intention('builtin-list', 'List — head constructor cases (empty is undefined)', { operation: 'head', variablesText: 'xs: List', argsText: 'xs' }),
      intention('builtin-pair', 'Pair — first component', { operation: 'fst', variablesText: 'p: Pair', argsText: 'p' }),
      intention('builtin-string', 'String — length and substring guard', { goalKind: 'guard', variablesText: 's: String', guardText: 'length(s) > 0 and isSubstringOf("a", s)' }),
      intention('builtin-bool', 'Bool — shared logical variables', { goalKind: 'guard', variablesText: 'a: Bool, b: Bool', guardText: 'a and (b or not a)' }),
      intention('builtin-int', 'Int — multiplication guard', { goalKind: 'guard', variablesText: 'x: Int', guardText: 'x * x <= 9 and x != 0' }),
    ], satelExample: { id: 'builtin-types', name: 'Built-in types — symbolic classes', role: 'derivation', description: 'Derive typed classes before defining an APN method protocol. Recursive and undefined branches remain visible.' } };
}
