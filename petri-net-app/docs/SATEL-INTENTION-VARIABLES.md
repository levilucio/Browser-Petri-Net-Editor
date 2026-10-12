# SATEL Intention Language: Input/Output Pairs with Typed Variables

## Overview

This document specifies a **SATEL-style intention language** based on **input/output pairs**, following Buchs et al. (CO-OPN test language). The core abstraction is: a test is a **sequence of events**, each an **input** (transition firing with parameter terms over typed variables) paired with an **expected output** (observed tokens, marking predicates, or failure/non-firability), with an overall **test verdict** (true/false formula, HML-style).

Key principles:
- Tests are **abstract** over typed variables (`x: List`, `n: Nat`)
- Each event is `<input, output>`: input fires a transition, output checks observables
- Outputs are **observable** on APN output places or marking predicates
- Variables instantiated **symbolically** per hypothesis (uniformity, subuniformity, regularity)
- Oracle checks outputs against expected values
- Replaces current `{transition, binding}` PathEvent and intention-level `outputExpectations`

## Core Concepts

### 1. Input/Output Pairs

Tests are sequences of `<input, output>` pairs.

**Input:** A transition firing with parameter bindings (terms over variables)
**Output:** Expected observable result (tokens, marking predicate, or failure)

**Example:**
```
<input:  fire processOrder(order=$x, material=$m),
 output: tokens(scheduledJobs) = [job($x, $m)]>

<input:  fire startStage1(job=$x),
 output: tokens(stage1InProgress) = [job($x)] ∧ tokens(scheduledJobs) = []>

<input:  fire qualityCheck(job=$x, outcome=$qc),
 output: if $qc == 'pass' then tokens(completedProducts) += [product($x)]
         else tokens(reworkQueue) += [job($x)]>
```

### 2. Concrete Syntax

#### JSON Schema

```json
{
  "id": "intent-1",
  "name": "Complete production workflow",
  "variables": [
    { "name": "x", "sort": "Nat", "hypothesis": { "type": "uniformity", "representative": 1 } },
    { "name": "qc", "sort": "QualityStatus", "hypothesis": { "type": "subuniformity", "source": "axiom" } }
  ],
  "events": [
    {
      "input": {
        "transition": "processOrder",
        "parameters": { "order": "$x", "material": "10" }
      },
      "output": {
        "type": "tokens",
        "place": "scheduledJobs",
        "expected": [{ "job": "$x", "material": 10 }]
      }
    },
    {
      "input": {
        "transition": "qualityCheck",
        "parameters": { "job": "$x", "outcome": "$qc" }
      },
      "output": {
        "type": "conditional",
        "condition": "$qc == 'pass'",
        "thenOutput": {
          "type": "tokens",
          "place": "completedProducts",
          "expected": [{ "product": "$x" }]
        },
        "elseOutput": {
          "type": "tokens",
          "place": "reworkQueue",
          "expected": [{ "job": "$x" }]
        }
      }
    }
  ],
  "verdict": {
    "type": "formula",
    "formula": "∀ i. output_i.actual == output_i.expected"
  }
}
```

#### Textual Syntax (for UI/docs)

```
intent complete_production_workflow {
  variables:
    x : Nat with uniformity(1)
    qc : QualityStatus with subuniformity(axiom)
  
  events:
    <processOrder(order=$x, material=10),
     tokens(scheduledJobs) = [job($x, 10)]>
    
    <startStage1(job=$x),
     tokens(stage1InProgress) = [job($x)] ∧
     tokens(scheduledJobs) = []>
    
    <qualityCheck(job=$x, outcome=$qc),
     if $qc == 'pass'
       then tokens(completedProducts) += [product($x)]
       else tokens(reworkQueue) += [job($x)]>
  
  verdict: all_outputs_match
}
```

### 3. Output Types

Outputs map to APN observables:

#### 3.1 Token Observation

Observe tokens produced on output places.

**Syntax:**
```json
{
  "type": "tokens",
  "place": "completedProducts",
  "expected": [{ "product": "$x" }]
}
```

**Semantics:**
- After input fires, check `place.valueTokens`
- Match expected tokens modulo variable instantiation
- Exact match (default) or containment (`contains: true`)

**Variants:**
- `tokens(place) = [...]` - exact match
- `tokens(place) += [...]` - contains (for accumulating outputs)
- `tokens(place) = []` - empty

#### 3.2 Marking Predicate

Check a predicate over the full marking.

**Syntax:**
```json
{
  "type": "predicate",
  "formula": "tokens(scheduledJobs).length == 0"
}
```

**Semantics:**
- Evaluate boolean formula over marking
- Formula language: simple predicates (place token counts, token values)

**Examples:**
- `tokens(p1).length > 0` - place has tokens
- `tokens(p1)[0].value > 10` - first token value check
- `tokens(p1) == [] ∧ tokens(p2) == []` - both empty

#### 3.3 Failure/Non-Firability

Expect transition to be disabled or fail.

**Syntax:**
```json
{
  "type": "failure",
  "reason": "insufficient_material"
}
```

**Semantics:**
- Input transition should NOT fire (disabled or guard fails)
- Oracle checks `getEnabledTransitions()` excludes this transition
- Optional reason for documentation

**Example:**
```
<allocateMaterial(job=$x, needed=1000),
 failure("material supply exhausted")>
```

#### 3.4 Conditional Output

Output depends on variable values.

**Syntax:**
```json
{
  "type": "conditional",
  "condition": "$qc == 'pass'",
  "thenOutput": { "type": "tokens", "place": "completedProducts", ... },
  "elseOutput": { "type": "tokens", "place": "reworkQueue", ... }
}
```

**Semantics:**
- Evaluate condition with variable instantiation
- Check `thenOutput` or `elseOutput` depending on result

### 4. Typed Variables in Inputs and Outputs

Variables are declared once and used in both inputs and outputs.

**Declaration:**
```json
{
  "name": "x",
  "sort": "Nat",
  "hypothesis": { "type": "uniformity", "representative": 1 },
  "description": "Order ID"
}
```

**Input Usage:**
```json
{
  "input": {
    "transition": "processOrder",
    "parameters": {
      "order": "$x",           // Variable reference
      "material": "$m * 2"     // Expression over variable
    }
  }
}
```

**Output Usage:**
```json
{
  "output": {
    "type": "tokens",
    "place": "completedProducts",
    "expected": [
      { "product": "$x", "quality": "$qc" }  // Variables in expected tokens
    ]
  }
}
```

**Rules:**
- Variables prefixed with `$` in JSON
- Can appear in:
  - Input parameters (terms over variables)
  - Output expected tokens (variable values)
  - Output predicates (formula expressions)
  - Conditional output conditions

### 5. Per-Variable Hypotheses

Each variable has a hypothesis determining ground term generation.

#### 5.1 Uniformity

```json
{ "type": "uniformity", "representative": 5 }
```

**Generation:** Single ground term (the representative)
- `x: Nat` with `uniformity(5)` → `x ↦ {5}`

#### 5.2 Subuniformity

```json
{ 
  "type": "subuniformity", 
  "source": "guards" | "constructors" | "axiom",
  "axiom": "quality_outcomes"  // if source == "axiom"
}
```

**Generation:** One representative per equivalence class
- **From guards:** Parse transition guards, partition by boundary values
  - `x > 10` → classes `{x ≤ 10}, {x > 10}` → representatives `{10, 11}`
- **From constructors:** Walk ADT constructors, depth-bounded witnesses
  - `Option<T>` → `{None, Some(default(T))}`
  - `List<T>` → `{[], [default(T)]}`
- **From axiom:** Domain-specific partition
  - `axiom: quality_outcomes` → `{pass, fail}`

#### 5.3 Regularity

```json
{ 
  "type": "regularity", 
  "bounds": { "nbEvents": 5, "depth": 2 }
}
```

**Generation:** Bounded enumeration
- `nbEvents`: Max number of events in test
- `depth`: Max term depth for recursive ADTs
- Enumerate up to `nbTerms` representatives within bounds

### 6. Intention Inclusion

Intentions can include sub-intentions for composition.

**Syntax:**
```json
{
  "id": "workflow",
  "name": "Full Workflow",
  "includes": ["sub-workflow-1", "sub-workflow-2"],
  "events": [ /* additional events */ ]
}
```

**Semantics:**
- Included intentions' events are spliced in
- Variables scoped to parent intention
- Allows hierarchical test specification

### 7. Test Generation: Variable Instantiation

For each intention, generate concrete test cases by instantiating variables.

**Algorithm:**

```
function generateTestCases(intention):
  // 1. Generate ground terms per variable per hypothesis
  instantiations = {}
  for var in intention.variables:
    instantiations[var.name] = generateGroundTerms(var, petriNet)
  
  // 2. Cartesian product of instantiations
  combinations = cartesianProduct(instantiations)
  
  // 3. For each combination, instantiate event sequence
  testCases = []
  for inst in combinations:
    concreteEvents = []
    for event in intention.events:
      input = instantiateInput(event.input, inst)
      output = instantiateOutput(event.output, inst)
      concreteEvents.append(<input, output>)
    
    testCase = executeAndVerify(concreteEvents)
    testCases.append(testCase)
  
  return testCases
```

**Key:** Instantiation is **symbolic** (no concrete explosion):
- Generate representatives per hypothesis class
- Cartesian product gives all meaningful combinations
- Each combination is one test case

**Example:**
- Variables: `x: Nat` (subuniformity: `{0, 1}`), `qc: QualityStatus` (axiom: `{pass, fail}`)
- Instantiations: `x ↦ {0, 1}`, `qc ↦ {pass, fail}`
- Combinations: `{(x=0, qc=pass), (x=0, qc=fail), (x=1, qc=pass), (x=1, qc=fail)}`
- Result: 4 test cases

### 8. Oracle: Output Checking

For each `<input, output>` pair in a test case:

1. **Execute input:** Fire transition with parameter instantiation
2. **Observe actual output:** Read APN state (tokens, marking)
3. **Check expected output:** Compare actual vs expected
4. **Record verdict:** Pass/fail for this event

**Checking Logic by Output Type:**

#### Tokens
```javascript
function checkTokensOutput(actualMarking, expectedOutput, instantiation) {
  const actualTokens = actualMarking[expectedOutput.place].valueTokens;
  const expectedTokens = instantiateTerms(expectedOutput.expected, instantiation);
  
  if (expectedOutput.contains) {
    return expectedTokens.every(exp => 
      actualTokens.some(act => deepEqual(act, exp))
    );
  } else {
    return deepEqual(actualTokens, expectedTokens);
  }
}
```

#### Predicate
```javascript
function checkPredicateOutput(actualMarking, expectedOutput, instantiation) {
  const formula = instantiateFormula(expectedOutput.formula, instantiation);
  return evaluatePredicate(formula, actualMarking);
}
```

#### Failure
```javascript
function checkFailureOutput(actualMarking, input, expectedOutput) {
  const enabled = getEnabledTransitions(actualMarking);
  return !enabled.includes(input.transition);
}
```

#### Conditional
```javascript
function checkConditionalOutput(actualMarking, expectedOutput, instantiation) {
  const conditionHolds = evaluateCondition(expectedOutput.condition, instantiation);
  const relevantOutput = conditionHolds ? expectedOutput.thenOutput : expectedOutput.elseOutput;
  return checkOutput(actualMarking, relevantOutput, instantiation);
}
```

**Overall Verdict:**
```javascript
function computeVerdict(testCase) {
  return testCase.events.every(event => event.verdict === 'pass');
}
```

### 9. Replacing Current PathEvent Format

#### Current Format (Phase 1)

```json
{
  "pathPattern": {
    "type": "sequence",
    "events": [
      { "transition": "processOrder", "binding": { "order": 1, "material": 10 } },
      { "transition": "startStage1", "binding": { "job": 1 } }
    ]
  },
  "outputExpectations": [
    { "place": "completedProducts", "minTokens": 1 }
  ]
}
```

**Issues:**
- No per-event outputs
- Outputs checked at intention level, not per step
- Concrete bindings, not abstract variables

#### New Format (SATEL-style)

```json
{
  "variables": [
    { "name": "x", "sort": "Nat", "hypothesis": { "type": "uniformity", "representative": 1 } }
  ],
  "events": [
    {
      "input": { "transition": "processOrder", "parameters": { "order": "$x", "material": 10 } },
      "output": { "type": "tokens", "place": "scheduledJobs", "expected": [{ "job": "$x", "material": 10 }] }
    },
    {
      "input": { "transition": "startStage1", "parameters": { "job": "$x" } },
      "output": { "type": "tokens", "place": "stage1InProgress", "expected": [{ "job": "$x" }] }
    }
  ],
  "verdict": { "type": "formula", "formula": "all_outputs_match" }
}
```

**Benefits:**
- Per-event observables
- Abstract over variables
- Explicit input/output pairing
- Richer output types (tokens, predicates, failure, conditional)

### 10. UI Editing

#### Variable Panel

```
┌─ Variables ────────────────────────────────────────┐
│ + Add Variable                                      │
│                                                     │
│ Name: x          Sort: [Nat ▼]                     │
│ Hypothesis: [Subuniformity ▼]                      │
│   Source: [Guards ▼]                               │
│   Max representatives: [5]                          │
│                                                     │
│ Name: qc         Sort: [QualityStatus ▼]           │
│ Hypothesis: [Subuniformity ▼]                      │
│   Source: [Axiom ▼]                                │
│   Axiom: [quality_outcomes]                        │
└─────────────────────────────────────────────────────┘
```

#### Event Sequence Editor

```
┌─ Events ───────────────────────────────────────────┐
│ Event 1                                             │
│   Input:                                            │
│     Transition: [processOrder ▼]                   │
│     Parameters:                                     │
│       order    → [$x]       (variable)             │
│       material → [10]       (constant)             │
│                                                     │
│   Output:                                           │
│     Type: [Tokens ▼]                               │
│     Place: [scheduledJobs ▼]                       │
│     Expected: [{"job": "$x", "material": 10}]      │
│                                                     │
│ + Add Event                                         │
│                                                     │
│ Event 2                                             │
│   Input:                                            │
│     Transition: [qualityCheck ▼]                   │
│     Parameters:                                     │
│       job      → [$x]       (variable)             │
│       outcome  → [$qc]      (variable)             │
│                                                     │
│   Output:                                           │
│     Type: [Conditional ▼]                          │
│     Condition: [$qc == 'pass']                     │
│     Then:                                           │
│       Type: [Tokens ▼]                             │
│       Place: [completedProducts ▼]                 │
│       Expected: [{"product": "$x"}]                │
│     Else:                                           │
│       Type: [Tokens ▼]                             │
│       Place: [reworkQueue ▼]                       │
│       Expected: [{"job": "$x"}]                    │
└─────────────────────────────────────────────────────┘
```

#### Verdict Editor

```
┌─ Test Verdict ─────────────────────────────────────┐
│ Formula: [All outputs match ▼]                     │
│                                                     │
│ Custom formula (HML): [____________________________]│
└─────────────────────────────────────────────────────┘
```

### 11. Migration of Manufacturing Intentions

#### Example 1: Order Processing (Before)

```javascript
{
  id: 'order-processing',
  name: 'Process Order',
  pathPattern: {
    type: 'sequence',
    events: [
      { transition: 'scheduleJob', binding: { order: 1, material: 10 } },
      { transition: 'reserveMaterial', binding: { job: 1, material: 10 } }
    ]
  },
  outputExpectations: [
    { place: 'materialReserved', minTokens: 1 }
  ],
  reductionHypothesis: {
    type: 'uniformity',
    domain: 'order',
    representative: 1
  }
}
```

#### Example 1: Order Processing (After)

```javascript
{
  id: 'order-processing',
  name: 'Process Order',
  variables: [
    { 
      name: 'order', 
      sort: 'Nat', 
      hypothesis: { type: 'uniformity', representative: 1 },
      description: 'Order ID'
    },
    { 
      name: 'material', 
      sort: 'Nat', 
      hypothesis: { type: 'subuniformity', source: 'guards' },
      description: 'Material quantity (partitioned by availability)'
    }
  ],
  events: [
    {
      input: {
        transition: 'scheduleJob',
        parameters: { order: '$order', material: '$material' }
      },
      output: {
        type: 'tokens',
        place: 'scheduledJobs',
        expected: [{ job: '$order', material: '$material' }]
      }
    },
    {
      input: {
        transition: 'reserveMaterial',
        parameters: { job: '$order', material: '$material' }
      },
      output: {
        type: 'tokens',
        place: 'materialReserved',
        expected: [{ job: '$order', material: '$material' }]
      }
    }
  ],
  verdict: {
    type: 'formula',
    formula: 'all_outputs_match'
  }
}
```

**Changes:**
- Variables declared with hypotheses (uniformity, subuniformity)
- Events as `<input, output>` pairs
- Outputs explicit per event (tokens on specific places)
- Verdict formula replaces high-level expectations

#### Example 2: Quality Check (Before)

```javascript
{
  id: 'quality-check-pass',
  name: 'QC Pass',
  pathPattern: {
    type: 'sequence',
    events: [
      { transition: 'qualityCheck', binding: { job: 1, outcome: 'pass' } },
      { transition: 'finalizeProduct', binding: { product: 1 } }
    ]
  },
  outputExpectations: [
    { place: 'completedProducts', minTokens: 1 }
  ],
  reductionHypothesis: {
    type: 'axiom',
    domain: 'quality_outcomes',
    reason: 'Test pass outcome'
  }
}
```

#### Example 2: Quality Check (After)

```javascript
{
  id: 'quality-check',
  name: 'Quality Check',
  variables: [
    { 
      name: 'job', 
      sort: 'Nat', 
      hypothesis: { type: 'uniformity', representative: 1 }
    },
    { 
      name: 'outcome', 
      sort: 'QualityStatus', 
      hypothesis: { type: 'subuniformity', source: 'axiom', axiom: 'quality_outcomes' }
    }
  ],
  events: [
    {
      input: {
        transition: 'qualityCheck',
        parameters: { job: '$job', outcome: '$outcome' }
      },
      output: {
        type: 'conditional',
        condition: '$outcome == "pass"',
        thenOutput: {
          type: 'tokens',
          place: 'completedProducts',
          expected: [{ product: '$job' }]
        },
        elseOutput: {
          type: 'tokens',
          place: 'reworkQueue',
          expected: [{ job: '$job' }]
        }
      }
    }
  ],
  verdict: {
    type: 'formula',
    formula: 'all_outputs_match'
  }
}
```

**Changes:**
- Single intention covers both pass/fail outcomes (conditional output)
- No need for separate `quality-check-pass` and `quality-check-fail` intentions
- Outcome variable with axiom-based subuniformity
- Conditional output checks different places depending on outcome

#### Example 3: Material Exhaustion (Before)

```javascript
{
  id: 'material-exhaustion',
  name: 'Material Exhaustion',
  pathPattern: {
    type: 'sequence',
    events: [
      { transition: 'consumeMaterial', binding: { amount: 100 } },
      { transition: 'consumeMaterial', binding: { amount: 100 } },
      // Repeat until exhausted
    ]
  },
  outputExpectations: [
    { place: 'errorLog', minTokens: 1 }
  ]
}
```

#### Example 3: Material Exhaustion (After)

```javascript
{
  id: 'material-exhaustion',
  name: 'Material Exhaustion',
  variables: [
    { 
      name: 'remaining', 
      sort: 'Nat', 
      hypothesis: { type: 'subuniformity', source: 'guards' }
    }
  ],
  events: [
    {
      input: {
        transition: 'consumeMaterial',
        parameters: { amount: 50 }
      },
      output: {
        type: 'tokens',
        place: 'rawMaterialSupply',
        expected: [{ value: '$remaining - 50' }]
      }
    },
    {
      input: {
        transition: 'consumeMaterial',
        parameters: { amount: 100 }
      },
      output: {
        type: 'failure',
        reason: 'insufficient_material'
      }
    }
  ],
  verdict: {
    type: 'formula',
    formula: 'event[1].output_type == "failure"'
  }
}
```

**Changes:**
- Explicit failure output type
- Guards partition `remaining` material (subuniformity)
- Verdict checks that second consumption fails
- Oracle verifies transition is disabled

### 12. Relation to Original SATEL (Buchs et al.)

#### Original SATEL (CO-OPN, 1990s)

**Key features:**
- Tests specified in CO-OPN (Concurrent Object-Oriented Petri Nets)
- `<method call, expected state>` pairs
- State predicates in first-order logic
- Symbolic execution with SAT/SMT
- Partition-based equivalence classes

**Example (conceptual):**
```
test order_processing {
  pre: order_queue.size == 1
  call: process_order(order_id)
  post: scheduled_jobs.size == 1 ∧ scheduled_jobs[0].id == order_id
}
```

#### Our Design (Browser APN, 2026)

**Similarities:**
- ✅ Input/output pair structure
- ✅ Typed variables with sorts
- ✅ Partition-based equivalence (subuniformity)
- ✅ Symbolic generation (no concrete explosion)

**Divergences:**
1. **No full CO-OPN:** We use JSON/JavaScript, not CO-OPN formalism
2. **Simplified predicates:** Boolean formulas, not full FOL
3. **Token-centric:** Outputs are tokens on places, not arbitrary state predicates
4. **No method objects:** Transitions are global, not object methods
5. **Depth-bounded ADTs:** Recursive ADTs bounded by depth, not full inductive types

**Uncertain:**
1. **HML verdicts:** We mention HML-style formulas but don't implement full HML (Hennessy-Milner Logic)
2. **Partition refinement:** How to handle multi-variable guards (joint partition vs independent)?
3. **Oracle completeness:** Are token observations + predicates sufficient for all test properties?

#### BGM Contributions (2000s)

**Key features:**
- Model-based testing framework
- Abstraction functions for state equivalence
- Coverage criteria (transition/state/path)

**Adopted:**
- Abstraction via equivalence classes (subuniformity)
- Coverage via intention set (each intention is a test purpose)

**Not adopted:**
- No explicit abstraction function language (hypotheses are implicit abstractions)
- No formal coverage metrics (user defines intentions, not automated criteria)

### 13. Open Questions

#### 13.1 Expression Language Complexity

**Question:** How expressive should parameter expressions be?

**Current:** Simple references (`$x`) and arithmetic (`$x * 2`)

**Uncertain:**
- Function application? (`unwrap($opt)`, `head($lst)`, `length($lst)`)
- Guards in inputs? (`fire t(x=$x) where x > 0`)
- Complex expressions? (`$x + $y * factorial($z)`)

**Trade-off:** Richer language vs simpler implementation

#### 13.2 Output Observation Completeness

**Question:** Are tokens + predicates sufficient for all test properties?

**Current outputs:**
- Token values on output places
- Marking predicates (place counts)
- Failure (transition disabled)

**Missing:**
- Trace properties (HML formulas like `◇ eventually p`)
- Liveness properties (infinitely often, fairness)
- Multi-step observations (output after N steps)

**Trade-off:** Expressiveness vs oracle complexity

#### 13.3 Conditional Output Complexity

**Question:** How complex should conditional outputs be?

**Current:** Simple `if-then-else` on variable values

**Uncertain:**
- Nested conditionals? (`if-then-elseif-else`)
- Multiple conditions? (`if ($x > 0 ∧ $y < 10)`)
- Pattern matching? (`match $opt { None => ..., Some(v) => ... }`)

**Trade-off:** Expressiveness vs readability/simplicity

#### 13.4 Multi-Variable Partition Strategy

**Question:** How to generate representatives when guards involve multiple variables?

**Example:** Guard `x + y > 10`

**Options:**
1. **Independent partition:** Partition `x` and `y` separately, Cartesian product
   - Simple but may miss boundary cases
2. **Joint partition:** Partition the space `(x, y)` together
   - Complete but exponential growth
3. **Heuristic:** Sample along boundary (`x + y == 10`)
   - Practical but incomplete

**Current:** Unclear, likely option 1 (independent)

#### 13.5 Intention Inclusion Semantics

**Question:** How do included intentions interact with parent variables?

**Example:**
```javascript
{
  id: 'parent',
  variables: [{ name: 'x', sort: 'Nat', hypothesis: {...} }],
  includes: ['child-intention'],
  events: [...]
}
```

**Uncertain:**
- Does child see parent's `x`?
- Can child declare same variable with different hypothesis?
- How are events spliced (before parent's events, after, interleaved)?

**Need:** Clear scoping and composition rules

#### 13.6 Failure vs Non-Determinism

**Question:** How to distinguish failure (transition disabled) from non-determinism (multiple enabled transitions)?

**Scenario:** If multiple transitions are enabled, which fires?

**Current:** Oracle checks if specific transition is disabled

**Uncertain:**
- What if intention expects transition X but Y fires instead?
- Is this a failure or acceptable non-determinism?
- Should intentions specify deterministic execution order?

**Need:** Clarify non-determinism handling in intentions

#### 13.7 Performance with Large Cartesian Products

**Question:** How to keep generation responsive when Cartesian product explodes?

**Example:** 5 variables, each with 10 representatives → 10^5 = 100,000 test cases

**Strategies:**
1. **User limits:** Max test cases per intention
2. **Prioritization:** Generate critical combinations first
3. **Lazy generation:** Generate on-demand, not all upfront
4. **Sampling:** Random sample from Cartesian product

**Trade-off:** Coverage vs performance

#### 13.8 Verdict Formula Language

**Question:** What is the syntax/semantics of verdict formulas?

**Current examples:**
- `all_outputs_match` (default)
- `event[1].output_type == "failure"` (custom)

**Uncertain:**
- Full HML syntax? (`◇ p`, `□ p`, `p ∨ q`)
- Temporal operators? (`eventually`, `always`, `until`)
- Quantifiers? (`∀ i. event[i].verdict == pass`)

**Need:** Specify formula language precisely or restrict to simple boolean formulas

#### 13.9 Migration Effort

**Question:** How to migrate existing 15 Manufacturing intentions?

**Effort estimate:**
- Manual rewrite: ~30 min per intention
- Semi-automated: Parse old format, generate new skeleton
- Fully automated: Impossible (outputs not specified in old format)

**Strategy:**
1. Provide migration tool (old → new skeleton)
2. User fills in output specifications manually
3. Document migration patterns (common idioms)

#### 13.10 Validation and Debugging

**Question:** How to help users debug failed tests?

**Needs:**
- Show actual vs expected output diffs
- Highlight which event failed in sequence
- Trace variable instantiations
- Replay failed test case step-by-step

**UI features:**
- Diff viewer for token lists
- Event timeline with pass/fail markers
- Variable binding inspector
- Rerun single test case

## Conclusion

This SATEL-style intention language provides:
1. **Abstract tests** over typed variables
2. **Input/output pairs** as core abstraction
3. **Observable outputs** (tokens, predicates, failure)
4. **Symbolic generation** (no concrete explosion)
5. **Rich hypotheses** (uniformity, subuniformity, regularity)
6. **Oracle checking** per event
7. **Explicit migration path** from current format

**Divergences from original SATEL:**
- Simplified predicate language (not full FOL)
- Token-centric outputs (not arbitrary state predicates)
- No CO-OPN formalism (JSON/JavaScript)
- Depth-bounded ADTs (not full inductive types)

**Open questions** (10 listed above) require design decisions and prototyping.

**Next steps:**
- Resolve open questions through prototyping
- Implement JSON schema validation
- Build UI editors for variables and events
- Migrate Manufacturing intentions with 3 examples
- Implement oracle checking for all output types
