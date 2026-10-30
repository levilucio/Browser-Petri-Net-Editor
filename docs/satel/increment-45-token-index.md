# Increment 45: guard-derived token indexes

The HR specification, nine intentions, concrete syntax, frozen test pairs and
SUT stay fixed. This increment targets executable token binding, not recursive
ADT decomposition. The generic reference remains four places and 21 transitions.

## Selection rule and scope

`TokenIndex.js` recognizes a necessary scalar equality in a top-level guard
conjunction. One side must be the next input variable or a chain of supported
built-in Pair projections/Any casts from that variable. The other side must
reduce to a known number, Boolean or string using already bound inputs. No HR
identifiers, field offsets, employee identities or business rules are hardcoded.

For a lookup key k, candidates are the matching-key bucket **plus every token
whose key cannot be established**. Symbolic lookup keys, unsupported predicates,
wrong casts and undefined projections fall back or remain candidates. The full
guard, repeated-variable equalities, occurrence-consumption checks, output checks
and solver constraints still apply. No representative is fixed to an arbitrary
witness to obtain a lookup key.

Concrete indexing considers only the first unbound conjunct after a prefix that
evaluates to true. This preserves ordered short-circuit evaluation and errors;
a later equality cannot hide an earlier partial computation. Symbolic indexing
uses necessary conjunct equalities, consistently with existing ground-false
symbolic pruning. An unknown reduction never establishes exclusion.

Refusal evidence reports indexed-out token occurrences separately from complete
bindings and ground-false binding prefixes; these are different counts.

The local preservation argument is: an excluded token has a defined scalar key
different from the required defined key, so its necessary equality is false.
For positive execution it cannot enable a successor. For refusal, negating this
false enabling condition contributes true to the universal conjunction. All
unknown cases remain in the search. This argument is scoped to these selectors;
it is not a proof of general thesis subuniformity or APN equivalence.

## Caches, bounds and measurement

Indexes are local to a concrete enumeration or symbolic selection invocation.
Immutable marking arrays key the bucket cache. Token objects key projection
caches, so unchanged objects shared by later symbolic markings reuse their keys.
New arrays and replacement tokens cannot reuse stale bucket positions. Candidates
retain original occurrence indices/order and all duplicates; the existing
binding algorithm handles equivalence and multiplicity. The initial symbolic
marking is now shared across region searches within one invocation.

`useTokenIndex: false` restores exhaustive candidate scanning for comparisons
in concrete methods, executable sequences and refusal constraints. The separate
symbolic HML rule-effect engine is unchanged.
`profileSelection: true` reports candidate scans, guard checks/time, output
projection time, marking-copy time, prefix/final solver time, and index builds,
lookups, scanned occurrences, exclusions, fallbacks and projection-cache hits.
The timers are partial measurements, not an exhaustive partition of elapsed time.
Index scans check cancellation and deadlines. Bounds still report unresolved
searches; an interrupted index is never accepted as a complete candidate set.

Search-node counts exclude index metadata scans. `indexTokens` counts those
scans separately and may exceed exhaustive candidate scans: constructing a bucket
still visits tokens, but reuses cheap field keys instead of re-evaluating entire
guards. Memory and preprocessing remain dependent on marking size. Symbolic keys
or predicates without usable equalities can still require exhaustive search.

## Evidence

See [the experiment results](../../experiments/hr-management-sut/INDEX_RESULTS.md)
for measured configurations, frozen-suite comparisons and validation. The
existing generic and expanded measurements are retained as historical results.
The selected WorkLog length remains two: this does not resolve the separate
branch/overlap explosion for deeper recursive ADT unfolding. Completing one
representative for each of 25 computed regions does not establish thesis-level
coverage, representative adequacy, or coverage of every employee in the SUT.
