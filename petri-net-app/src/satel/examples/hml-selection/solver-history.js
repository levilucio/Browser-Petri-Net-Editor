import { builder } from '../exercises/builder.js';
import { modal } from '../nondeterminism/editor.js';

// Existing hml-adt-selection regression scenarios, ordered to expose the effect
// of earlier queries on the shared Z3 context. These are ordinary executable APNs.
export function solverHistoryExamples() {
  return [
    ['String', 'length(x) >= 2 and isSubstringOf("ab", x)', 'substring(concat(x, "!"), -2, 2)'],
    ['List', 'length(x) == 0 or asInt(head(x)) >= 2', 'append(tail(x), true)'],
    ['Pair', 'asInt(fst(x)) >= 2 and asBool(snd(x))', '(asInt(fst(x)) + 1, false)']
  ].map(([sort, guard, output]) => {
    const b = builder(); b.place('out', sort, [], true);
    b.rule('step', 'step', { x: sort }, guard, [], [['out', output]]);
    return { sort, net: b.net, formula: modal('diamond', 'step', null, { op: 'true' }, { x: '$x' }) };
  });
}
