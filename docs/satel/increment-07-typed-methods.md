# Increment 7: execute public methods with the built-in ADTs

Branch: `codex/satel-public-methods`, stacked draft PR #4.

Bool, String, Pair and List now pass through the complete public-method path, alongside Nat and Int: argument entry, guard/output evaluation, token consumption and production, oracle comparison, readable pairs and PNML save/load. Symbolic constructor/equation selection still precedes APN execution. The model's initial marking remains part of the specification; calls bind parameters and do not inject tokens.

## Review on your laptop

```sh
git fetch origin
git switch codex/satel-public-methods
git pull --ff-only
cd petri-net-app
npm install
npm run dev
```

Open Vite's localhost URL, then:

1. Load **Examples → SATEL Typed store — Reference**.
2. Open **SATEL → Intentions** to inspect its saved symbolic intention. In **Oracle validation**, click **Derive classes without executing the APN**. Expect five disjoint classes, no unresolved branches and five candidate tests, each with two instantiated stimulation/observation pairs.
3. Click **Validate derived pairs on loaded reference**. Expect **5/5 passed**. Every test calls `store(...)`, then `read()`, starting with the reference's original marking.
4. Close SATEL, load **SATEL Typed store — Mutant: drops first item**, reopen Oracle validation and **Replay frozen suite on loaded APN**. Expect **4 passed, 1 failed, 0 errors**. The mismatch occurs at the second pair: `read()` exposes the lost first item. The first call still echoes the submitted list correctly.
5. To try calls yourself, reload the reference and click **Call public method**. For `store`, enter `items = [1, true, ("x", [2])]`, `label = "a"`, `enabled = true`, `meta = ("a", false)`. Call `store`, then `read`. A later call with `enabled = false` emits `ack(false)` and preserves stored data.
6. Save and reload PNML to inspect preserved markings, signatures and intentions. In an ordinary pair intention, select a public method and enter the same readable value notation; malformed or ill-sorted ground arguments disable Save.

The observations list each public place with its expected token multiset. `saved ↦ ⟦[]⟧` means one empty-list token; `saved ↦ ∅` means no tokens. Token order within a place does not matter, multiplicity does, and element order inside a List does. The symbolic protocol checks tokens produced by each call, with omitted public outputs expected to produce none; it does not silently reinterpret those observations as complete accumulated markings. Ordinary intentions retain their separate post-marking checks.

## Supported values and expressions

| Sort | Input notation | Public-call behavior |
| --- | --- | --- |
| Nat | `0`, `12` | Nonnegative 32-bit integer |
| Int | `-7`, `12` | Signed 32-bit integer |
| Bool | `true`, `false` | Strict Boolean values and Boolean guards |
| String | `"text"`, `""`, `"$cash"` | UTF-16 strings, including escaped characters |
| Pair | `("a", false)` | Two structurally compared built-in values |
| List | `[]`, `[1, true, ("x", [2])]` | Heterogeneous, nested built-in values |

The checked evaluator supports the default built-in operation families documented in increment 6: arithmetic/comparisons, Boolean operators, Pair projections, List operations and String operations. It reuses the typed source parser and performs fully bound concrete evaluation, without asking Z3 to invent missing method variables. `head([])` and wrong Any projections are errors; Boolean short-circuiting avoids evaluating irrelevant operands. String `substring` follows `substr(start, length)`; List `sublist` follows `slice(start, start + length)`.

In ordinary intention editors, `$name` denotes a variable and `"$name"` denotes a literal String. Nested variables are supported. Concrete test displays always quote Strings; nonprinting/private-use/unassigned characters are escaped to keep solver witnesses legible without changing their values. Exact witness values are solver choices and may differ between runs.

## Reference and mutant semantics

The internal `storage: List` initially contains one empty-list token. The public method is:

```text
store(items: List, label: String, enabled: Bool, meta: Pair)
```

It accepts when `enabled and length(items) > 0 and length(label) > 0 and fst(meta) == label`. Acceptance stores `items` and produces the acknowledgment plus echoed arguments. Refusal preserves storage and emits `ack(false)`. `read()` consumes and reproduces the stored token and emits its value at `saved`.

The symbolic goal explicitly selects metadata of shape `(tag, false)`, where `tag: String`. This is a declared input restriction, not coverage of every Pair value. The five regions are: disabled; enabled with an empty list; enabled with a nonempty list and matching nonempty label; nonempty list with an empty label; and nonempty list with a nonempty mismatching label. Constructors and conditional equations define these regions before oracle execution; the oracle subsequently validates their two-call protocols.

The mutant changes only the stored value to `tail(items)` in the accepting rule. Expectations are frozen from the admitted reference tests and never recomputed on the mutant.

## Implementation and limits

- Public calls validate arguments, connected markings, variable bindings, guards and all outputs before applying any effects. A private checked plan is applied through the simulator's token-consumption machinery. Public calls do not use the legacy permissive parser/solver fallback. Invalid calls leave the marking unchanged; missing resources block firing.
- Nested values are cloned at API/snapshot boundaries. Shared input variables match structurally. Duplicate tokens retain multiplicity, while equivalent token choices do not create spurious nondeterminism.
- The oracle contract records output-place sorts and checks structural token multisets. Signed Int observations and multiple tokens are supported. Newly admitted symbolic suites have schema version 5. Previously saved suites without output sorts remain readable under their legacy interface checks.
- PNML preserves nested values and escaped Strings, including literal dollar signs, control characters and lone UTF-16 surrogates. Pair/List parsing splits only at top-level separators.
- Runtime integers, including integers nested in containers and arithmetic intermediates, remain in the signed 32-bit range (Nat additionally nonnegative). Symbolic integers are mathematical integers; witnesses outside the runtime fragment cannot be admitted. Recursive value validation has a depth budget of 64, counting Any validation layers too, and binding search is capped at 10,000 visits.
- Public input arcs still require a variable and unit multiplicity. Multiple distinct enabled rules/bindings, transition action scripts, custom ADT method sorts and user-defined operation execution are outside this increment. Internal-transition simulation keeps its existing path. This is not full CO-OPN composition or internal-transition reachability search.
- Generic symbolic derivation keeps its unfolding/branch/time budgets and explicit unknown/undefined results. It does not establish exhaustive coverage, confluence, totality or uniform fault behavior within a class. Unresolved or overlapping regions block admission.

## Z3 lifecycle correction

Repeated cold-start derivation exposed intermittent WASM crashes while JavaScript garbage collection finalized handles during asynchronous solving. The shared context now enables Z3's concurrent-reference-decrement protection. Symbolic model and assertion-vector handles also have explicit ownership and cleanup after solving; relying only on the context flag did not eliminate the failure. The formulas and UTF-16 alphabet constraints are unchanged.

The installed wrapper uses finalizers for AST, model and vector handles. Z3's concurrency API is documented at <https://z3prover.github.io/api/html/group__capi.html>. A child-process regression forces garbage collection during three consecutive rich derivations. Twelve additional independent cold starts passed after the complete fix.

## Verification

Tests cover all built-in method operation families, nested values, snapshot isolation, atomic errors, blocked calls, repeated variables and duplicate tokens, typed/multiset oracle observations, nested protocol syntax, literal-dollar arguments, editor validation, PNML round trips and the real-Z3 reference/mutant pipeline. Desktop/mobile browser scenarios exercise both symbolic selection/replay and direct calls/ordinary intentions.

The broader SATEL suite has two existing failures in `manufacturing-v2.test.js` (intention count and meaningful-positive-result assertions), previously reproduced on unchanged commit `0a2af0a`. They concern the older manufacturing fixture and remain outside this increment.

Final verification: **202 SATEL/PNML tests passed**, with only the two baseline failures above; **18 desktop/mobile browser scenarios passed**; the production build passed. The new forced-GC regression is included in the SATEL count.
