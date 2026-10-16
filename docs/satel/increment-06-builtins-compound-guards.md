# Increment 6: built-in ADTs and compound guards

Branch: `codex/satel-public-methods`, stacked draft PR #4. This extends increment 5's symbolic selection engine and the numeric public-method guard evaluator. Initial markings, synchronous calls, separate derivation/admission and frozen expectations are preserved.

The Nat/Int-only public-call limit described below is superseded by [increment 7](increment-07-typed-methods.md), which adds Bool, String, Pair and List execution.

## Review on your laptop

```sh
git fetch origin
git switch codex/satel-public-methods
git pull --ff-only
cd petri-net-app
npm install
npm run dev
```

Open Vite's localhost URL. The dev server supplies the existing Z3 WASM assets and isolation headers.

1. Load **Examples → SATEL Compound guard — Reference**.
2. Open **SATEL → Oracle validation → Derive classes without executing the APN**. Expect four feasible, disjoint classes, no unresolved branches, and four candidate stimulation/observation pairs.
3. Inspect `check(10)` with `accepted(1)`. The same `x` is used in every guard term, including the exceptional value ten.
4. **Validate derived pairs on loaded reference**: expect **4/4** passed. The APN consumes and reproduces its initial `ready(1)` token; no tokens or alternative initial markings are injected.
5. Close SATEL, load **SATEL Compound guard — Mutant: missing x = 10**, reopen Oracle validation and **Replay frozen suite on loaded APN**. Expect **3 passed, 1 failed, 0 errors**. The mutant emits `accepted(0)` for ten.
6. In the reference's **Intentions → Edit**, inspect the **Guard — true and false regions** goal. **Copy a transition guard** explicitly snapshots a transition guard and the sorts of its method/input variables. Copying clears the protocol because its input ordering/outcome may change. Cancel to keep the supplied protocol, or edit and save your own.
7. Load **SATEL Built-in types — Symbolic classes**. Its saved intentions demonstrate List, Pair, String, Bool and Int. The List `head(xs)` intention shows one feasible nonempty class and an explicit undefined empty-list branch. The String guard produces three disjoint classes without APN execution. These are derivation-only examples, not oracle-admitted tests.

The pair display uses the actual named witness bindings, such as `σ = {x ↦ 10}`, rather than assuming the account example’s `request` variable. Definitions, goal kind, guard text, variables, budgets and pair protocols survive PNML save/reload. Reports remain associated with their saved source/model snapshot; rederive after edits.

## Built-in operation coverage

No declarations are required to use these operations in a symbolic intention. Custom constructor/operation equations remain supported alongside them.

| Sort | Supported symbolic operations | Representation/semantics |
| --- | --- | --- |
| Int | `+`, `-`, `*`, `==`, `!=`, `<`, `<=`, `>`, `>=`; unary minus | Mathematical integers in Z3; exact safe-integer witnesses in JavaScript |
| Nat | Numeric operations/comparisons under nonnegative sort constraints | Negative Nat literals/results are rejected or unresolved; no implicit wrapping or truncated subtraction |
| Bool | `and`, `or`, `not`, `xor`, `implies`, `iff`, `==`, `!=` | Boolean expressions; symbolic aliases `&&`, `||`, `!`, `^`, `->`, `<->` |
| Pair | `fst`, `snd`, `==`, `!=` | `(a, b)`, structural equality; fields have sort `Any` |
| String | `concat`, `substring`, `isSubstringOf`, `length`, `==`, `!=` | UTF-16 code-unit strings; substring follows the existing JavaScript `substr(start, length)` semantics |
| List | `length`, `concat`, `head`, `tail`, `append`, `sublist`, `isSublistOf`, `==`, `!=` | `[]`, `[a, b]`, `[h \| tail]`; recursive free constructors; structural equality |
| Any | Tagged built-in values and user-declared constructor sorts; structural equality | Heterogeneous/nested List and Pair values; explicit `asInt`, `asBool`, `asString`, `asList`, `asPair` projections |

`Int`, `Bool`, `Pair`, `String` and `List` cover the operations declared in the default ADT registry. Nat is the additional SATEL numeric sort. Division is not declared in that registry and remains outside this symbolic library, even though the older arithmetic evaluator accepts it.

List equations mirror the concrete operations: `tail([]) = []`, `head([])` is undefined, `sublist(xs, start, length)` follows `slice(start, start + length)`, and `isSublistOf` means contiguous inclusion. An empty list is a sublist of any list. String `substring` therefore has deliberately different negative-index behavior from List `sublist`.

The concrete evaluator now compares nested lists, pairs and ADT values structurally for equality/sublist membership instead of relying on JavaScript object identity. It also accepts Boolean elements, double-quoted strings and unary negative terms in collection literals. `isSublistOf` is recognized as a Boolean guard function. Numeric public methods accept compound comparison guards and multiplication, with explicit 32-bit literal/intermediate/output checks.

Numeric use of a heterogeneous `head`/projection introduces an Int projection. A wrong tag is an undefined branch, not an invented numeric conversion. For overloaded functions where the result is Any, declare the intended projection: `length(asList(head(xs)))`. An unconstrained heterogeneous list is not silently assumed to contain only integers.

## How classes are derived

The engine first elaborates typed terms and narrows constructor patterns using defining equations. List/Pair operations have canonical equations in `BuiltinAlgebra.js`; primitive String operations become native Z3 string constraints. The existing shared Z3 context is reused through SMT-LIB, since this version of the JavaScript wrapper does not expose high-level String/Seq constructors. UTF-16 alphabet constraints preserve the concrete string evaluator's indexing behavior, including surrogate pairs.

Compound conditions are decomposed into disjoint Boolean alternatives before unfolding irrelevant calls. For example:

```text
A or B  →  A  |  (not A and B)
```

Conjunction keeps the joint constraints; negation and the other Boolean operators are normalized similarly. Repeated occurrences of a variable share the same symbolic binding. Calls inside guard terms are unfolded, and Z3 checks the resulting combined constructor/arithmetic/string constraints. It never selects an independent representative for each occurrence of `x`.

For `x > 0 and (x < 5 or x == 10)`, the guard goal gives:

| Region over Int | Guard outcome | Example pair |
| --- | --- | --- |
| `0 < x < 5` | true | `⟨check(1), accepted(1)⟩` |
| `x = 10` | true | `⟨check(10), accepted(1)⟩` |
| `x <= 0` | false | `⟨check(0), accepted(0)⟩` |
| `x >= 5 and x != 10` | false | `⟨check(5), accepted(0)⟩` |

The displayed formula may retain redundant constraints; witness values are solver choices, not a permanent representative promise. Both outcomes supply positive conformance tests when their respective observations are expected by the specification. False guard outcome does **not** mean oracle failure or automatic negative-test classification.

Guard goals use declared variables, in declaration order, as protocol inputs, with Bool as the result. The protocol supplies the actual method-call sequence. Imported state variables are symbolic domain variables; importing a guard does not establish their reachability. The oracle subsequently checks that the declared sequence can execute from the APN's own initial marking.

## Explicit limits

- This completes **symbolic coverage of the default operation signatures**, not a decision procedure for arbitrary algebraic specifications. There is no infinite state-space generation or general semantic-equivalence proof.
- Recursive List/custom ADT equations consume an unfolding budget. Boolean alternatives consume a branch budget. Z3 timeout/unknown, unrepresentable witnesses, undefined operations and budget frontiers remain visible. They are never replaced by guessed witnesses. Unresolved/overlapping results block suite admission.
- Multiplication introduces nonlinear integer constraints; some are solvable, while general termination/decidability cannot be promised. String and recursive datatype combinations can also hit solver limits.
- Pair/List use tagged monomorphic Any, not general parametric polymorphism or quotient/AC constructors. Quantifiers, arbitrary JavaScript functions and general CO-OPN composition remain outside scope.
- Public APN method parameters and connected places remain **Nat/Int** in this increment. List/Pair/String/Bool class derivation is supported; invoking methods with those richer values needs a separate simulator/observation-adapter increment. Symbolic witnesses outside the adapter's 32-bit numeric range cannot be admitted.
- Transition guard import is an explicit copy. Sort inference handles declared method parameters and simple variable input bindings; unsupported input patterns require manual declarations. It is not automatic multistep symbolic execution, and it does not alter initial markings.
- Existing ordinary pair intentions retain their generation path. The older interval-based account CLI is also unchanged. The new coverage is in symbolic intentions and `deriveGenericSubdomains`.
- Exhaustive coverage, equation confluence, totality and uniform fault behavior within a class are not proved. One checked witness per completed class still relies on the declared subuniformity hypothesis.

## Verification

Real-Z3 checks cover every default operation family, heterogeneous and nested values, custom constructors inside containers, UTF-16/literal string model round trips, negative indexing, undefined/short-circuit cases, all Boolean connectives, joint shared-variable constraints, contradictory guards, multiplication and unresolved solver outcomes. The compound reference/mutant test also verifies that removing the initial resource blocks every call.

GUI checks cover guard editing/import, PNML round trips, separate derivation/admission, readable pairs, frozen mutation replay, built-in String constraints and List partiality. Existing account/list/editor workflows are retained in desktop/mobile browser regression tests.

The broader SATEL suite retains two pre-existing failures in `manufacturing-v2.test.js` (intention-count and meaningful-positive-result assertions). Both reproduce on unchanged commit `0a2af0a`; this increment does not change that fixture or its legacy generation path.

Validation results: **73 focused core/editor/method tests passed**, **113 evaluator/parser regression tests passed**, and **14 desktop/mobile browser scenarios passed**. The new browser scenarios were also rerun after visual refinements, including an assertion that the displayed substitution is `x ↦ 10`. The production build passed. The broader SATEL run otherwise passed; the two baseline manufacturing failures described above remain.
