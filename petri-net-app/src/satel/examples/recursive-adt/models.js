import { parseSymbolicSource } from '../../core/SymbolicSource.js';
import { prepareAlgebra } from '../../core/GenericSubuniformity.js';

// Solver-level examples: these custom sorts are not executable APN place types.
// Keep the supplied spine and unknown-shape goals distinct in benchmark reports.
export const recursiveSources = {
  membership: `constructor End(): Items
constructor More(Int, Items): Items
operation member(Int, Items): Bool
rule member.end(key: Int): member(key, End()) = false
rule member.hit(key: Int, head: Int, tail: Items): member(key, More(head, tail)) = true if key == head
rule member.next(key: Int, head: Int, tail: Items): member(key, More(head, tail)) = member(key, tail) if key != head`,
  lookup: `constructor Empty(): Index
constructor Node(Int, Index, Index): Index
operation contains(Int, Index): Bool
rule lookup.empty(key: Int): contains(key, Empty()) = false
rule lookup.hit(key: Int, pivot: Int, left: Index, right: Index): contains(key, Node(pivot, left, right)) = true if key == pivot
rule lookup.left(key: Int, pivot: Int, left: Index, right: Index): contains(key, Node(pivot, left, right)) = contains(key, left) if key < pivot
rule lookup.right(key: Int, pivot: Int, left: Index, right: Index): contains(key, Node(pivot, left, right)) = contains(key, right) if key > pivot`,
  repeated: `constructor End(): Items
constructor More(Int, Items): Items
operation total(Items): Int
operation twice(Items): Int
rule total.end(): total(End()) = 0
rule total.more(head: Int, tail: Items): total(More(head, tail)) = head + total(tail)
rule twice.def(xs: Items): twice(xs) = total(xs) + total(xs)`
};

export function recursiveDecomposition({ kind, depth, size }) {
  if (!recursiveSources[kind]) throw new Error(`Unknown recursive ADT example: ${kind}`);
  const repeated = kind === 'repeated';
  const variables = repeated ? { data: 'Items' } : { key: 'Int', data: kind === 'lookup' ? 'Index' : 'Items' };
  let data = { var: 'data' };
  if (size !== undefined) {
    if (kind !== 'membership' || !Number.isInteger(size) || size < 0) throw new Error('Fixed spine requires membership and a nonnegative integer size');
    delete variables.data;
    data = { ctor: 'End', args: [] };
    for (let i = size - 1; i >= 0; i--) {
      variables[`item${i}`] = 'Int';
      data = { ctor: 'More', args: [{ var: `item${i}` }, data] };
    }
  }
  return {
    algebra: prepareAlgebra(parseSymbolicSource(recursiveSources[kind])), variables,
    operation: repeated ? 'twice' : kind === 'lookup' ? 'contains' : 'member',
    args: repeated ? [data] : [{ var: 'key' }, data], conditions: [], maxDepth: depth
  };
}
