# Recursive ADT unfolding examples

These are **solver-level examples**, alongside the existing scale APN generators.
They exercise constructor/conditional-equation class derivation, not APN execution.
Custom `Items`/`Index` sorts are not being added as executable method/place types.
The existing GUI APNs and their PNML files remain unchanged.

`models.js` is the source of truth for three editable equation specifications:

- `membership`: list membership; classes distinguish the first matching position
  or reaching the end without a match. A hit leaves the unused tail unconstrained.
- `lookup`: binary-search-style tree traversal; equations distinguish equal,
  smaller and larger keys. The benchmark does **not** impose a globally sorted
  tree invariant: it measures the specified traversal on free constructor trees.
- `repeated`: `twice(xs) = total(xs) + total(xs)`; two calls share the same symbolic
  list, exercising repeated work and constructor bindings across calls.

`recursiveDecomposition({ kind, depth })` starts with an unknown data structure.
For membership only, adding `size` supplies a list spine of that length with
symbolic integer elements. This distinguishes solving over a known shape from
enumerating unknown shapes.

`depth` is the maximum number of defining-equation applications along a narrowing
branch, **not** tree height, APN sequence length, or the number of generated tests.
For example, evaluating both calls in `twice` consumes the same branch allowance.
A branch stopped at the allowance is retained as unresolved.

From `petri-net-app`, run the full experiment:

```sh
node tools/node/benchmarks/run-scale.js --cases tools/node/benchmarks/increment-29-cases.json --runs 3 --hard-timeout-ms 45000 --out ../docs/satel/performance/increment-29-recursive-unfolding.json
```

The configuration also reuses the existing list/tree total benchmarks from
`tools/node/benchmarks/solver-cases.js`, with cache-disabled and resource-limit
controls. See [the increment report](../../../../../docs/satel/increment-29-recursive-unfolding.md)
for timing definitions, measurements and limitations.
