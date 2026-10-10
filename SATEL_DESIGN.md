# SATEL for Algebraic Petri Nets — Design Document

## Overview

This document describes the implementation of **SATEL** (Semi-Automatic Testing Language) concepts adapted for **Algebraic Petri Nets (APNs)**, based on Levi Lucio's PhD thesis "SATEL — A Test Intention Language for Object-Oriented Specifications of Reactive Systems" (Geneva, 2009).

### Scope

**IN SCOPE:**
- Test intentions for algebraic Petri nets
- Stimulations (inputs) vs observations (outputs) for reactive systems
- Positive and negative oracles (HML-style event sequences)
- Test-set generation from intentions over APN state space
- Composition and reuse of intentions
- Axiom-based or structure-based equivalence for test reduction

**OUT OF SCOPE:**
- Full CO-OPN/2c++ class/context hierarchy
- CoopnBuilder resurrection
- Unfinished BGM decomposition hypothesis in full generality

## Mapping SATEL Concepts to Algebraic Petri Nets

### 1. Reactive System I/O Interface

#### CO-OPN/SATEL Original Concept
In CO-OPN, reactive systems have:
- **Methods** (inputs/stimulations): Services the system accepts from the environment
- **Gates** (outputs/observations): Services the system provides to the environment
- **Events**: Method calls or gate calls that can fire transitions

#### APN Adaptation
For algebraic Petri nets, we define:

**Stimulations (Inputs):**
- **Input Places**: Places that model external input queues/buffers
  - Marked with property `io_type: "input"`
  - Tokens are "inserted" by the environment (test harness)
- **Input Transitions**: Transitions representing input acceptance
  - Marked with property `io_type: "input"`
  - Can be triggered externally to start behaviors

**Observations (Outputs):**
- **Output Places**: Places that accumulate observable results
  - Marked with property `io_type: "output"`
  - Tokens represent produced outputs visible to environment
- **Output Transitions**: Transitions representing observable events
  - Marked with property `io_type: "output"`  
  - Firing represents observable behavior (gate calls)

**Internal Elements:**
- All other places/transitions have `io_type: "internal"` (default)
- Represent hidden state and computation

### 2. Test Intentions

#### Original SATEL Concept
A test intention specifies:
1. **Behavior to cover**: Constraints on execution paths (event sequences)
2. **Input domain**: Constraints on stimulation parameters
3. **Output expectations**: Constraints on observation parameters
4. **Reduction hypotheses**: Uniformity/regularity assumptions to reduce test sets

#### APN Adaptation

A test intention for APNs consists of:

```javascript
{
  id: "intention-1",
  name: "Buy drink with exact payment",
  
  // 1. Path specification (event sequence pattern)
  pathPattern: {
    type: "sequence",  // or "choice", "parallel", "loop"
    events: [
      { transition: "insertCoin", binding: { c: "coin1" } },
      { transition: "selectDrink", binding: { d: "water" } },
      { transition: "dispenseDrink", binding: { d: "water" } }
    ]
  },
  
  // 2. Input constraints (on stimulations)
  inputConstraints: [
    { place: "coinSlot", pattern: "coin1", guard: "true" },
    { place: "selection", pattern: "water", guard: "true" }
  ],
  
  // 3. Output expectations (oracle predicates)
  outputExpectations: [
    { place: "dispensed", pattern: "water", guard: "true" },
    { place: "change", pattern: "0", guard: "true" }
  ],
  
  // 4. Reduction hypothesis
  reductionHypothesis: {
    type: "uniformity",  // or "regularity", "axiom-based"
    domain: "drinks",
    representative: "water",
    reason: "All drinks behave identically if payment >= price"
  },
  
  // 5. Oracle type
  oracleType: "positive"  // or "negative"
}
```

### 3. Test Cases

#### Original SATEL Concept
Test case = HML formula + expected result (true/false)
```
<insertCoin(c1)><selectDrink(water)><dispenseDrink(water)>true
```

#### APN Adaptation

Test case = Event trace + initial marking + expected final marking/outputs

```javascript
{
  id: "test-1",
  intention: "intention-1",
  
  // Initial marking (stimulus)
  initialMarking: {
    "coinSlot": [{ value: "coin1" }],
    "selection": [{ value: "water" }],
    "stock_water": [{ value: 5 }]
  },
  
  // Expected trace (may have multiple paths due to non-determinism)
  trace: [
    { transition: "insertCoin", binding: { c: "coin1" }, timestamp: 0 },
    { transition: "selectDrink", binding: { d: "water" }, timestamp: 1 },
    { transition: "dispenseDrink", binding: { d: "water" }, timestamp: 2 }
  ],
  
  // Oracle: expected final state/outputs
  oracle: {
    type: "positive",
    expectedOutputs: {
      "dispensed": [{ value: "water" }],
      "change": [{ value: 0 }]
    },
    invariants: [
      "stock_water >= 0",  // Safety properties
      "dispensed.length == 1"  // Liveness
    ]
  },
  
  // Result (after running against SUT)
  result: {
    passed: true,
    actualTrace: [...],
    actualOutputs: {...}
  }
}
```

### 4. Test Generation Process

#### Steps:
1. **Parse Test Intention** → Extract constraints and patterns
2. **Build Reachability Graph** → Compute state space from initial marking
3. **Filter Paths** → Find traces matching path pattern and input constraints
4. **Apply Reduction** → Use hypotheses to select representative test cases
5. **Generate Oracles** → Compute expected outputs for each test case
6. **Instantiate Test Suite** → Concrete test cases ready to run

#### Reduction Strategies:

**Uniformity Hypothesis:**
- If behavior is uniform over a domain D, test one representative
- Example: All drinks behave the same → test only "water"

**Regularity Hypothesis:**  
- If behavior is regular (e.g., loops), test boundary cases
- Example: Test 0, 1, 2, many iterations

**Axiom-Based Equivalence:**
- Two events are equivalent if they use the same APN axioms (arc bindings, guards, actions)
- Reduces by choosing one event per equivalence class
- In APNs: transitions are equivalent if they have isomorphic structure (same guard/arc pattern)

### 5. Implementation Architecture

```
satel/
├── core/
│   ├── IntentionParser.js       # Parse test intention DSL
│   ├── StateSpaceExplorer.js    # Build reachability graph
│   ├── TestGenerator.js         # Generate test cases from intentions
│   ├── OracleGenerator.js       # Compute oracles (expected results)
│   └── ReductionEngine.js       # Apply reduction hypotheses
├── io/
│   ├── IOInterface.js           # Manage stimulation/observation marking
│   └── TestExecutor.js          # Run tests against APN simulator
├── language/
│   ├── grammar.js               # SATEL language grammar
│   └── types.js                 # Type definitions
├── ui/
│   ├── IntentionEditor.jsx      # UI for editing test intentions
│   ├── TestResultsViewer.jsx    # Display test results
│   └── IOMarker.jsx             # Mark places/transitions as I/O
└── examples/
    ├── drinkVending/            # Drink vending machine example
    ├── bankingServer/           # Banking server example
    └── workflow/                # Reactive workflow example
```

## Examples to Implement

### 1. Drink Vending Machine (DVM)
- **Stimulations**: insertCoin, selectDrink
- **Observations**: dispenseDrink, returnChange, errorMessage
- **Test Intentions**: 
  - Successful purchase with exact payment
  - Successful purchase with overpayment
  - Failed purchase (insufficient funds)
  - Failed purchase (out of stock)

### 2. Banking Server
- **Stimulations**: login, deposit, withdraw, transfer, logout
- **Observations**: balance, transactionConfirmed, errorMessage
- **Test Intentions**:
  - Successful deposit
  - Successful withdrawal
  - Failed withdrawal (insufficient balance)
  - Concurrent operations

### 3. Reactive Workflow (e.g., Task Management)
- **Stimulations**: createTask, assignTask, completeTask
- **Observations**: taskCreated, taskAssigned, taskCompleted, notification
- **Test Intentions**:
  - Simple workflow path
  - Parallel task execution
  - Task cancellation

## HML-Style Event Sequences

### Syntax
```
# Positive oracle (expected behavior)
<insertCoin(1)><selectDrink(water)><dispenseDrink(water)> => true

# Negative oracle (forbidden behavior)  
<selectDrink(water)><dispenseDrink(water)> => false  # Can't dispense without payment

# Conjunction
<insertCoin(1)> AND <insertCoin(2)> => "parallel inputs"

# Choice
<selectDrink(water) OR selectDrink(beer)> => "any drink selection"

# Iteration
<insertCoin>* => "any number of coins"
```

### Semantics
- `<event>` = Event must occur (transition fires)
- `<event>true` = After event, system in valid state
- `<event>false` = After event, system in invalid state (negative test)
- `<e1><e2>` = Sequential composition
- `<e1> AND <e2>` = Parallel composition (both enabled concurrently)
- `<e1> OR <e2>` = Choice
- `<e>*` = Zero or more repetitions

## File Format for Test Intentions

```json
{
  "intentions": [
    {
      "id": "buy-water-exact",
      "name": "Buy water with exact payment",
      "pathPattern": {
        "type": "sequence",
        "events": ["insertCoin", "selectDrink", "dispenseDrink"]
      },
      "inputConstraints": [
        { "transition": "insertCoin", "binding": { "amount": 1 } },
        { "transition": "selectDrink", "binding": { "drink": "water" } }
      ],
      "outputExpectations": [
        { "place": "dispensed", "pattern": "water" },
        { "place": "change", "pattern": 0 }
      ],
      "reductionHypothesis": {
        "type": "uniformity",
        "domain": "drinks",
        "representative": "water"
      },
      "oracleType": "positive"
    }
  ]
}
```

## Equivalence Relations for Reduction

### Axiom-Based Equivalence (from thesis)
Two transitions t1, t2 are equivalent if:
- They have the same guard formula structure
- They have the same arc binding patterns  
- They produce the same actions

In APNs, this means:
```javascript
function transitionsEquivalent(t1, t2, net) {
  // Same guard AST structure (modulo variable renaming)
  if (!guardsEquivalent(t1.guard, t2.guard)) return false;
  
  // Same input arc patterns
  if (!arcPatternsEquivalent(inputArcs(t1), inputArcs(t2))) return false;
  
  // Same output arc patterns
  if (!arcPatternsEquivalent(outputArcs(t1), outputArcs(t2))) return false;
  
  // Same action structure
  if (!actionsEquivalent(t1.action, t2.action)) return false;
  
  return true;
}
```

### Structure-Based Equivalence
Two states are equivalent if:
- They have the same marking structure (token types/counts in places)
- They enable the same set of transition patterns

## Integration with Existing Editor

### Extended Data Model
```javascript
// Place extension
{
  id: "p1",
  label: "coinSlot",
  io_type: "input",  // NEW: "input" | "output" | "internal"
  io_description: "Accepts coin insertions from user",  // NEW
  // ... existing properties
}

// Transition extension  
{
  id: "t1",
  label: "dispenseDrink",
  io_type: "output",  // NEW
  io_description: "Dispenses selected drink to user",  // NEW
  // ... existing properties
}

// Net extension
{
  // ... existing net
  testIntentions: [...]  // NEW: Array of test intentions
}
```

### UI Components
1. **Properties Panel** → Add "I/O Type" dropdown for places/transitions
2. **SATEL Panel** → New panel for test intentions (collapsible sidebar)
3. **Test Runner** → Button to generate and run tests
4. **Results View** → Show pass/fail for each test case

## References

- Levi Lucio's thesis: "SATEL — A Test Intention Language for Object-Oriented Specifications of Reactive Systems" (2009)
- BGM Theory: Bernot, Gaudel, Marre
- HML: Hennessy-Milner Logic
- Algebraic Petri Nets: Reisig, Jensen

---

**Implementation Status**: Initial design complete. Ready for implementation.
