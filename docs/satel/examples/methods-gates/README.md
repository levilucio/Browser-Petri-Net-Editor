# Inspectable methods-and-gates examples

These 86 examples use typed public methods and explicit synchronous output gates.

- Open them in the app under **Examples → Methods & gates**.
- Inspect/edit their concrete syntax under **SATEL → APN source**.
- `.copn` files contain the readable class; `.pnml` files also preserve intentions
  and layout, and can be loaded through the editor's normal **Load** action.
- Generate on a reference, load its corresponding mutant, and replay the frozen suite.

Start with:

| Example | Class source | Full model with intentions |
|---|---|---|
| Account reference | [source](gates-oracle-account-reference.copn) | [PNML](gates-oracle-account-reference.pnml) |
| Account: no debit | [source](gates-oracle-account-no-debit.copn) | [PNML](gates-oracle-account-no-debit.pnml) |
| Typed store | [source](gates-typed-store.copn) | [PNML](gates-typed-store.pnml) |
| Nondeterministic branching | [source](gates-nondeterminism-branch-reference.copn) | [PNML](gates-nondeterminism-branch-reference.pnml) |
| Fulfilment | [source](gates-fulfilment-reference.copn) | [PNML](gates-fulfilment-reference.pnml) |
| HML over lists | [source](gates-hml-adt-list-reference.copn) | [PNML](gates-hml-adt-list-reference.pnml) |

The [manifest](manifest.json) lists every model and any output state retained by
migration. The [increment report](../../increment-40-methods-gates.md) defines the
syntax, synchronous testing assumptions, supported fragment and validation.
