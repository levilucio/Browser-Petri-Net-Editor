# Warehouse/order experiment contract

Increment 52, 31 October 2026. Baseline contract, written before the SUT.

## Scope and synchronous interface

Independent Python/SQLite REST application and browser UI. Each method completes
with one gate observation or refusal before the next call. No asynchronous jobs,
payments or shipping integrations. Actors authenticate; roles and tenant come
from the database. Actor IDs are stimulation parameters in the APN, translated to
login sessions by the adapters, never trusted as authorization claims by the API.

Roles: sales (1), manager (2), warehouse operator (3), auditor (4). Any role may
read objects in its tenant. Only the owning salesperson edits a draft. Managers
approve/reject submitted orders, reopen closed orders and configure catalog and
warehouse availability. Warehouse operators reserve, release, ship, return and
move stock. Managers may cancel draft/submitted orders; the owner may also do so.

## State and operations

Order states: unused slot 0 (APN only), draft 1, submitted 2, approved 3,
closed 4, cancelled 5. Line states: empty slot 0, active 1, cancelled 2.
The APN reserves bounded unused order/line IDs; the database creates actual records.
Ownership is assigned at creation: an order belongs to its creating actor’s tenant,
and a new line belongs to the order supplied by its creator. Unused numeric IDs
do not encode tenant/order ownership. Removing a draft line frees its ID for reuse.
This clarification follows the preserved `initial-slot-ownership` discrepancy.
IDs, roles, products and warehouses are token data, never specialized transitions.

- Open an order in its tenant. Add, amend or remove lines only in an owned draft.
  Positive quantities are at most 100 per line. Products must be active and
  warehouses open when adding/amending; removal remains possible after closure.
- Submit a nonempty draft; manager approves or rejects it back to draft.
  Draft/submitted orders can be cancelled as a whole; line data remain historical.
- Reserve a positive quantity on an active approved-order line, limited by its
  unshipped/unreserved quantity and the stock's unreserved on-hand amount. Product
  and warehouse must be enabled. Release reservation without requiring availability.
- Atomic `reservePair` reserves positive quantities on two distinct lines of the
  same approved order. Both checks must succeed before any write. If they share a
  stock row, the sum must fit. Both lines must share the supplied warehouse;
  distinct products and duplicate products are both supported. One order audit event.
- Ship a positive reserved quantity while its warehouse is open. Shipping reduces
  on-hand, line/order reservations and order pending quantity; increases shipped.
  Product deactivation does not invalidate an already reserved shipment.
- Return a positive quantity no greater than shipped minus already returned.
  Order must be approved and warehouse open. Returns restore physical stock and
  increase return counts; they do not create new demand or reservations.
- Cancel an active approved-order line with remaining demand. Release all its
  reservation, discard its unshipped demand, preserve shipments and returns.
  Returns on a cancelled line remain possible. Cancelled lines cannot be reserved.
- Close an approved order only when pending demand and reservations are zero.
  Manager may reopen a closed order to approved for returns, then close it again.
- Receive positive stock; adjust physical stock to a nonnegative count not below
  reserved stock; transfer a positive unreserved quantity between distinct open
  warehouses in the same tenant for one product. Stock adjustments do not alter
  reservations. Transfers conserve combined physical stock.
- Managers enable/disable products and open/close warehouses; requesting their
  current state is refused. Existing reservations remain when availability changes.

Every successful order mutation increments its audit count exactly once. Reads,
refusals and inventory/catalog-only operations do not change that count. All
successful writes also have a database audit/stock-movement record. Refusals must
roll back all domain writes and audit records. API malformed input/transport
errors are distinguished from valid typed calls refused by domain rules.

## Observations and invariants

Gates: acknowledgement; order state/count/pending/reserved/shipped/returned;
line product/warehouse/quantity/reserved/shipped/returned/state; stock
on-hand/reserved; product and warehouse availability; order audit count; order
shipped/returned totals. Tuple ordering is fixed by the independent adapters.

For active orders: order aggregates equal the sums of their line quantities;
pending excludes shipped and cancelled demand. For each stock row, reserved
equals outstanding line reservations. Always 0 <= reserved <= on-hand and
0 <= returned <= shipped. Receipts, shipments, returns, adjustments and transfers
must reconcile physical stock with the database movement ledger. Whole-order
cancellation leaves historical lines intact and sets pending to zero.

## Planned baseline and limits

Target: 42 generic transitions (HR: 21), multiple orders/products/warehouses.
Two-line recursive `Basket` intentions distinguish duplicate products from distinct
products and derive availability classes using aggregate quantities. Additional
workflows cover lifecycle, roles, cancellation, returns, inventory and refusals.
All generated tests use APN admission; expected SUT values never come from its DB.
Baseline REST and browser campaigns precede any mutation campaign. A large seeded
database is usability/load context, not proof of large APN exploration.

Scaling and random-comparison campaigns are follow-up experiments; this increment
establishes the contract, working application, baseline and reproducible evidence.

## Unseeded defect preservation

Before fixing any observed baseline discrepancy, run `experiments/preserve.py`
with the failing report and a factual description. It snapshots SUT source,
model/adapter/generator source, generated suites and source hashes into a new
evidence directory. Preserve the failing stimulus, expected/actual observations,
environment, seed and reproduction command. Classify the cause only after
investigation; keep APN, adapter and harness defects separate from SUT defects.
Never fabricate a defect or introduce mutations to make this inventory nonempty.
Snapshots contain synthetic data only; no live session credentials or personal DBs.
