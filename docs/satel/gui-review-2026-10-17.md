# GUI review: HML, nondeterminism and negative tests

The functional increments through algebraic HML selection are wired into the GUI on `codex/satel-public-methods`. The SATEL panel has three views: **Intentions**, **Generated tests**, and **Replay results**. You can review the functionality without waiting for the performance optimizations described in increment 20.

The review ran all 20 targeted browser scenarios successfully (ten in desktop Chromium and ten with mobile Chromium emulation). They exercised editor save, expected-true/false HML, String/List/Pair joint selection, rule and multiset nondeterminism, explicit and automatic refusals, reference admission, frozen mutant replay and linked counterexample evidence. Desktop editor and mobile generated-test screenshots were also inspected. This checks the local app; mobile Safari and a remotely deployed site were not tested.

After that run, two editor help messages were clarified: universal requirements can hold with no matching outcomes, and nested calls use the reached marking. The six focused editor tests and production build passed after those wording changes; solver and test semantics were unchanged.

## Run on your laptop

From the repository root:

```sh
git fetch origin
git switch codex/satel-public-methods
git pull --ff-only
cd petri-net-app
npm ci
npm run dev
```

Open the URL printed by Vite. If an older tab was already open, reload it. This is the `codex/satel-public-methods` branch, not `SATEL`; the checks described here do not establish that a separately deployed website is up to date.

## Common reference/mutant workflow

1. Open **Examples** and search for the family below. Load its **reference**.
2. Open **SATEL → Intentions**. Use **Edit** to inspect the property, then save or cancel.
3. Open **Generated tests**, select the intention, and click **Generate tests**. Only reference-admitted tests become a frozen suite.
4. Expand **Why this test was selected**, the HML property/evidence, and individual pair details as appropriate.
5. Close the SATEL panel, load the matching mutant through **Examples**, and reopen **SATEL → Replay results**.
6. Click **Replay frozen suite on loaded APN**. Do not regenerate on the mutant: that would replace the reference expectations. Loading an APN preserves the current suite; reloading the browser page does not promise to preserve it.

## Suggested review order

| Review | Search in Examples | What to try |
|---|---|---|
| Branching beyond trace sequences | `Nondeterminism` → **Branching reference** | Generate **One open outcome retains both choices**, then replay on **Branching mutant: early choice**. It fails even though the observable traces coincide. |
| Expected-false HML requirement | Same reference | Generate **Not every open outcome retains both choices**, then replay on **Branching mutant: lost alternative**. The property changes from false to true, which violates its expectation. |
| Multisets and token multiplicity | `Nondeterminism` → **Multiset reference** | Choose the intention covering consumption orders. Replay on **Multiset mutant: missing duplicate**. Inspect the explanation, rejected firing, binding and resulting marking. |
| Whole-sequence and HML parameter selection | `HML selection` → **Reference** | Generate **Choose an amount allowing every open outcome to finish**. The explanation shows why the static value 1 must be replaced by a value in 3–5. Replay on a matching mutant. |
| Algebraic parameters in HML selection | `HML ADT selection` → **String label**, **List queue** or **Pair permit** reference | Generate a progress/no-dead-end intention and inspect the selected value and equation-unfolding explanation. Replay on its missing-finish or wrong-value mutant. |
| Explicit negative/refusal test | `Refusal` → **Quota reference** | Generate **Reserve then refuse zero release**. The final pair requires refusal and unchanged marking. Replay on **Quota mutant: accepts zero**. |
| Automatically selected refusal companions | `Thermostat` → the reference in **SATEL exercises** | Under Generated tests, tick **Also select bounded refusal tests from validated positive prefixes** before generating. Inspect the separate bounded negative-selection coverage and companion explanation. |

The branching editor provides **Possible continuation** (`⟨a⟩`), **Every matching continuation** (`[a]`), conjunction, disjunction, negation and marking predicates. Nested continuations advance from the reached marking. Sibling obligations start from the same state. **HML notation** shows the corresponding formal expression without requiring JSON editing.

A universal requirement is true if there are no matching outcomes. To require existence too, combine it with a possible-continuation requirement. A refusal can be written as `[call] false` with **Any observation**: no outcome of that call may exist. Restricting its observation filter only excludes outcomes matching that filter, not the call altogether.

“Must not hold” specifies an expected-false property; it does not invert arbitrary test errors into success. A refusal test expects a particular call to have no enabled rule/binding at a reached marking. An accepted call that returns an error token is a different behavior. Unknown or exhausted exploration is not proof of refusal.

## What is deliberately separate

- The combined diagnostic solver patch from the performance study is not enabled in the GUI. Small functional examples can be reviewed now; large/deep properties may still reach limits.
- The [27 performance models](performance/models/README.md) are loaded as PNML through **Load**, rather than listed in Examples.
- Automatic refusal companions are bounded (at most ten in the current GUI), use fixed validated prefixes, and may choose terminal parameters outside the original intention conditions while respecting their sorts. They are not exhaustive negative-test generation. The checkbox is disabled for standalone branching properties.
- String/List/Pair HML support refers to the implemented built-in value types. Arbitrary custom-sort APN method execution and unbounded bisimulation are not claimed.

No additional feature increment is needed before reviewing these workflows. Feedback on the editor, evidence navigation and terminology is more useful at this point than adding further options.
