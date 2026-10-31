# Preserved baseline failure: initial-slot-ownership

Two unseeded baseline divergences: the SUT accepts creation using unused IDs already in the bounded APN marking, while the APN refuses creation by a different tenant/order than its preassigned slot labels. Cause under investigation; both source implementations preserved before correction.

Captured before corrective edits. Initial classification is unresolved.

Reproduce from the captured source:

```sh
node experiments/warehouse-sut/experiments/allocation-check.mjs
```

`manifest.json` identifies source hashes and the parent commit; the snapshot
contains the uncommitted source that actually failed, not just that parent.

## Diagnosis and repair

The discrepancy was discovered during review after all original 60 generated
cases passed both transports. Both calls use IDs present in the bounded marking;
this is not simply a call outside the finite identifier universe.

The original model assigned order slot 1001 to tenant 1 and line slot 10021 to
order 1002 *before either record existed*. The independent SUT assigns ownership
at creation, consistent with normal object creation and its database schema.
No business requirement prescribed an owner for an unused number. The APN had
introduced an accidental restriction from its fixture naming convention.

Classification: **unseeded specification/model-abstraction defect**, not a proven
application implementation defect. The entire pre-fix SUT is nevertheless kept
in the snapshot, as requested, alongside the faulty APN and failing traces.
No seeded mutation was involved. No backend or frontend fix was needed.

Repair: unused orders/lines now have zero ownership; `openOrder` sets tenant and
owner, `addLine` sets order ownership, and `removeLine` frees the ID. Existing
records retain all tenant/owner checks. Two additional generated lifecycle tests
cover cross-convention creation and removal/reassignment. Transition count stays
42. `CONTRACT.md` now states this allocation rule explicitly. The snapshot's
contract remains unchanged, preserving the original ambiguity and evidence.

The unchanged source-hashed failure report shows mismatches at step 1 and step 2,
respectively. Restore `snapshot/` into a separate checkout of its parent commit
and run the recorded command to reproduce both. The current working version of
that command is expected to pass after repair.
