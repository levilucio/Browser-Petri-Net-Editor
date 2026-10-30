# Increment 40 — synchronous APNs with methods and gates

29 October 2026. Branch: `codex/satel-methods-gates`.
Parent: `f269f595542ea14c9b58c52711017ec7bb21645d` on
`codex/satel-public-methods`. The previously proposed B0 remains unchanged.

## Inspect the result

1. Switch to this branch and run `npm ci` and `npm run dev` in `petri-net-app`.
2. Open **Examples → Methods & gates — 86 converted examples**. Start with
   **Methods & gates — SATEL Account — Reference**.
3. Open **SATEL → APN source**. Review the `Methods`, `Gates`, `Initial` and
   `Axioms` sections. Edit the text and choose **Apply class**. Invalid source
   leaves the current model unchanged. **Open .copn** loads source for review;
   **Download .copn** saves the text. Applying source retains existing intentions.
4. Use **Generated tests → Generate tests**. The account admits four tests.
5. Load the corresponding `no-debit` mutant and replay the frozen suite. It
   produces two failures and two passes, with no errors.
6. **Call public method** executes a single deterministic call and displays its
   public response. The graph now uses a class boundary, black method ports, white gate ports and
   dashed gate synchronization edges; see [increment 41](increment-41-graphical-methods-gates.md).

All 86 converted examples have committed, readable
[`.copn` sources and PNML files](examples/methods-gates/README.md).
The PNML includes intentions and editor metadata; `.copn` contains the APN class
only. Loading class text into a blank model does not invent test intentions.
The original examples remain available for comparison.

## Agreed interaction contract

A model step is `M --<method(arguments), gate occurrences>--> M'`.
The method, its state change and its gates belong to one atomic abstract
interaction. The SUT may take elapsed time to compute the response. The tester
issues no next input before completion. Relevant interference is excluded or
represented by the model. No autonomous/invisible transitions, delayed outputs,
interleaving between an input and its response, or timing guarantees are added.
An adapter timeout remains unresolved unless a separately specified deadline
makes it a semantic violation.

Gates are typed interface declarations. Rules carry gate applications whose
arguments are expressions over method parameters and consumed-token bindings.
The same method can have several rules, and a gate can be used by several rules.
A rule can have zero, one or several simultaneous gate occurrences. Arguments
are checked before exposing a successor; type/definedness errors are model errors,
not refusals. Gate values never enter the marking. Two edges with the same
successor marking but different gate observations remain distinct.

The environment is **receptive to all declared output gates**. This implements a
flat testing boundary, not a general context capable of blocking a gate or
supplying additional values through it. Gate arguments must be computed by the
rule; unconstrained output-parameter solving is not implemented.

## Concrete syntax and relation to the thesis

Source anchors: Lúcio, *SATEL*, 2009, Figure 4.6 (printed p.56),
§4.4.3 / Definitions 4.4.6–4.4.7 (pp.63–65),
[official archive](https://archive-ouverte.unige.ch/unige:2498).

The implemented syntax follows the class/module sections and
`method ... With this.gate ... :: pre -> post` organization:

```text
Class Account;
Interface
  Methods
    deposit : Nat;
    query : ;
  Gates
    ack : Nat;
    balanceResult : Nat;
Body
  Places
    balance : Nat;
  Initial
    balance (0);
  Axioms
    depositRule: deposit n With this.ack (1) ::
      balance b -> balance (b + n);
    queryRule: query With this.balanceResult (b) ::
      balance b -> balance (b);
End Account;
```

- Port declarations list argument sorts. A zero-argument declaration has an empty
  sort list. Formal method parameters are supplied by its axioms; all rules of a
  method use the same formal names and signature.
- Gate applications use `With`, optionally qualified by `this.`. `//` combines
  simultaneous occurrences. Alternative behavior is represented by separate
  axioms. Sequential `..` and alternative `⊕` gate expressions are rejected.
- A guard precedes the pre/post markings: `condition => pre -> post`.
- Marking terms are comma-separated; repeated occurrences preserve multiplicity.
  `empty` or `∅` denotes the empty multiset. Input arc terms are variables;
  output arc and gate terms use the existing checked built-in expression language.
- Compound argument expressions are parenthesized. Built-in sorts are `Nat`,
  `Int`, `Bool`, `String`, `List`, `Pair`; numeric values retain the existing
  32-bit limits and partial operations remain checked. Expressions may span
  lines. Section order is checked; missing pre/post markings must be written
  explicitly as `empty` rather than omitted.
- An optional `Where` section checks explicitly declared variable sorts against
  the inferred method/input binding sorts. The printer omits redundant `Where`
  declarations. Lines beginning `--` are comments.
- `ruleId:` is an **editor extension**, used to retain distinct rule identities
  and layout when applying source. It may be omitted; the parser assigns IDs.
- This is a restricted executable dialect, **not a complete CO-OPN parser**.
  `Use`, class `Type`, inheritance, object creation, contexts, arbitrary custom
  ADTs and full synchronization-expression semantics are not implemented.

Public gates therefore have their own declaration and firing semantics. They are
not renamed output places or predicates over a marking. Query methods can read
and preserve internal tokens while synchronizing with a gate reporting a value.

## Observation representation

The existing test representation retains `observation.outputs`, indexed by gate
name, with a multiset of occurrences for each gate. Scope `public` names all
public outputs, including empty bags. Marking predicates refer only to places.

For compatibility, a unary gate occurrence is its value. Zero/multi-argument
occurrences use an ordered argument list:

| Declaration | One occurrence | No occurrences |
|---|---|---|
| `ack : Bool` | `ack: [true]` | `ack: []` |
| `reply : Int Bool` | `reply: [[7, true]]` | `reply: []` |
| `done :` | `done: [[]]` | `done: []` |
| `items : List` | `items: [[1, 2]]` | `items: []` |

Signatures distinguish a list-valued unary gate from a multi-argument gate.
Their semantic identity is the gate name and ordered argument sorts; formal
argument names are descriptive. A saved interface or SUT adapter for zero- or
multi-argument gates must include explicit gate signatures. Legacy interfaces
without gate signatures remain compatible with unary gates.
Tuple positions are ordered and typed; occurrence bags preserve multiplicity
but not ordering, consistent with the simultaneous-only fragment. In the existing
symbolic intention syntax, write `reply([n, true])` for one binary-gate occurrence
and `done([])` for one zero-argument occurrence. This encoding is intentionally
explicit; the model syntax uses `this.reply (n) (true)` and `this.done`.

Sequence execution, concrete HML, symbolic sequence/HML constraints, worker
admission/replay and black-box campaigns use gate observations. Full state and
state-produced tokens remain separate from public gate occurrences. Compilation
fingerprints include declarations and rule gate expressions. Saved interfaces
include gate signatures; mismatched signatures cannot silently reuse a suite.

PNML metadata version 2 stores declarations and rule applications. Version 1
models remain supported, but cannot contain gate metadata. Malformed gate
metadata is rejected on both import and export, including on internal rules.

## Example conversion and preservation argument

The catalog converts all **86 currently executable public-method GUI examples**:
account, the ten exercise families and their mutants, inventory, refusals,
nondeterminism, HML selection (including String/List/Pair), fulfilment, typed
store, whole-sequence selection and compound guards.

Each legacy public output arc becomes a gate application with the same expression.
A pure output log that is neither consumed nor mentioned by attached marking
assertions disappears from state. If an output place is consumed, initially
nonempty or checked as a marking, it remains as a fresh internal `*_state` place;
its arcs and attached marking assertions are renamed, and the gate preserves its
original public name. The source model is validated before conversion; malformed
arcs cannot be erased to hide errors. Gate conversion is idempotent.

This construction preserves projected responses and the internal state relevant
to future behavior. Erased logs cannot affect enabledness or bindings because no
rule reads them. Retained state follows the same consumption/production rules.
This is a preservation argument for this migration, not a formal proof of full
thesis correspondence or universal representative adequacy. External marking
assertions about erased log places need explicit adaptation.

Legacy direct-transition/custom-ADT demonstrations (including the older
manufacturing model and generic PT examples) remain unchanged. They are outside
the executable public-method fragment and are not presented as converted models.
Class-only algebraic selection examples have no executable interface to migrate.

Regenerate the committed exports with:

```bash
cd petri-net-app
node tools/node/export-method-gate-examples.js
```

## Validation

The focused suite checks malformed declarations/calls, sort/arity/binding errors,
zero/multiple arguments, refusal, same-state/different-output nondeterminism,
non-accumulation of gate events, source and PNML round-trips for all 86 examples,
and malformed metadata. The ten exercise families compare the same frozen tests
on old and converted reference/mutant models. Different valid solver witnesses
are allowed; both selections are cross-replayed on both references. String/List/
Pair examples check joint HML selection and fault detection. Browser tests cover
source editing, public calls, worker generation and replay.

Validation on 29 October 2026:

- The focused SATEL/worker, solver, simulator, transition and toolbar regression
  command below passes all 990 tests in 91 suites after the review fixes.
- Eight Playwright checks pass against the development server, and the same
  eight pass against the bundled application (including existing worker
  cancellation, restart and failure-recovery checks).
- Production build and SATEL browser-harness build both pass. Vite retains its
  existing large-chunk advisory.
- All 86 `.copn` sources parse, and all 86 PNML files round-trip with declarations,
  gate calls and intentions. Browser screenshots were inspected for source
  editing and the state after a public call.

The [validation record](experiments/methods-gates-2026-10-29.json) retains browser
results and commands. Commands are run from `petri-net-app`:

```bash
npm test -- --runInBand src/__tests__/satel src/__tests__/workers \
  src/__tests__/utils/z3 src/__tests__/utils/z3-arith.test.js \
  src/__tests__/features/algebraic-simulator.test.js \
  src/__tests__/features/simulator-core.test.js \
  src/__tests__/components/Transition.test.jsx \
  src/__tests__/components/Transition.drag.test.jsx \
  src/__tests__/components/toolbar
npm run build
node node_modules/vite/bin/vite.js build --config vite.satel-test.config.js
npx playwright test --config=playwright.satel.config.js methods-gates.spec.js worker-session.spec.js
SATEL_BUILT=1 npx playwright test --config=playwright.satel.config.js methods-gates.spec.js worker-session.spec.js
```

This environment used the existing `SATEL_CHROMIUM` override with Chromium 153;
the standard Playwright browser download was unavailable. No browser binaries or
temporary browser dependencies are part of the branch.

## Review of the first implementation

The second review checked the code against the cited thesis definitions and the
agreed atomic interaction contract. It retained the semantic design and fixed:

- Source statements split inside parenthesized expressions were rejected too
  early. They now parse across lines, while repeated/misplaced sections and
  omitted pre/post markings are rejected. Canvas gate labels keep these
  multiline expressions on one line.
- Gate formal argument names incorrectly affected interface compatibility.
  Only gate names and ordered sorts now determine that compatibility; ambiguous
  zero/multi-argument interfaces must supply their signatures explicitly.
- Null gate declaration lists and malformed gate calls on internal transitions
  could evade validation. The compiler and PNML boundary now reject them.
- The method editor could leave gate calls on a rule after making it internal.
  That action now requires removing the synchronizations first.
- An unsupported model was displayed as a fabricated empty source class.
  The source editor now shows the conversion error and leaves the draft empty;
  an unsuccessful reload preserves an existing draft.

Twenty additional regression checks cover these cases, including stateless
firings with repeated zero-argument gate occurrences and a genuinely symbolic
sequence/HML selection with typed multi-argument output. That selection solves
for the required input and detects a mutant with an incorrect gate result.
The converted exports were regenerated without any changes to their contents.
