# Increment 10: larger fulfilment APN and mutation suite

The Examples menu now contains **SATEL Fulfilment — Reference (10 pairs)** and
six independent mutant APNs. The reference has **34 places, 17 transition rules,
127 unit arcs and 10 public methods**. It reuses the existing whole-sequence
selection and oracle machinery; no special-case generator is added for this net.

## Review in the GUI

1. Update branch `codex/satel-public-methods`, then run `npm install` and
   `npm run dev` from `petri-net-app`.
2. Load **Examples → SATEL Fulfilment — Reference (10 pairs)**. The larger drawing
   follows two rows: left to right for order preparation, right to left for
   fulfilment and return. Zoom out to inspect the whole net.
3. Open **SATEL → Intentions**. The saved intention includes the operation
   equations, selection conditions and two ten-pair protocols for Standard and
   Express delivery. Each protocol yields small/bulk equation classes.
4. Open **Generated tests → Generate tests**. Expect **4/4 reference passes**,
   four executable classes, zero blocked classes and zero unresolved searches.
   There are **40 instantiated pairs** altogether.
5. Expand a pair's **Execution details** to inspect token occurrences and its
   resulting marking. In particular, packing consumes two distinct crate tokens;
   delivery returns both.
6. Close SATEL, load a fulfilment mutant, then open **Replay results** and click
   **Replay frozen suite on loaded APN**. Do not regenerate on the mutant: the
   expected observations must remain those selected on the reference.
7. Repeat with the remaining mutants. The saved reference suite survives model
   changes. Every reference/mutant can also be saved and reloaded through PNML.

## Lifecycle and initial marking

Initially the net has stock 12, wallet 100, revenue 0, loyalty points 0, shipment
and return counters 0, two crate tokens of value 1, and one idle token. Other
places start empty. Public calls pass parameters; they do not inject place tokens.

| Pair | Stimulation | Required observation |
|---|---|---|
| 1 | `open(rush)` | acknowledgement true |
| 2 | `add(q)` | cart quantity `q` |
| 3 | `reserve()` | reserved quantity `q` |
| 4 | `pay()` | charge `10q` |
| 5 | `pack()` | packed quantity `q` |
| 6 | `ship()` | delivery fee from the defining equations |
| 7 | `deliver()` | delivered quantity `q` |
| 8 | `returnItems(r)` | refund `10r` |
| 9 | `close()` | acknowledgement true |
| 10 | `audit()` | stock 10, expected wallet and revenue, loyalty 2, shipment count 1, return count 1 |

Reservation removes stock. Payment moves money from wallet to escrow. Shipping
moves its fee from wallet to revenue. Returns replenish stock and refund escrow
to the wallet. Closing moves the remaining escrow to revenue, awards loyalty for
retained items, and restores idle. The reference conserves money and inventory
through all intermediate markings, and conserves the two crate occurrences.

The model includes explicit refusal rules for invalid additions, unavailable
stock, insufficient payment funds and invalid returns. This intention exercises
the successful lifecycle; it does not claim coverage of those refusal rules.
An observed refusal would be a positive observation, not automatically a negative
test. Only one order can be active at a time; concurrency and cancellation are
outside this example's scope.

## Constructor/operation subuniformity and dynamic values

The selection algebra declares `Standard()` and `Express()` constructors and a
`settle(q, delivery, r)` operation returning `Receipt(fee, finalCash)`. Its four
conditional equations distinguish delivery constructor and quantity `< 4` versus
`>= 4`. The intention also requires `2 <= q <= 8` and `0 < r < q`.

The final stock observation supplies a constraint across the whole sequence:

`12 - q + r = 10`, hence `q - r = 2`.

Thus a representative that satisfies an equation class but leaves the wrong final
stock must be replaced. The current selected witnesses and outcomes are:

| Class | Buy `q` | Return `r` | Shipping fee | Final wallet | Final revenue |
|---|---:|---:|---:|---:|---:|
| Standard, small | 3 | 1 | 2 | 78 | 22 |
| Standard, bulk | 4 | 2 | 0 | 80 | 20 |
| Express, small | 3 | 1 | 5 | 75 | 25 |
| Express, bulk | 4 | 2 | 3 | 77 | 23 |

Other bulk witnesses satisfying the same joint constraints would also be valid;
the solver's representative choice is not the definition of the class. All four
tests finish with two retained items, stock 10 and loyalty 2. These are bounded
positive tests, not an exhaustive test set.

## Mutation results with the frozen reference suite

| Mutant | Fault | Passed / failed / errors | First mismatch |
|---|---|---|---|
| Stock not reserved | Reports reservation but leaves stock unchanged | 0 / 4 / 0 | Pair 10, stock audit |
| Payment not debited | Reports charge but leaves wallet unchanged | 0 / 4 / 0 | Pair 10, wallet audit |
| Wrong express bulk fee | Charges and reports 5 instead of 3 | 3 / 1 / 0 | Pair 6, express-bulk fee |
| Refund not credited | Reports refund without crediting wallet | 0 / 4 / 0 | Pair 10, wallet audit |
| Only one packing crate | Initial marking has one crate instead of two | 0 / 4 / 0 | Pair 5, blocked packing call |
| Loyalty ignores returns | Awards points for original quantity | 0 / 4 / 0 | Pair 10, loyalty audit |

All six mutants preserve the public method signatures and saved intention. They
alter the APN's arcs, guard or initial marking. Most deliberately preserve the
immediate acknowledgement, so later state observations are necessary to expose
the fault. Errors are counted separately and do not count as detected mutations.

Automated checks cover ten-call generation, all intermediate conservation
properties, the complete mutation matrix, unchanged frozen expectations, a fresh
reference replay, and PNML preservation for all seven nets. Browser checks repeat
reference generation and all six mutant replays on desktop and mobile.
