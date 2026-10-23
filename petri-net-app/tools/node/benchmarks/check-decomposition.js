// Independent finite evaluation of returned witnesses. Does not use the symbolic
// evaluator/unfolder and makes no assertion about unvisited inputs or coverage.
function items(xs) {
  const values = [];
  while (xs?.ctor === 'More') { values.push(xs.args[0]); xs = xs.args[1]; }
  if (xs?.ctor !== 'End') throw new Error('Malformed list witness');
  return values;
}
function treeTotal(t) {
  if (t?.ctor === 'Leaf') return t.args[0];
  if (t?.ctor === 'Fork') return treeTotal(t.args[0]) + treeTotal(t.args[1]);
  throw new Error('Malformed tree witness');
}
function lookup(key, t) {
  while (t?.ctor === 'Node') {
    if (key === t.args[0]) return true;
    t = t.args[key < t.args[0] ? 1 : 2];
  }
  if (t?.ctor !== 'Empty') throw new Error('Malformed index witness');
  return false;
}
export function checkDecompositionWitnesses(config, domains) {
  for (const d of domains) {
    const [first, second] = d.witnessArgs;
    let expected;
    switch (config.kind) {
      case 'list': expected = items(first).reduce((a, b) => a + b, 0); break;
      case 'tree': expected = treeTotal(first); break;
      case 'membership': expected = items(second).includes(first); break;
      case 'lookup': expected = lookup(first, second); break;
      case 'repeated': expected = 2 * items(first).reduce((a, b) => a + b, 0); break;
      default: throw new Error(`No independent evaluator for ${config.kind}`);
    }
    if (expected !== d.witnessResult) throw new Error(`Incorrect ${config.kind} witness result`);
  }
  return domains.length;
}
