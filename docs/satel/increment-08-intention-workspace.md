# Increment 8: an intention-centred SATEL workspace

Branch: `codex/satel-public-methods`, stacked draft PR #4.

The main workflow is now **Intentions → Generated tests → Replay results**. The separate “Oracle validation” entry point and ordinary-suite footer have been replaced by one **Generate tests** action for the selected intention. Selection still happens before reference execution. Admission requires every candidate to pass; a failed candidate is not silently discarded to produce a passing suite.

## Review on your laptop

```sh
git fetch origin
git switch codex/satel-public-methods
git pull --ff-only
cd petri-net-app
npm install
npm run dev
```

1. Load **Examples → SATEL Account — Reference**, then open **SATEL**. The Intentions view shows both saved Account intentions, with their pair sequences.
2. Edit **Account — less / equal / greater**. Variables, conditions, the subuniformity hypothesis and editable pair sequences come first. Expand **Advanced selection settings** only to change the equations, selected operation/guard, unfolding budget or case bindings.
3. In the paid case, the sequence is displayed as:

   ```text
   { deposit(n=b) with ack(1) } .
   { withdraw(n=n) with ack(1) // paidAmount(paid) } .
   { query() with balanceResult(remaining) }
   ```

   Case declarations provide the variable sorts. “How this sequence binds selection values” shows how operation inputs/results supply these values. Editing a sequence preserves its input/result patterns and the other cases. Invalid drafts remain visible and disable Save.
4. Save, choose **Use intention**, then **Generate tests**. Expect **4/4 tests passed the reference oracle**, with instantiated pair sequences in the main view. Class patterns, constraints, derivation paths, unresolved branches and source snapshots are under **Advanced details**.
5. Load **SATEL Account — Mutant: rejects exact balance**. Open **Replay results → Replay frozen suite on loaded APN**. Expect **3 passed, 1 failed, 0 errors**. The failure is at the withdrawal observation in the equality test. Loading another APN or closing the panel preserves the frozen reference suite during the session.
6. Try **SATEL Typed store — Reference** through the same workflow: **5/5** reference tests; its drops-first-item mutant gives **4 passed, 1 failed, 0 errors**.

To author a simple intention without equation setup: **Create Intention → Add Variable**, use `amount: Nat` with explicit values `0, 5, 10`, and condition `amount > 0 and amount <= 5`. Add a `deposit(n=$amount)` pair with `ack(1)`. Generation selects only `5`, then checks the call against the reference. The same Generated tests and Replay results views handle it.

## What is simplified

- Public methods and observable-interface inspection are under **Advanced model and selection tools** in Intentions.
- Equation-based intentions foreground editable `{ stimulation with observation }` sequences; the original full protocol remains available in advanced settings. Existing selection bindings are not inferred away or rewritten into ordinary intentions.
- Ordinary intentions retain structured method/observation fields and gain a live Variables/Axioms/pair preview, explicit finite value sets and optional conditions. Their full preview is read-only; it is an approximation to the thesis presentation, not a parser for the full thesis language. No HML is introduced.
- New ordinary variables default to explicit finite values. Uniformity is a separate, explicit assumption with a chosen representative. Existing per-variable subuniformity/regularity settings remain readable and editable under saved selection settings; joint equation-based classes use symbolic intentions.
- Generated sequences come before derivation diagnostics. Replay uses fixed reference expectations and the target model’s own initial marking. Ordinary and equation-based suites retain their existing execution adapters.
- Ordinary selection accepts 1–128 well-sorted built-in values per explicit domain, with a 10,000-combination cap before conditions are applied. Conditions use the checked built-in expression evaluator; unsupported/undefined expressions raise an error. A rejected uniformity representative is not automatically replaced by another value.
- Definitions, finite domains, conditions and edited protocols survive PNML save/load. Suites and replay results remain session state, with an optional JSON diagnostic download.

## Observation semantics remain explicit

`place(token)` is an assertion about tokens **produced by that call**, not the full accumulated marking. Repeated events preserve multiplicity. In symbolic protocols, unmentioned public output places must produce no tokens; `none` means no public outputs. In ordinary intentions, unselected output places are unconstrained, and an explicit empty bag means no tokens at the selected output. These two existing contracts remain distinct.

Ordinary intentions additionally support checks of the marking after a call, using the existing place-based editor. The notation preview marks these separately. Neither editor injects public-method arguments into places or overwrites the model’s initial marking.

## What this increment does not establish

- Selection remains static. Intermediate APN markings are checked during concrete reference execution, not propagated into symbolic witness selection. A blocked representative does not prove that its whole class is unreachable.
- The selected operation or guard is an explicit saved expression. ADT equations unfold the operations in that expression; the UI does not impose two independent mandatory partitions. Importing a transition guard creates a snapshot, not a live connection to subsequent APN edits.
- Feasibility and disjointness of completed symbolic branches do not prove exhaustive coverage, semantic subuniformity, confluence or totality. Unresolved branches and overlap failures block admission and remain visible.
- This is not an exact implementation of the Marre/Péraire Prolog procedure or the thesis’s semantic state-space equivalence construction. It does not add full CO-OPN synchronization or internal-transition reachability search.

## Verification

- 208 SATEL/PNML tests passed. The same two baseline failures remain in `manufacturing-v2.test.js` (fixture intention count and positive-result expectations), documented in increment 7.
- 22 desktop/mobile browser scenarios passed, including reference/mutant replay, real Z3 derivation, PNML persistence, readable observations, invalid draft handling, editable sequence notation and finite-value generation.
- Production build passed. Existing bundle-size warnings remain.
