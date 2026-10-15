# SATEL for Algebraic Petri Nets — Design Document

> Historical design notes. V1 has been removed; current behavior and limits are documented in [increment 2](increment-02-gui-v2.md). State-space/path partition descriptions below are not the symbolic account implementation.

## Overview

This document describes the implementation of **SATEL** (Semi-Automatic Testing Language) concepts adapted for **Algebraic Petri Nets (APNs)**, based on Levi Lucio's PhD thesis "SATEL — A Test Intention Language for Object-Oriented Specifications of Reactive Systems" (Geneva, 2009).

### Scope

**IN SCOPE:**
- Test intentions for algebraic Petri nets with ADT-typed tokens
- Stimulations (place injections) vs observations (expected outputs and markings)
- Positive and negative oracles (HML-style event sequences)
- Test-set generation from intentions over APN state space
- V2 intentions with variable instantiation and stimulation/observation pairs

**OUT OF SCOPE:**
- Full CO-OPN/2c++ class/context hierarchy
- CoopnBuilder resurrection
- Unfinished BGM decomposition hypothesis in full generality

## Mapping SATEL Concepts to Algebraic Petri Nets

### 1. Reactive System I/O Interface

**Petri Net Adaptation:**
- **Input Places** (io_type: 'input'): Stimulation injection points
- **Output Places** (io_type: 'output'): Observation points for expected results
- **Internal Places**: State that persists between stimulations
- **Transitions with Guards**: Conditional behavior based on ADT token values

### 2. Test Intentions (V2 Format)

**Structure:**
```javascript
{
  id: 'intention-id',
  name: 'Human-readable name',
  testType: 'positive' | 'negative',
  variables: [
    {
      name: 'varName',
      sort: 'ADT_Type',
      hypothesis: {
        type: 'uniformity' | 'subuniformity' | 'regularity',
        source: 'constructors' | 'guards' | 'path-conditions' | 'axiom'
      }
    }
  ],
  pairs: [
    {
      stimulation: {
        transition: 'transitionName',
        inputs: { place: [tokens] }  // May contain variable refs like '$varName'
      },
      observation: {
        type: 'standard' | 'notEnabled',  // notEnabled = negative observation
        outputs: { place: [expected tokens] },
        markings: { place: { length: n } }  // Marking assertions
      }
    }
  ]
}
```

### 3. Variable Hypotheses

**Uniformity:** Single representative value
```javascript
{ type: 'uniformity', representative: value }
```

**Subuniformity:** One representative per equivalence class
- `source: 'constructors'` — Partition by ADT constructors
- `source: 'guards'` — Partition by guard-checked values (legacy)
- **`source: 'path-conditions'`** — Partition by conjunction of guards along execution paths
  - Extracts guards from transitions in intention pairs
  - For ADT types: creates one class per equality-checked constructor
  - For numeric types: creates classes for each region defined by guard boundaries
  - Example: `priority == High()`, `priority == Normal()` → classes [High, Normal, Low]
  - Example: `quantity >= 50` → classes [25, 50, 75] (below/at/above boundary)

**Regularity:** Bounded enumeration of terms
```javascript
{ type: 'regularity', bounds: { depth: 2, nbEvents: 5 } }
```

### 4. Path-Condition-Based Subuniformity (New)

**Motivation:** Previous `source: 'guards'` split on guard labels but all subdomains took the same path. True subuniformity requires each equivalence class to drive a genuinely different transition sequence.

**Implementation:**
1. Extract guards from all transitions mentioned in intention pairs
2. Identify guards that involve the variable (directly or via projections)
3. Parse guard expressions to extract:
   - Equality checks for ADT types (e.g., `priority(order(job)) == High()`)
   - Comparison boundaries for numeric types (e.g., `quantity(material) >= 50`)
4. Partition domain:
   - **ADT:** One representative per guard-checked constructor + residual
   - **Numeric:** Representatives at and around each boundary (below/at/above)
5. Test generation creates one test case per representative, each driving a different path

**Example (Manufacturing Priority):**
- Guards: `priority(order(job)) == High()`, `priority(order(job)) == Normal()`
- Partition: `[High(), Normal(), Low()]` (Low is residual — not explicitly checked)
- Paths:
  - High: schedule → stage1 → stage2 → stage3 → qualityCheckPass → complete (6 transitions)
  - Normal: schedule → stage1 → stage2 → stage3 → qualityCheckFail → rework (6 transitions)
  - Low: schedule → stage1 → stage2 → stage3 → neither QC fires (4 transitions)

Each subdomain drives a **distinct** execution path.

### 5. Multi-Step Intentions

**Design:** Chain multiple stimulation/observation pairs to create HML-style sequences:
```javascript
pairs: [
  { stimulation: { transition: 'step1', inputs: {...} }, observation: {...} },
  { stimulation: { transition: 'step2', inputs: {} }, observation: {...} },  // Fires on tokens from step1
  { stimulation: { transition: 'step3', inputs: {} }, observation: {...} }
]
```

**Token Chaining:** Tokens produced by one pair's observation remain in the net and are consumed by subsequent stimulations (unless explicitly re-injected).

**Conditional Observations:** When behavior depends on variable values:
```javascript
observation: {
  conditional: true,  // Success depends on instantiation
  outputs: {...}
}
```

**Path Length Requirements:**
- Simple intentions: 1-2 transitions
- Lifecycle intentions: 3-6 transitions minimum
- Rework/retry intentions: 6+ transitions
- At least 50% of multi-step tests should have path length ≥ 3

### 6. Test Generation Algorithm

**Input:** Intentions, Petri net, ADT registry, options  
**Output:** Test cases with expected traces

**Steps:**
1. **Variable Instantiation:**
   - For each variable in intention, generate representatives based on hypothesis
   - Path-condition subuniformity: analyze guards in intention pairs
   - Cartesian product of all variable instantiations

2. **Guard Filtering (if multi-variable):**
   - Evaluate joint guards on Cartesian product
   - Drop combinations that don't satisfy guards

3. **Pair Instantiation:**
   - Replace variable references (`$varName`) with ground terms
   - Generate one test case per valid instantiation

4. **Trace Construction:**
   - For V2 intentions: build `expectedTrace` from instantiated pairs
   - Trace contains transition names, bindings, and step numbers

5. **Statistics:**
   - `statesExplored`: Total stimulation firings across all test cases
   - `testCases`: Array of instantiated test cases with traces

### 7. Oracle Generation

**Standard Observation:**
- Check expected token values in output places
- Verify marking counts match expected
- Compare ADT term structure (constructor + args)

**notEnabled Observation:**
- Verify transition is NOT enabled with given inputs
- Guards should reject the stimulation
- This is a **positive** test outcome (correctly rejected)

**Conditional Observation:**
- Some pairs may fire or not depending on instantiation
- Used for path branching based on variable values

### 8. ADT Token Validation

**Constructor Verification:**
```javascript
validateTokenSort(token, placeSort, adtRegistry)
```
- Checks that token's constructor exists in ADT definition
- Validates argument sorts match constructor signature
- Throws error if constructor not found (catches test specification bugs)

### 9. Priority Handling

**Simple Priorities:** Earliest enabled transition fires (no ties)

**Subuniformity Priorities:** When multiple transitions could fire:
- Partition based on which transition would fire
- Generate one test case per firing option
- Ensures coverage of all priority-driven behaviors

### 10. State Space Options

**V2 Intentions:**
```javascript
{
  disableGraphCaching: true,  // Skip reachability graph for direct pair execution
  applyReduction: false,      // No state space reduction needed
  variableDepth: 2            // Term enumeration depth bound
}
```

**Why disable graph caching for V2:**
- V2 uses direct stimulation/observation pair execution
- Doesn't rely on state space exploration
- Building full reachability graph wastes time
- Set `maxStates: 0` was buggy (broke statistics) — use `disableGraphCaching` instead

## Implementation Files

### Core
- `TestGenerator.js` — Main test generation entry point
- `VariableInstantiator.js` — Variable hypothesis to ground terms
- `PathConditionPartitioner.js` — Path-condition-based subuniformity
- `ObservationChecker.js` — Oracle execution and validation
- `TestExecutor.js` — V2 pair execution with token chaining

### Examples
- `examples/manufacturing/intentions-v2.js` — Single-step intentions
- `examples/manufacturing/intentions-v2-multistep.js` — Multi-step lifecycle intentions (3-9 transitions)
- `examples/banking/intentions-v2-multistep.js` — Banking workflow intentions (3-5 transitions)

### Tests
- `__tests__/path-subuniformity.test.js` — Path-condition partitioning assertions
- `__tests__/all-fixes.test.js` — Regression tests for all fixes
- `__tests__/priority-subuniformity.test.js` — Priority handling tests

## Key Fixes and Improvements

### 1. UI Bug Fix: Zero Transitions
**Problem:** Manufacturing V2 generated 11 test cases all showing "Path: 0 transitions" and "States Explored: 1"

**Root Cause:** `SatelPanel.jsx` passed `maxStates: 0` for V2 intentions, forcing `buildReachabilityGraph` to explore only initial state.

**Fix:** Use `disableGraphCaching: true` instead + build `expectedTrace` from `instantiatedPairs` in `TestGenerator.js`

**Result:** 11 tests, 15 states explored, path lengths [1,1,1,1,1,1,1,5,1,1,1] ✓

### 2. Path-Condition Subuniformity
**Problem:** `source: 'guards'` split on guard labels but all subdomains took same path.

**Fix:** Implemented `partitionByPathConditions` to analyze guards from intention pairs and partition domain so each class drives different execution path.

**Result:** Priority-dependent paths with distinct transition sequences per subdomain.

### 3. Multi-Step Intentions
**Problem:** Single-transition tests didn't exercise realistic workflows.

**Fix:** Created HML-style chained pairs with token persistence between steps.

**Result:** Manufacturing lifecycle (6 transitions), rework cycle (9 transitions), banking workflows (3-5 transitions).

## Testing Strategy

**Unit Tests:**
- ADT token validation
- Path-condition partitioning logic
- Guard extraction and parsing
- Variable instantiation

**Integration Tests:**
- Full test generation for multi-step intentions
- Path length assertions (≥ 3 for lifecycle)
- Distinct paths per subdomain
- Average path length ≥ 4 for multi-step suites

**E2E Tests:**
- Playwright tests exercising UI Generate button
- Screenshot verification of results
- Regression tests for zero-transition bug

## Performance Considerations

**State Space Growth:**
- V2 intentions scale linearly with #variables × #representatives × #pairs
- No exponential reachability graph construction
- Typical suite: 10-20 test cases, <1 second generation

**ADT Term Enumeration:**
- Depth-bounded to avoid infinite recursion
- Typical depth: 2 (covers most practical terms)
- Regularity hypothesis: limit to 5 terms per variable

## Future Work

- Full symbolic execution for path-condition extraction
- SMT-based domain partitioning for complex guards
- Automatic equivalence class inference from ADT axioms
- Integration with model checking for liveness properties
- Coverage metrics (transition coverage, path coverage, boundary coverage)
