# Parameterized public methods: first increment

This increment introduces synchronous, parameterized public calls and a GUI presentation of ordered stimulation/observation pairs, without HML. It builds on the initial-marking work on `codex/satel-oracle-subuniformity-increment-1`; the review branch is `codex/satel-public-methods`.

## Execution contract

A public transition rule declares a method name and ordered typed parameters. For example, both withdrawal rules implement `withdraw(n: Nat)`. A stimulation supplies `n`; the current balance token supplies `b`; the guards `n <= b` and `n > b` select the rule. Tests call the method, never a particular implementation rule or private binding.

Each call is a synchronous rendezvous between the environment and an enabled rule. Arguments are available only during that call. They are neither queued nor injected into places. A blocked call changes nothing. Invalid arguments, unsupported syntax, unresolved binding search, and multiple distinct enabled choices produce errors, not negative observations or mutation kills.

Public rules, including parameterless methods, do not fire through Step, Simulate, Run, or direct-transition firing APIs. Internal rules remain autonomous in interactive simulation. This is a small method-call semantics, not full CO-OPN composition or multi-object synchronization.

Each test starts from the loaded model's marking. Reference and target models retain their own initial state; `referenceInitialMarking` in a generated test is display/evidence only. Tests cannot override the initial marking or mix method calls with direct transition steps. During a sequence the marking evolves continuously. Public observations are tokens **produced by that call** at output places. Observing does not consume them; accumulated output tokens remain in the marking.

## GUI review on a laptop

```sh
git fetch origin
git switch --track origin/codex/satel-public-methods
cd petri-net-app
npm ci
npm run dev
```

If the branch already exists locally, switch to it and pull instead of creating it again. Open the local URL printed by Vite.

1. Load **Examples → SATEL Account — Reference**.
2. Click **Call public method**, enter `10` for deposit and call it. Call `withdraw(10)`: the public observation contains `ack(1)` and `paidAmount(10)`. Repeat `withdraw(10)`: it produces `ack(0)`. Call `query()`: it produces `balanceResult(0)`. The same controls are available under **SATEL → Methods**. Automatic simulation has no internal transitions to run in this example.
3. Reload the reference example to restore its initial balance of zero. Open **SATEL → Oracle validation**, keep the refined equations, and generate. Four tests pass the reference oracle.
4. Inspect the `Amount(10)` test. It displays the instantiated sequence:

   - ⟨ deposit(10) with ack(1) ⟩
   - ⟨ withdraw(10) with ack(1) // paidAmount(10) ⟩
   - ⟨ query() with balanceResult(0) ⟩

   Pairs are ordered vertically. `//` joins outputs of the same firing. The initial marking and substitution are shown separately. Expand **Execution details** for checked empty outputs and intermediate markings. There is no HML wrapper or trailing logical formula.
5. Close SATEL, load **SATEL Account — Mutant: reject-exact-balance**, reopen SATEL, and **Replay frozen suite on loaded APN**. Expect three passes and one failure at pair 2. Expectations remain those of the reference.
6. Load **Mutant: wrong-initial-balance** and replay. All four tests fail. This specifically verifies that replay did not overwrite the mutant's initial balance of one with the reference balance of zero.
7. Try coarse equation refinement on a freshly loaded reference. It selects three tests and misses the exact-balance mutant; the refined classes detect it. This remains constructor/operation-equation subuniformity, derived before oracle execution.
8. To define your own method, select an algebraic transition and use **Public method** in Properties: enter a name, add Nat/Int parameters, and save. Multiple rules may share the same signature. **Make internal** removes the declaration. Signature edits that conflict with another implementing rule are rejected; rename/remove that declaration first if you need to change a shared signature.
9. Under **SATEL → Intentions**, create an intention and add pairs. Select a public method and enter literal arguments or `$variable` references. Declared hypotheses still control variable instantiation. Public output assertions are edited in the existing observation fields; generated tests use the readable pair representation.

The current editor marking is the model marking used for a new test run. Manual simulation changes it: reload the reference before generating the supplied account suite. Each individual test starts afresh from that model snapshot.

## Deliberate bounds

- Method parameters and touched places support 32-bit `Nat`/`Int`. Input arcs use one variable with unit multiplicity; output expressions use integer literals, variables, addition and subtraction. Guards are a single numeric comparison. Action scripts and richer ADT arguments/operations are outside this increment.
- Parameter names cannot be overwritten by token matching. A same-named input variable constrains token equality. Duplicate token identities with the same resulting choice are collapsed; other nondeterminism is reported as unsupported.
- Binding search is bounded to 10,000 visited partial assignments. Exhaustion is an explicit unresolved error.
- Interactive simulation can mix public methods and internal rules. The method **test oracle** currently rejects nets with internal rules, because silent closure and synchronization scheduling have not yet been defined. It does not silently insert internal firings.
- The symbolic account suite supplies equation-derived positive expectations and checks them on the reference. General intentions retain the declared positive/negative expectation. Automatic oracle classification and symbolic handling of unannotated infinite domains remain separate future increments.
- Method declaration compatibility is checked globally. Rule expressions are checked when their method is invoked: a malformed unused method need not invalidate an otherwise executable test. An errored mutation run is never reported as a kill.
- Existing direct-transition intentions remain a compatibility path for other examples. They are not automatically converted to public methods. Their legacy initial-marking contract is documented in increment 3.
- Save/Load retains methods, place sorts, I/O roles, intentions and account metadata through an editor-specific `apn:satel` PNML extension. Other PNML tools would need to understand this extension to preserve method semantics. Malformed SATEL metadata is rejected instead of loading public rules as internal transitions.

## Verification

Core tests cover argument binding, rule alternatives, autonomous exclusion, blocked calls, atomic errors, state continuity, metadata retention, generic method intentions, and target-specific initial markings. GUI tests cover method declaration and validation, argument editing, reference admission, frozen mutant replay, and pair rendering. Browser checks exercise desktop and mobile reference/mutant workflows and manual calls.

The production build passes. The full Jest suite reports 618 passes and six pre-existing failures in the manufacturing/path-subuniformity tests; these are outside the public-method increment. The six browser scenarios cover desktop and mobile account/manual-call workflows plus loading the existing manufacturing intentions.
