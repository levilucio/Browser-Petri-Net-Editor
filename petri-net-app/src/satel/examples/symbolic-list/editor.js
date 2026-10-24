export const listSource = `constructor Nil() : NatList
constructor Cons(Nat, NatList) : NatList
operation member(Nat, NatList) : Bool

rule member.nil(x: Nat): member(x, Nil()) = false
rule member.head(x: Nat, y: Nat, ys: NatList): member(x, Cons(y, ys)) = true if x == y
rule member.tail(x: Nat, y: Nat, ys: NatList): member(x, Cons(y, ys)) = member(x, ys) if x != y`;

export function createSymbolicListIntention() {
  return { id: 'symbolic-list-membership', name: 'List membership — constructor and equation classes',
    description: 'Derive classes for member(x, xs). Unfinished recursive cases remain visible. This example has no APN method encoding.',
    kind: 'symbolic', symbolic: { source: listSource, operation: 'member', variablesText: 'x: Nat, xs: NatList', argsText: 'x, xs', conditionsText: '', maxDepth: 2, protocolSource: '' } };
}
export function createSymbolicListExample() {
  return { mode: 'algebraic', places: [], transitions: [], arcs: [],
    testIntentions: [createSymbolicListIntention()],
    satelExample: { id: 'symbolic-list', name: 'List membership — symbolic classes', role: 'derivation',
      description: 'Recursive NatList ADT exploration. No executable APN is declared; derive classes before defining a public method protocol.' } };
}
