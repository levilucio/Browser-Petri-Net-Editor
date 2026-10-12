# SATEL Intention Language: Stimulation/Observation Pairs

## Overview

SATEL-style test intentions specify sequences of **<stimulation, observation>** pairs over **typed variables**. Each test is labeled **positive** (valid, must be accepted) or **negative** (invalid, must not be accepted). Tests are abstract over variables instantiated per hypothesis (uniformity, subuniformity, regularity).

**Key Decisions:**
- No Z3/SMT: constructor and guard-based partitioning only
- No HML/verdict formulas: positive/negative test semantics
- Expression language: only ADT terms (constructors, operations, variables)
- Observations: tokens on output places + marking of other places
- Multi-variable guards: partition separately, cross-product, drop infeasible
- Variables: typed (ADT sorts), per-intention, with per-variable hypotheses

## Core: Stimulation/Observation Pairs

### Structure

A test is a sequence of pairs:
```
Test ::= <s₁, o₁>, <s₂, o₂>, ..., <sₙ, oₙ>
```

Where:
- **Stimulation (s)**: Fire transition with input tokens (terms over variables)
- **Observation (o)**: Expected output tokens + marking of specified places

### Positive vs Negative Tests

- **Positive test:** All pairs must succeed (stimulation fires, observation matches)
- **Negative test:** At least one pair must fail (stimulation cannot fire OR observation mismatch)

A negative test is **invalid** if ANY pair fails, not just the last.

## JSON Schema

```json
{
  "id": "intent-1",
  "name": "Process Order",
  "testType": "positive",
  "variables": [
    { 
      "name": "order", 
      "sort": "Order",
      "hypothesis": { "type": "uniformity", "representative": { "id": 1, "priority": "normal" } }
    },
    { 
      "name": "material", 
      "sort": "Material",
      "hypothesis": { "type": "subuniformity", "source": "constructors" }
    }
  ],
  "pairs": [
    {
      "stimulation": {
        "transition": "scheduleJob",
        "inputs": {
          "orderQueue": ["$order"],
          "rawMaterialSupply": ["$material"]
        }
      },
      "observation": {
        "outputs": {
          "scheduledJobs": [{ "order": "$order", "material": "$material" }]
        },
        "markings": {
          "orderQueue": { "length": 0 },
          "machineStatus": { "length": 3 }
        }
      }
    },
    {
      "stimulation": {
        "transition": "startStage1",
        "inputs": {
          "scheduledJobs": [{ "order": "$order", "material": "$material" }]
        }
      },
      "observation": {
        "outputs": {
          "stage1InProgress": [{ "order": "$order", "material": "$material" }]
        }
      }
    }
  ]
}
```

## Stimulation

Fire transition consuming input tokens.

**Syntax:**
```json
{
  "transition": "processOrder",
  "inputs": {
    "orderQueue": ["$order"],          // Variable reference
    "rawMaterialSupply": ["$material"] // Variable reference
  }
}
```

**Semantics:**
1. Consume specified tokens from input places
2. Fire transition with binding derived from consumed tokens
3. Produce tokens on output arcs

**Input tokens:**
- Terms over variables: `$order`, `$material`
- ADT constructors: `Order { id: $n, priority: "high" }`
- ADT operations: `append($lst, $item)` (if ADT defines append)

## Observation

Check expected tokens on output places and optionally marking of other places.

**Syntax:**
```json
{
  "outputs": {
    "completedProducts": [{ "product": "$order" }]
  },
  "markings": {
    "scheduledJobs": { "length": 0 },
    "machineStatus": { "length": 3 }
  }
}
```

**Semantics:**
- **outputs**: Exact match of tokens on specified output places
  - Deep equality check after variable instantiation
- **markings** (optional): Check properties of other places
  - `length`: number of tokens
  - `contains`: place contains specific token(s)
  - `empty`: place has no tokens

**Match semantics:**
- Positive test: observation must match exactly
- Negative test: observation must NOT match (or stimulation cannot fire)

## Typed Variables

Variables declared per intention with ADT sorts.

**Declaration:**
```json
{
  "name": "order",
  "sort": "Order",
  "hypothesis": { "type": "uniformity", "representative": { "id": 1, "priority": "normal" } },
  "description": "Production order"
}
```

**Sorts:**
- ADT types from Petri net definitions: `Order`, `Material`, `QualityStatus`
- Built-in types: `Nat`, `Int`, `Bool`, `String`, `List<T>`, `Option<T>`

**Usage:**
- Stimulation inputs: `$order`, `{ order: $order, material: $material }`
- Observation outputs: `[{ product: $order, status: $qc }]`

## Per-Variable Hypotheses

### Uniformity

One arbitrary ground term.

```json
{ 
  "type": "uniformity", 
  "representative": { "id": 1, "priority": "normal" } 
}
```

**Generation:** Single term (user-specified or default)

### Subuniformity

One term per equivalence class (symbolic, no concrete explosion).

```json
{ 
  "type": "subuniformity", 
  "source": "constructors" | "guards" | "axiom"
}
```

**Sources:**

1. **Constructors** (ADT-based):
   - Walk ADT constructors, generate one witness per constructor
   - `Option<T>` → `{None, Some(default(T))}`
   - `List<T>` → `{[], [default(T)]}`
   - Depth-bounded for recursive ADTs

2. **Guards** (predicate-based):
   - Parse guards mentioning variable
   - Partition by boundary values
   - `x > 10` → classes `{x ≤ 10}, {x > 10}` → representatives `{10, 11}`

3. **Axiom** (domain-specific):
   - Named partition: `{ "source": "axiom", "axiom": "quality_outcomes" }`
   - User-defined classes: `{pass, fail}`

### Regularity

Bounded term depth/event count.

```json
{ 
  "type": "regularity", 
  "bounds": { "depth": 2, "nbEvents": 5 } 
}
```

**Generation:** Enumerate terms within bounds

## Multi-Variable Guards

For guards over multiple variables (e.g., `x + y > 10`):

1. **Partition each variable separately** (independent)
2. **Cartesian product** of representatives
3. **Drop infeasible combinations** by evaluating joint guard

**Example:**
- Guard: `order.priority == "high" ∧ material.quantity > 50`
- Variables:
  - `order` → `{Order{id:1, priority:"high"}, Order{id:2, priority:"low"}}`
  - `material` → `{Material{qty:30}, Material{qty:100}}`
- Cross-product: 4 combinations
- Evaluate guard: keep only `(high, 100)` and drop `(high, 30)`, `(low, 30)`, `(low, 100)`

**No Z3:** Guard evaluation is simple boolean check on representative values, not SMT solving.

## Ground Term Generation

For each intention:

```javascript
function generateTestCases(intention) {
  // 1. Generate representatives per variable per hypothesis
  const instantiations = {};
  for (const v of intention.variables) {
    instantiations[v.name] = generateRepresentatives(v, petriNet);
  }
  
  // 2. Cartesian product
  let combinations = cartesianProduct(instantiations);
  
  // 3. Drop infeasible (multi-variable guards)
  const guards = extractGuardsFromIntention(intention);
  combinations = combinations.filter(inst => 
    guards.every(g => evaluateGuard(g, inst))
  );
  
  // 4. Instantiate pairs for each combination
  const testCases = [];
  for (const inst of combinations) {
    const pairs = intention.pairs.map(p => ({
      stimulation: instantiate(p.stimulation, inst),
      observation: instantiate(p.observation, inst)
    }));
    testCases.push({ ...intention, pairs, instantiation: inst });
  }
  
  return testCases;
}
```

**Key:** Symbolic generation - representatives from hypotheses, not full enumeration.

## Oracle: Observation Checking

For each pair:

```javascript
async function checkPair(pair, marking) {
  // 1. Execute stimulation
  const newMarking = await fireTransition(
    pair.stimulation.transition,
    pair.stimulation.inputs,
    marking
  );
  
  if (!newMarking) {
    // Transition could not fire
    return { success: false, reason: "stimulation_failed" };
  }
  
  // 2. Check outputs
  for (const [place, expected] of Object.entries(pair.observation.outputs)) {
    const actual = newMarking[place].valueTokens;
    if (!deepEqual(actual, expected)) {
      return { success: false, reason: "output_mismatch", place, actual, expected };
    }
  }
  
  // 3. Check markings (optional)
  if (pair.observation.markings) {
    for (const [place, constraint] of Object.entries(pair.observation.markings)) {
      const tokens = newMarking[place].valueTokens;
      if (constraint.length !== undefined && tokens.length !== constraint.length) {
        return { success: false, reason: "marking_mismatch", place };
      }
      if (constraint.empty && tokens.length !== 0) {
        return { success: false, reason: "marking_not_empty", place };
      }
      // ... other constraints
    }
  }
  
  return { success: true, marking: newMarking };
}
```

**Verdict:**
- **Positive test:** All pairs succeed
- **Negative test:** At least one pair fails (intentional failure)

## Expression Language

Only terms expressible with ADT definitions.

**Allowed:**
- Variable references: `$order`, `$material`
- ADT constructors: `Order { id: $n, priority: "high" }`
- ADT field access: `$order.id`, `$material.quantity`
- ADT operations (if defined): `append($lst, $item)`, `length($lst)`

**Not allowed:**
- Arbitrary functions: `factorial($n)`, `fibonacci($x)`
- Complex expressions: `$x + $y * sqrt($z)`
- Guards in inputs: `fire t($x) where $x > 0`

**Rationale:** Keep language aligned with ADT definitions, no external function library.

## Migration: Manufacturing Example

### Existing ADTs in Repo

Assume repo has:
```javascript
// order.adt.js
export const Order = {
  name: 'Order',
  constructors: [
    { name: 'Order', fields: [
      { name: 'id', type: 'Nat' },
      { name: 'priority', type: 'Priority' }
    ]}
  ]
};

export const Priority = {
  name: 'Priority',
  constructors: [
    { name: 'Low', fields: [] },
    { name: 'Normal', fields: [] },
    { name: 'High', fields: [] }
  ]
};

export const Material = {
  name: 'Material',
  constructors: [
    { name: 'Material', fields: [
      { name: 'quantity', type: 'Nat' }
    ]}
  ]
};
```

### Before (Current)

```javascript
{
  id: 'order-processing',
  pathPattern: {
    events: [
      { transition: 'scheduleJob', binding: { order: 1, material: 10 } }
    ]
  },
  outputExpectations: [
    { place: 'scheduledJobs', minTokens: 1 }
  ]
}
```

### After (New)

```javascript
{
  id: 'order-processing',
  name: 'Process Order',
  testType: 'positive',
  variables: [
    { 
      name: 'order', 
      sort: 'Order',
      hypothesis: { 
        type: 'uniformity', 
        representative: { id: 1, priority: 'Normal' } 
      }
    },
    { 
      name: 'material', 
      sort: 'Material',
      hypothesis: { 
        type: 'subuniformity', 
        source: 'guards' // Partitioned by material availability guards
      }
    }
  ],
  pairs: [
    {
      stimulation: {
        transition: 'scheduleJob',
        inputs: {
          'orderQueue': ['$order'],
          'rawMaterialSupply': ['$material']
        }
      },
      observation: {
        outputs: {
          'scheduledJobs': [{ order: '$order', material: '$material' }]
        },
        markings: {
          'orderQueue': { length: 0 }
        }
      }
    }
  ]
}
```

## UI Editing

### Variable Panel

```
┌─ Variables ────────────────────────────────────┐
│ + Add Variable                                  │
│                                                 │
│ Name: order      Sort: [Order ▼]               │
│ Hypothesis: [Uniformity ▼]                     │
│   Representative:                               │
│   { id: [1], priority: [Normal ▼] }           │
│                                                 │
│ Name: material   Sort: [Material ▼]            │
│ Hypothesis: [Subuniformity ▼]                  │
│   Source: [Guards ▼]                           │
└─────────────────────────────────────────────────┘
```

### Stimulation/Observation Pairs Editor

```
┌─ Test Pairs ───────────────────────────────────┐
│ Test Type: ○ Positive  ○ Negative              │
│                                                 │
│ Pair 1                                          │
│   Stimulation:                                  │
│     Transition: [scheduleJob ▼]                │
│     Inputs:                                     │
│       orderQueue → [$order]                    │
│       rawMaterialSupply → [$material]          │
│                                                 │
│   Observation:                                  │
│     Output tokens:                              │
│       scheduledJobs: [{ order: $order, ... }]  │
│     Marking checks:                             │
│       orderQueue: length = 0                   │
│                                                 │
│ + Add Pair                                      │
└─────────────────────────────────────────────────┘
```

### Execute Tests Panel

Shows per-pair results:

```
┌─ Test Results ─────────────────────────────────┐
│ Test: Process Order (Positive)                 │
│ Variables: order=Order{id:1,priority:Normal}   │
│                                                 │
│ ✅ Pair 1: scheduleJob                         │
│    Stimulation: OK                              │
│    Observation: Matched                         │
│                                                 │
│ ❌ Pair 2: startStage1                         │
│    Stimulation: OK                              │
│    Observation: MISMATCH                        │
│      Expected: [{ order: ... }]                │
│      Actual: []                                 │
│                                                 │
│ Overall: FAIL (1/2 pairs passed)               │
└─────────────────────────────────────────────────┘
```

## Intention Inclusion

Intentions can include sub-intentions.

```json
{
  "id": "full-workflow",
  "includes": ["order-processing", "quality-check"],
  "variables": [ /* parent variables */ ],
  "pairs": [ /* additional pairs */ ]
}
```

**Semantics:**
- Included intentions' pairs are spliced in order
- Variables are parent-scoped (child sees parent variables)
- Child cannot redeclare same variable

## Divergences from Original SATEL

### Kept from SATEL
- ✅ Stimulation/observation pairs
- ✅ Typed variables with sorts
- ✅ Partition-based equivalence (subuniformity)
- ✅ Symbolic generation (no concrete explosion)
- ✅ Positive/negative test semantics

### Diverged
- ❌ No CO-OPN formalism (use JSON/JavaScript)
- ❌ No Z3/SMT (constructor/guard partitioning only)
- ❌ No HML/temporal logic (simple positive/negative)
- ❌ No arbitrary state predicates (only output tokens + marking checks)
- ❌ No method objects (transitions are global, not object methods)

### Simplified
- Token-centric observations (not arbitrary FOL predicates)
- Multi-variable guards: independent partition + cross-product + filter
- Expression language: only ADT terms (no external functions)

## Known Limitations

1. **No SMT solving:** Guards evaluated on representatives, not symbolically solved
2. **Independent multi-var partitioning:** May miss boundary cases in joint constraints
3. **No liveness properties:** Only safety (token presence/absence)
4. **Depth-bounded ADTs:** Recursive types truncated at user-specified depth
5. **No temporal operators:** Cannot express "eventually" or "always"
6. **Simple marking checks:** Only length, contains, empty (not arbitrary predicates)

## Implementation Notes

### Async + Cancellation

All generation/execution is async with cancellation support:

```javascript
async function generateTests(intentions, options) {
  const { signal, onProgress } = options;
  
  for (let i = 0; i < intentions.length; i++) {
    if (signal?.aborted) throw new AbortError();
    
    const cases = await generateTestCases(intentions[i]);
    onProgress({ current: i+1, total: intentions.length });
    
    yield; // Keep UI responsive
  }
}
```

### Keeping Layouts

Auto-layout and manual layouts unaffected. Test generation is purely logical.

## Open Questions

1. **Negative test semantics precision:** Does first failure short-circuit or continue?
2. **Marking check completeness:** What other checks needed beyond length/contains/empty?
3. **ADT operation library:** Which operations are standard (length, append, head, tail)?
4. **Guard extraction from nets:** How to infer guards from transition definitions?
5. **Performance limits:** Max variables? Max representatives per variable?
6. **Migration automation:** Semi-automated tool to convert old intentions?

## Conclusion

This SATEL-style intention language provides:
- **Stimulation/observation pairs** over typed variables
- **Positive/negative test semantics** (no HML)
- **Symbolic generation** via hypotheses (uniformity, subuniformity, regularity)
- **Observable outputs** (tokens + markings)
- **ADT-aligned expression language**
- **Multi-variable guard handling** (partition, cross-product, filter)

Honest about divergences (no Z3, no CO-OPN, simplified observations) and limitations (no liveness, depth-bounded ADTs).

Ready for implementation.
