# SATEL Intention Variables Design

## Overview

This document designs a **SATEL-style intention language** with typed variable declarations, per-variable hypotheses, and symbolic ground term generation. The goal is to express test intentions abstractly over symbolic variables, then generate concrete test cases by instantiating variables according to reduction hypotheses.

## Motivation

Current state (as of Phase 1):
- **Concrete paths**: Intentions specify explicit transition sequences with concrete token values
- **No abstraction**: Each intention hardcodes specific bindings (e.g., `order=1`, `material=10`)
- **Limited reduction**: Reduction hypotheses apply post-hoc to generated cases

Desired state (SATEL-style):
- **Symbolic paths**: Intentions use typed variables (e.g., `x: List`, `n: Nat`)
- **Hypothesis-driven generation**: Variables instantiated per hypothesis (uniformity, subuniformity, regularity)
- **Symbolic reasoning**: Ground terms generated symbolically without concrete explosion

## Core Concepts

### 1. Typed Variable Declarations

Variables are declared with algebraic types from the Petri net's ADT definitions.

**Syntax:**
```javascript
{
  id: 'intent-1',
  name: 'Process non-empty lists',
  variables: [
    { name: 'lst', sort: 'List', description: 'Input list' },
    { name: 'n', sort: 'Nat', description: 'List length bound' }
  ],
  // ... rest of intention
}
```

**Semantics:**
- Each variable `v` has a declared sort `S` (e.g., `List`, `Option`, `Nat`)
- Variables can appear in path events as transition parameters or input token expressions
- Variables are bound to ground terms during test case generation

### 2. Per-Variable Hypotheses

Each variable has an associated hypothesis that determines how ground terms are generated.

**Types of Hypotheses:**

#### 2.1 Uniformity

"Behavior is uniform over variable's domain; test one arbitrary representative."

```javascript
{
  name: 'x',
  sort: 'Nat',
  hypothesis: { type: 'uniformity', representative: 5 }
}
```

**Generation:**
- Single ground term: the specified representative
- For `x: Nat` with `uniformity(x, 5)`: generate `x ↦ 5`

#### 2.2 Subuniformity

"Partition domain by guards/constructors/axioms; test one representative per class."

```javascript
{
  name: 'opt',
  sort: 'Option',
  hypothesis: { type: 'subuniformity', source: 'constructors' }
}
```

**Generation (symbolic):**
1. **From guards**: Parse transition guards mentioning variable, extract predicates, partition by boundary values
   - `x > 10` → classes: `{x ≤ 10}, {x > 10}` → representatives: `{10, 11}`
   - `x == 0` → classes: `{x = 0}, {x ≠ 0}` → representatives: `{0, 1}`

2. **From ADT constructors**: Walk constructor signatures, generate one witness per constructor (depth-bounded)
   - `Option<T>` → classes: `{None}, {Some(_)}` → representatives: `{None, Some(default(T))}`
   - `List<T>` → classes: `{[]}, {[_|_]}` → representatives: `{[], [default(T)]}`

3. **From axioms**: Domain-specific partition rules (e.g., quality outcomes: `{pass, fail}`)
   - User-specified partition: `{ axiom: 'quality', classes: ['pass', 'fail'] }`

**Key property:** No concrete explosion — representatives generated symbolically, not by enumerating all values then filtering.

#### 2.3 Regularity

"Bound term depth/complexity; enumerate within bound."

```javascript
{
  name: 'tree',
  sort: 'Tree',
  hypothesis: { type: 'regularity', depth: 2, nbTerms: 5 }
}
```

**Generation (bounded enumeration):**
- Generate up to `nbTerms` ground terms with depth ≤ `depth`
- For recursive ADTs (Tree, List), enumerate constructors up to depth limit
- Examples: `Tree` with `depth=2` → `{Leaf, Node(Leaf, Leaf), Node(Leaf, Node(Leaf, Leaf)), ...}` (up to 5 terms)

### 3. Path Events with Variables

Intention path patterns reference variables as transition parameters or input tokens.

**Syntax:**
```javascript
{
  pathPattern: {
    type: 'sequence',
    events: [
      {
        transition: 'processRequest',
        binding: { req: '$opt' }, // Variable reference
        constraint: 'isSome(req)'  // Symbolic constraint
      },
      {
        transition: 'produceResult',
        binding: { value: 'unwrap($opt)' } // Term over variable
      }
    ]
  }
}
```

**Semantics:**
- `$var` denotes a variable reference
- Binding expressions can be terms over variables (e.g., `unwrap($opt)`, `head($lst)`)
- Constraints are predicates that must hold for the instantiated binding

### 4. Ground Term Generation

For each intention, generate one test case per variable instantiation.

**Algorithm:**

```
function generateTestCases(intention, petriNet):
  // 1. Extract variable hypotheses
  hypotheses = intention.variables.map(v => (v.name, v.hypothesis))
  
  // 2. Generate ground terms per variable per hypothesis
  instantiations = {}
  for (varName, hypothesis) in hypotheses:
    instantiations[varName] = generateGroundTerms(varName, hypothesis, petriNet)
  
  // 3. Compute Cartesian product of instantiations
  combinations = cartesianProduct(instantiations)
  
  // 4. For each combination, instantiate path and generate test case
  testCases = []
  for instantiation in combinations:
    concretePath = instantiatePathPattern(intention.pathPattern, instantiation)
    testCase = findPathInGraph(concretePath, reachabilityGraph)
    if testCase: testCases.append(testCase)
  
  return testCases
```

**Example:**

Intent with variables `x: Nat` (subuniformity: classes `{≤0, >0}`) and `lst: List` (subuniformity: constructors `{[], [_]}`)

Instantiations:
- `x ↦ {0, 1}` (representatives for classes)
- `lst ↦ {[], [0]}` (representatives for constructors)

Combinations (Cartesian product):
- `{x=0, lst=[]}`
- `{x=0, lst=[0]}`
- `{x=1, lst=[]}`
- `{x=1, lst=[0]}`

Result: 4 test cases (one per combination)

### 5. Injection as Initial Marking

Ground terms are injected as initial marking tokens in input places.

**Mechanism:**

For each variable `v` in intention:
1. Identify input place(s) that provide `v` (via arc bindings or place type)
2. For each ground term `t` generated for `v`:
   - Add token `t` to the corresponding input place
   - Rebuild reachability graph with this initial marking
   - Find paths matching the intention pattern

**Example:**

```javascript
{
  variables: [{ name: 'req', sort: 'Option', hypothesis: { type: 'subuniformity' } }],
  pathPattern: { events: [{ transition: 'processRequest', binding: { req: '$req' } }] }
}
```

Input place `requests` has sort `Option`. Ground terms: `{None, Some(0)}`.

Test case generation:
1. Set `requests.valueTokens = [None]`, find paths → test case 1
2. Set `requests.valueTokens = [Some(0)]`, find paths → test case 2

### 6. ReductionEngine on Variable Instantiations

Reduction hypotheses now apply at the **variable instantiation level**, not post-hoc on generated cases.

**Current (Phase 1):**
```javascript
reductionHypothesis: {
  type: 'uniformity',
  domain: 'order', // Variable name
  representative: 1
}
```

Applies to concrete test cases **after** path finding.

**Proposed (Phase 2):**
```javascript
variables: [
  { 
    name: 'order', 
    sort: 'Nat', 
    hypothesis: { type: 'uniformity', representative: 1 }
  }
]
```

Applies **during** ground term generation — only `order=1` is instantiated, so only one case is generated per intention.

**Benefit:** Reduction happens symbolically, avoiding case generation explosion.

### 7. UI Editing

Intention editor would include:

**Variable Declaration Section:**
```
┌─ Variables ─────────────────────────────────────┐
│ + Add Variable                                   │
│                                                  │
│ Name: order      Sort: [Nat ▼]                  │
│ Hypothesis: [Subuniformity ▼]                   │
│   Source: [Guards ▼]                            │
│   Max representatives: [5]                       │
│                                                  │
│ Name: status     Sort: [String ▼]               │
│ Hypothesis: [Uniformity ▼]                      │
│   Representative: [__________]                   │
└──────────────────────────────────────────────────┘
```

**Path Pattern Section (with variable references):**
```
┌─ Path Pattern ──────────────────────────────────┐
│ Event 1:                                         │
│   Transition: [processOrder ▼]                  │
│   Bindings:                                      │
│     order → [$order]  (variable)                │
│     material → [$material]  (variable)          │
│   Constraint: [order > 0]                       │
│                                                  │
│ Event 2:                                         │
│   Transition: [allocateMaterial ▼]              │
│   Bindings:                                      │
│     needed → [$material * 2]  (expression)      │
└──────────────────────────────────────────────────┘
```

### 8. Relation to Buchs/BGM SATEL Literature

#### Original SATEL (Buchs et al., 1990s)

- **B-method inspiration**: Test intentions as abstract behaviors over B machines
- **Partition-based**: Equivalence classes from guard conditions
- **Symbolic execution**: Path constraints solved symbolically (no concrete explosion)
- **Intention language**: CO-OPN formalism with typed variables

**Key papers:**
- Buchs & Pezzè (1991): "A Theory of Specification-Based Testing for Object-Oriented Software"
- Gallasch & Kristensen (2008): "COMMS/CPN: A Tool for Generating and Executing Test Cases from CPN Models"

#### BGM (Bouquet-Gervais-Machicoane, 2000s)

- **Model-based testing**: From Petri nets, automata, or transition systems
- **Abstraction functions**: Map concrete states to abstract classes
- **Coverage criteria**: Transition/state/path coverage modulo abstraction

**Key concepts adopted:**
- **Partition refinement**: Subuniformity = partition by guards/constructors
- **Symbolic witnesses**: Representatives without full enumeration
- **Hypothesis-driven**: Uniformity/regularity as test hypotheses

#### Our Design (2026)

- **ADT-aware**: First-class algebraic datatypes (List, Option, Tree, etc.)
- **Constructor partitioning**: Witnesses per ADT constructor (symbolic, depth-bounded)
- **Web-based**: Browser Petri Net Editor + Z3-WASM for SMT solving
- **Hybrid approach**: Combine Buchs symbolic execution with BGM partition refinement

**Novelty:**
1. Integrate constructor-based partitioning with guard-based partitioning
2. Depth-bounded recursive ADT witness generation (avoid infinite terms)
3. Honest symbolic reasoning (no enumerate-all-then-filter hacks)

## Implementation Strategy

### Phase 2.1: Variable Language (Schema + Parser)

- Define JSON schema for intention variables
- Extend intention parser to validate variable declarations
- Add variable reference syntax (`$var`, `unwrap($var)`)

### Phase 2.2: Ground Term Generator

- Implement `generateGroundTerms(varName, hypothesis, petriNet)`
  - **Uniformity**: Return `[representative]`
  - **Subuniformity from guards**: Parse guards, partition, pick representatives
  - **Subuniformity from constructors**: Walk ADT, generate witnesses (already implemented in `PartitionGenerator.js`)
  - **Regularity**: Enumerate terms up to depth/count

### Phase 2.3: Path Instantiation

- Implement `instantiatePathPattern(pattern, instantiation)`
  - Replace `$var` with ground terms
  - Evaluate expressions (`unwrap($opt)` → `unwrap(Some(5))` → `5`)
  - Substitute bindings in events

### Phase 2.4: Marking Injection

- Identify input places for each variable
- For each instantiation, set initial marking and rebuild graph
- Cache graphs per unique marking to avoid redundant exploration

### Phase 2.5: UI Integration

- Add variable editor panel to intention dialog
- Autocomplete for variable names in binding fields
- Validate variable types against Petri net ADT definitions

### Phase 2.6: Migration Path

Support both legacy (concrete) and new (symbolic) intention formats:

```javascript
// Legacy (Phase 1)
{
  id: 'intent-1',
  pathPattern: { events: [{ transition: 't1', binding: { x: 5 } }] },
  reductionHypothesis: { type: 'uniformity', domain: 'x', representative: 5 }
}

// New (Phase 2)
{
  id: 'intent-1',
  variables: [{ name: 'x', sort: 'Nat', hypothesis: { type: 'uniformity', representative: 5 } }],
  pathPattern: { events: [{ transition: 't1', binding: { x: '$x' } }] }
}
```

Auto-convert legacy format to new format internally.

## Open Questions

1. **Expression Language Complexity**
   - How expressive should binding expressions be? (`unwrap($x)`, `head($lst)`, `$x + $y * 2`)
   - Do we need a full term algebra or just simple accessor/arithmetic?

2. **Variable Dependencies**
   - Can one variable's hypothesis depend on another? (e.g., `length(lst) == n`)
   - If so, how to generate consistent instantiations?

3. **Cartesian Product Explosion**
   - With multiple variables and subuniformity, product can grow exponentially
   - Strategies: prioritize critical variables, user-specified limits, incremental generation?

4. **Partial Instantiation**
   - What if path matching fails for some instantiations?
   - Should we report "no path found for `x=5, lst=[]`" or silently skip?

5. **Constraint Solving**
   - Do event constraints get checked during path finding or symbolic generation?
   - If `events: [{ transition: 't1', binding: { x: '$x' }, constraint: 'x > 0' }]` and `x ↦ {-1, 0, 1}`, do we filter `{-1, 0}` symbolically or during path search?

6. **Multi-Variable Guards**
   - How to partition when guards involve multiple variables? (`x + y > 10`)
   - Generate joint partition or independent partitions?

7. **Axiom Library**
   - Should we provide a standard library of domain-specific axioms?
   - E.g., `axiom: 'quality_outcomes'` → classes `{pass, fail}` without user specifying

8. **Performance with Large Partitions**
   - ADTs with many constructors (e.g., `Tree` with depth 5) → hundreds of witnesses
   - How to keep GUI responsive? Lazy generation, streaming, or hard limits?

## Example: Manufacturing Workflow

**Current (Phase 1):**
```javascript
{
  id: 'complete-production',
  name: 'Complete Production Workflow',
  pathPattern: {
    type: 'sequence',
    events: [
      { transition: 'scheduleJob', binding: { order: 1, material: 10 } },
      { transition: 'startStage1', binding: { job: 1 } },
      { transition: 'completeStage1', binding: { job: 1 } },
      // ... 10 more events with concrete values
    ]
  },
  reductionHypothesis: { type: 'uniformity', domain: 'order', representative: 1 }
}
```

**Proposed (Phase 2):**
```javascript
{
  id: 'complete-production',
  name: 'Complete Production Workflow',
  variables: [
    { 
      name: 'order', 
      sort: 'Nat', 
      hypothesis: { type: 'uniformity', representative: 1 },
      description: 'Production order ID'
    },
    { 
      name: 'material', 
      sort: 'Nat', 
      hypothesis: { type: 'subuniformity', source: 'guards' },
      description: 'Material quantity (partitioned by availability guards)'
    },
    { 
      name: 'qcOutcome', 
      sort: 'QualityStatus', 
      hypothesis: { type: 'subuniformity', source: 'axiom', axiom: 'quality_outcomes' },
      description: 'Quality control outcome (pass/fail)'
    }
  ],
  pathPattern: {
    type: 'sequence',
    events: [
      { transition: 'scheduleJob', binding: { order: '$order', material: '$material' } },
      { transition: 'startStage1', binding: { job: '$order' } },
      { transition: 'completeStage1', binding: { job: '$order' } },
      // ... more events using variables
      { transition: 'qualityCheck', binding: { job: '$order', outcome: '$qcOutcome' } }
    ]
  }
}
```

**Generated Test Cases:**
- `order=1` (uniformity: one value)
- `material ∈ {0, 50, 100}` (subuniformity: guards partition material into availability classes)
- `qcOutcome ∈ {pass, fail}` (subuniformity: axiom provides two classes)

Cartesian product: `1 × 3 × 2 = 6` test cases (instead of manually specifying 6 intentions)

## Conclusion

SATEL-style intention variables enable:
1. **Abstract test specification**: Write intentions over symbolic variables, not concrete values
2. **Hypothesis-driven generation**: Ground terms determined by uniformity/subuniformity/regularity
3. **Symbolic reasoning**: No concrete explosion — partition and pick representatives symbolically
4. **Reduced manual effort**: One intention with variables → multiple test cases automatically

**Next Steps (Implementation):**
- Implement variable schema and parser (Phase 2.1)
- Extend ground term generator for all hypothesis types (Phase 2.2)
- Build path instantiation engine (Phase 2.3)
- Integrate with UI (Phase 2.5)

**Open questions** (listed above) should be resolved through prototyping and user feedback.
