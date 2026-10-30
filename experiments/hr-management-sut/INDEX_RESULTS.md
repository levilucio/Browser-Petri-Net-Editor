# Token indexing: HR selection follow-up

Recorded 30 October 2026. The generic HR APN, intentions, frozen tests and SUT
are unchanged. This experiment separates token-binding cost from recursive ADT
unfolding. Earlier pre-index results remain in [RESULTS.md](RESULTS.md).

## Results

The two configurations that previously exceeded a 60-second sequence budget both
complete all 25 WorkLog regions with a five-minute budget. Guard-derived indexing
then completes them within the original 60-second budget:

| Employees | Slots per record kind | Exhaustive scanning | Indexed scanning | Selected / unresolved |
| --- | ---: | ---: | ---: | ---: |
| 12 | 2 | — | 6.10 s | 25 / 0 |
| 120 | 2 | — | 6.08 s | 25 / 0 |
| 256 | 2 | 64.43 s | 6.44 s | 25 / 0 |
| 256 | 8 | 204.06 s | 6.34 s | 25 / 0 |

The paired large configurations improve by approximately **10× and 32×**.
Every run completes algebraic decomposition with 25 regions, no unresolved
branches or overlap unknowns, and reproduces exactly the same frozen test pairs.
No region is dropped as infeasible. These are single-trial observations, not
confidence intervals or guarantees for arbitrary APNs.

Each configuration ran in a fresh child, sequentially without other test/build/
campaign jobs. Z3 initialization is excluded; the elapsed column includes
algebraic derivation, executable selection and loading the frozen suite for
comparison, not admission or SUT replay.
Both modes use 10,000 sequence search visits and identical algebraic bounds.
Exhaustive runs have a 300-second sequence budget; indexed runs use 60 seconds.
The complete records, source hashes, runtime/CPU, counters and RSS snapshots are
in [index-comparison.json](results/index-comparison.json).

An initial profiled snapshot of the pre-index engine also completed the two
cases in 68.03 and 203.36 seconds. Its eight-slot run briefly overlapped a focused
4.2-second unit check; it is exploratory evidence, not the speedup comparison.
[index-long-baseline.json](results/index-long-baseline.json) preserves that fact.
The controlled comparison above reruns exhaustive scanning on the current engine
with `useTokenIndex: false`, including the same shared initial-marking setup.

## Where the time went

| Measurement, 256 employees | Exhaustive / 2 slots | Indexed / 2 slots | Exhaustive / 8 slots | Indexed / 8 slots |
| --- | ---: | ---: | ---: | ---: |
| Candidate token scans | 231,208 | 855 | 515,368 | 855 |
| Guard checks | 231,988 | 1,635 | 516,148 | 1,635 |
| Guard-check time | 56.04 s | 0.34 s | 192.84 s | 0.31 s |
| Index construction | — | 0.22 s | — | 0.40 s |
| Prefix solver time | 3.18 s | 2.60 s | 3.31 s | 2.46 s |
| Search visits | 2,832 | 2,420 | 2,832 | 2,420 |
| RSS after derivation | 412.5 MiB | 424.2 MiB | 450.2 MiB | 520.4 MiB |

Indexes still scan token occurrences when built: 249,344 and 565,760 across the
large indexed runs. Cached projections account for 247,555 and 562,435 of those
lookups. These cheap lookups replace repeated full guard evaluation; they are
reported separately from candidate scans and search visits. The RSS figures are
post-run snapshots, not peak memory. Index caching has a memory cost, particularly
in the eight-slot case. Timer categories do not exhaust all elapsed work.

The lookup derives a required field key from a guard equality and includes all
matching occurrences plus unknown/undefined-key occurrences. Unsupported or
symbolic lookup keys retain exhaustive scanning. It preserves duplicate tokens,
input occurrence order, repeated variables and nondeterministic successors.
Refusal constraints retain every possibly enabling binding. Concrete lookup also
preserves earlier guard errors. The local justification and cache lifetime are
in [increment 45](../../docs/satel/increment-45-token-index.md).

## Validation and reproduction

**1,030 regression tests in 96 suites** and **seven built-editor Playwright
tests** pass. Both production and isolated browser-test builds pass. The new
regressions compare all nondeterministic successors, duplicate occurrences,
shared input variables, symbolic/undefined keys, typed keys, cancellation,
changed markings, earlier guard errors and universal refusal truth against
exhaustive scanning. Positive and negative HR selections also agree with indexing
disabled.

All nine intentions regenerate and admit **64 identical frozen tests**. The
unmutated SUT passes **82 REST and 82 Playwright executions**, with no mismatch,
error or inconclusive verdict. **All seven mutants are detected on both transports**
across 1,148 mutation executions. All 1,312 baseline/mutant event sequences and
verdicts match the frozen pre-index reports and agree between API and UI. The
existing one negative-Nat contract error per transport for double charging is
retained explicitly; there are no inconclusive verdicts. Counts are in
[index-summary.json](results/index-summary.json). After the final negative-search
budget wiring, 40 focused indexing/refusal/UI tests were rerun successfully,
along with both builds and the seven browser tests.

The frozen suite and earlier full traces remain in `results/generic-evidence.zip`.
Fresh compact selection, verification and replay-summary reports are published
under `results/index-*.json`, including the unchanged frozen-suite hash. The full
follow-up trace archive was not uploaded. The commands below reproduce those runs.

```sh
# From this directory; extract results/generic-evidence.zip here first.
node experiments/index-benchmark.mjs --out index-comparison --configs '[{"employees":12,"slots":2,"indexed":true},{"employees":120,"slots":2,"indexed":true},{"employees":256,"slots":2,"indexed":true},{"employees":256,"slots":8,"indexed":true},{"employees":256,"slots":2,"indexed":false,"sequenceTimeMs":300000},{"employees":256,"slots":8,"indexed":false,"sequenceTimeMs":300000}]'
node experiments/verify-index.mjs
node experiments/campaign.mjs --transport api,ui --out index-baseline --port 8877
node experiments/campaign.mjs --transport api --mutants auto-approve-special,manager-scope,take-pending,double-charge,correction-no-audit,cross-tenant-hr,wrong-total --out index-mutants-api --port 8878
node experiments/campaign.mjs --transport ui --mutants auto-approve-special,manager-scope --out index-mutants-ui-a --port 8879
node experiments/campaign.mjs --transport ui --mutants take-pending,double-charge --out index-mutants-ui-b --port 8880
node experiments/campaign.mjs --transport ui --mutants correction-no-audit,cross-tenant-hr,wrong-total --out index-mutants-ui-c --port 8881
node experiments/summarize-index.mjs
```

Run timing experiments before other validation jobs. Set `SATEL_CHROMIUM` and
`FONTCONFIG_PATH` if using a custom browser. Full mutation runs return
a nonzero exit code for the expected double-charge Nat contract errors.

## Remaining theoretical and scaling limits

Completing this benchmark means one executable representative was found for each
of these 25 computed regions. It does not establish that the implementation's
regions coincide with the thesis's subuniformity classes, that representatives
are adequate for each entire class, or that every employee/record is covered.
The full SUT campaigns use the unchanged default 12-employee APN abstraction;
the enlarged marking runs are selection-only.

This change does not increase WorkLog depth, resolve deeper recursive unfolding
or pairwise overlap explosion, optimize the separate symbolic HML rule-effect
engine, or add asynchronous interleavings. Indexing can fall back to exhaustive
search when identities remain symbolic or guards lack usable equalities. Memory,
index construction and marking copying still grow with token volume. The next
separate experiment should measure recursive depth with these token-binding
costs controlled, while continuing to report unresolved obligations explicitly.
