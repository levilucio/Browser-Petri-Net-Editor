# Increment 46: recursive WorkLog depth and finite coverage audit

The HR SUT, existing intentions, source equations and business transitions remain
unchanged. The new experiment increases WorkLog length from one to five over a
fixed 12-employee, five-slot marking. A single generic benchmark protocol records
each entry, observes acknowledgment gates, and finally observes the audit count.
It isolates depth from the original two-entry intention's many scenario cases.
It does not replace that intention or change its 64-test regression suite.

## Measured problem and changes

Initial measurements generated all 125 length-three regions within a ten-second
algebra budget, but some pairwise disjointness obligations were still unknown.
At lengths four and five, the budget expired during unfolding. Building large,
renamed solver queries for the remaining overlap pairs then took another 11–13
seconds, although those queries could no longer be sent to the solver.

Two conservative changes address those costs:

1. `LiteralDisjointness.js` extracts necessary scalar equalities from top-level
   conjunctions and associates them with their positions in input patterns.
   Equal inputs have equal fields at an aligned free-constructor path. If two
   regions require different constants at that path, their intersection is empty.
   Only declared free constructors and scalar literals are used. Existential
   variables absent from input patterns, operation calls, arithmetic patterns,
   disjunctions and unsupported forms remain opaque. Constructor names and
   argument positions are part of the path; matching variable names alone does
   not identify independently scoped values. Results are not used as evidence.
2. After the shared derivation deadline, overlap pairs are recorded directly as
   unknown. The implementation avoids renaming variables and constructing queries
   that cannot run. Every pair remains an explicit obligation. Cancellation is
   checked, and neither disjointness nor coverage is inferred from a timeout.

`literalDisjointness: false` and `deferExpiredOverlapQueries: false` restore the
previous overlap paths for controlled comparison. New profile counters distinguish
literal certificates, deadline-deferred pairs and solver/ancestor certificates.
The optimization affects overlap analysis only; equation unfolding, feasibility,
branch limits, representative choice and suite-admission conditions remain intact.

## Independent finite check

`depth-audit.mjs` imports no SATEL evaluator, matcher, solver or unfolding code.
Its small interpreter tests each returned region against explicitly enumerated
inputs; a procedural recursive function independently calculates the required
review count and rejects invalid work kinds or durations. Every emitted witness
must belong to its region and have the correct result.

For lengths one through three, each entry ranges over kinds 0–5 and durations
14, 15, 720 and 721 minutes. This covers valid kinds, an invalid kind, both valid
duration boundaries and values immediately outside them. At length three the
Cartesian product contains 13,824 inputs, 1,000 of which are defined by the fixture.
For lengths four and five the smaller audit enumerates all kind vectors 0–4 at
15 minutes per entry. These scopes are explicit in every audit record.

Six adversarial self-tests remove and duplicate regions, broaden a boundary,
corrupt results and witnesses, and inject unsupported constraints. The checker
must expose each fault. It is an independent finite oracle for this fixture, not
a replacement generic algebraic solver or a proof over all natural numbers.

## Meaning of the result

The experiment reports returned regions, unresolved frontier branches, unknown
intersections, executable representatives and actual admission separately.
Replaying every returned candidate does not discharge an unresolved frontier.
Length-four/five runs with a longer deadline expose the hard 2,048-branch cap;
partial suites are rejected even when all their returned regions are disjoint
and every returned representative passes concrete replay.

The original engine `coverage: not-proved` status is unchanged. No finite audit
is promoted to thesis-level subuniformity coverage or representative adequacy.
In particular, equal `reviews` outputs do not justify merging work-type regions:
the HR workflows can distinguish those work types.

See [measurements and reproduction](../../experiments/hr-management-sut/DEPTH_RESULTS.md)
and the [standalone guide](../../experiments/hr-management-sut/README.md).
