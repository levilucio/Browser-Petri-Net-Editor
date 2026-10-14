# Semantic Subuniformity Design

## Goals
1. Partition transition firings by semantic equivalence classes based on guards/bindings
2. Select representatives without full enumeration
3. Handle infinite domains soundly with explicit finite abstractions
4. Maintain performance on manufacturing example (15 intentions, ~10s)

## Current System Analysis

### Token Assignment (assignment.js)
- Enumerates all token combinations: `for (let i = 0; i < tokens.length; i++)`
- Tries every binding until guard satisfied
- No semantic partitioning - pure brute force
- Works for small finite sets but unsound for infinite domains

### State Space Explorer (StateSpaceExplorer.js)
- Line 147: `for (const transitionId of currentState.enabledTransitions)`
- Fires each enabled transition once with first satisfying binding
- No exploration of different bindings for same transition
- Missing: equivalence class enumeration

### Manufacturing Example
- **Domain**: Integers (scalar tokens like `x`, `quantity`, `materials`)
- **Guards**: Arithmetic inequalities (`quantity > 0`, `stage == 1`, `qualityScore >= 90`)
- **Bindings**: Simple variables (`x`, `orderId`, `quantity`)
- **Current tokens**: Small finite sets (1-3 tokens per place)

## Design: Semantic Subuniformity

### 1. Firing Condition Analysis

For each transition, extract semantic conditions from:
- **Guard predicates**: `x > 0`, `x == 5`, `x >= 10 && x < 20`
- **Input arc bindings**: Pattern matching constraints
- **Type annotations**: Integer, Boolean, custom sorts (if defined)

### 2. Equivalence Class Partitioning

Partition the token space by conditions that make guards evaluate differently:

**Example: Guard `x > 0`**
- **Class 1**: `x <= 0` (guard false)
- **Class 2**: `x > 0` (guard true)
- **Representatives**: -1, 1 (boundary values)

**Example: Guard `stage == 1`**
- **Class 1**: `stage == 1` (guard true)
- **Class 2**: `stage != 1` (guard false)
- **Representatives**: 1, 0

**Example: Guard `qualityScore >= 90`**
- **Class 1**: `qualityScore < 90` (guard false)
- **Class 2**: `qualityScore >= 90` (guard true)
- **Representatives**: 89, 90

### 3. Representative Selection Strategies

**a) Boundary Values (for numeric inequalities)**
- `x > c`: test `c, c+1`
- `x >= c`: test `c-1, c`
- `x < c`: test `c-1, c`
- `x <= c`: test `c, c+1`

**b) Exact Values (for equalities)**
- `x == c`: test `c, c±1` (one true, one false case)

**c) Interval Partitioning (for conjunctions)**
- `x > 10 && x < 20`: test `10, 11, 19, 20` (boundaries)
- Avoid: enumerating all 11..19

**d) Sign Partitioning (for unbounded domains)**
- If no explicit bounds: test `{-1, 0, 1}` (negative, zero, positive)

**e) Boolean Partitioning**
- Domain: `{true, false}` (already finite)

### 4. Finite Abstractions for Infinite Domains

**Explicit finite partitions** derived from guards:
- Extract all numeric constants from guards
- Partition: `(-∞, c₁), [c₁, c₂), [c₂, c₃), ..., [cₙ, ∞)`
- Representatives: `c₁-1, c₁, c₁+1, c₂-1, c₂, c₂+1, ..., cₙ-1, cₙ, cₙ+1`

**Incompleteness documentation**:
- If domain is integers but no guards exist: test `{0, 1, -1}` (admit incompleteness)
- Document: "Finite abstraction for unbounded integer domain - only sign partition tested"

### 5. Integration with State Space Exploration

**Modified StateSpaceExplorer.js:**

Instead of:
```javascript
for (const transitionId of currentState.enabledTransitions) {
  const newNet = await simulator.fireTransition(transitionId);
  // ... record one transition
}
```

Do:
```javascript
for (const transitionId of currentState.enabledTransitions) {
  const equivClasses = await computeEquivalenceClasses(transitionId, marking, petriNet);
  for (const repr of equivClasses.representatives) {
    const newNet = await simulator.fireTransitionWithBinding(transitionId, repr.binding);
    // ... record transition with binding
  }
}
```

## Implementation Plan

### Phase 1: Guard Analyzer
**File**: `src/satel/core/GuardAnalyzer.js`

Extract conditions from transition guards:
- Parse guard AST (already available in cache)
- Extract numeric constants, comparison operators
- Build condition list: `[{var: 'x', op: '>', value: 0}, ...]`

### Phase 2: Partition Generator
**File**: `src/satel/core/PartitionGenerator.js`

Generate equivalence classes from conditions:
- Group by variable
- Compute interval partition from constants
- Select boundary representatives

### Phase 3: Representative Finder
**File**: `src/satel/core/RepresentativeFinder.js`

Find representatives satisfying bindings:
- For each equivalence class
- Check if satisfying assignment exists (via SMT or symbolic evaluation)
- Return representative binding (not all bindings)

### Phase 4: Integration
**Modify**: `src/satel/core/StateSpaceExplorer.js`

- Add `computeSubuniformTransitions(transitionId, marking, petriNet)`
- Returns array of `{transitionId, binding}` instead of just `transitionId`
- BFS loop fires each (transition, binding) pair

### Phase 5: Manufacturing Test
- Verify on 4 transitions: receiveOrder, startCutting, passQualityCheck, failQualityCheck
- Should produce same or more paths (different bindings may reach new states)
- Document equivalence classes found

## Example: receiveOrder Transition

**Guard**: (none - always enabled if tokens exist)
**Binding**: `x` (scalar integer)
**Current approach**: Fire once with first token `x=1`
**Subuniformity**: All integers equivalent (no guard partitions domain)
  - **Abstraction**: Test `{0, 1}` (zero and positive)
  - **Representative**: `x=1` (keep current behavior, admit incompleteness)
  - **Documentation**: "No guard - semantic equivalence: all positive integers"

## Example: passQualityCheck Transition

**Guard**: `stage == 3 && qualityScore >= 90`
**Bindings**: `orderId, scheduledQuantity, stage`
**Conditions**:
- `stage == 3`: Exact equality
- `qualityScore >= 90`: Inequality

**Equivalence classes** (stage):
- Class A: `stage == 3` → guard can be true
- Class B: `stage != 3` → guard always false

**Equivalence classes** (qualityScore, given stage==3):
- Class 1: `qualityScore < 90` → guard false
- Class 2: `qualityScore >= 90` → guard true

**Representatives**:
- `{stage: 3, qualityScore: 89}` (border false)
- `{stage: 3, qualityScore: 90}` (border true)
- `{stage: 2, qualityScore: 100}` (stage mismatch)

**In practice** (manufacturing example uses scalar `x`):
- Current marking has specific tokens, not infinite domain
- Subuniformity applies when multiple tokens exist for same place
- If only one token: no partition needed

## Soundness vs Completeness

**Sound**: 
- ✅ Do not claim to explore "all" transitions if domain is infinite
- ✅ Only explore finitely many representatives per explicit partition
- ✅ Document incompleteness when abstraction applied

**Complete** (when possible):
- ✅ Finite domains: enumerate all classes
- ✅ Bounded guards: cover all intervals
- ⚠️ Unbounded guards: admit incompleteness, document abstraction

## Performance Impact

**Manufacturing example** (current: ~10s for 15 intentions, 300 states):
- Most transitions have 1-2 tokens per input place
- Guards are simple inequalities (few partitions)
- **Expected**: Minimal overhead (1-2 representatives per transition)
- **Worst case**: 2-3x more transitions explored (if multiple bindings reach different states)

**Optimizations**:
- Cache equivalence classes per (transition, place marking)
- Only compute partitions when >1 token available
- Skip subuniformity for trivial guards (no guard = pick arbitrary representative)

## Files to Create/Modify

### New Files
1. `src/satel/core/GuardAnalyzer.js` - Extract conditions from guards
2. `src/satel/core/PartitionGenerator.js` - Generate equivalence classes
3. `src/satel/core/RepresentativeFinder.js` - Find representatives per class
4. `src/satel/core/Subuniformity.js` - Main API: `computeSubuniformTransitions()`

### Modified Files
1. `src/satel/core/StateSpaceExplorer.js` - Use subuniform transitions
2. `src/satel/core/TestGenerator.js` - Store binding in test cases
3. `src/components/SatelPanel.jsx` - Display binding info in results

### Documentation
1. `petri-net-app/docs/SUBUNIFORMITY.md` - Design and limitations
2. `petri-net-app/docs/SUBUNIFORMITY-EXAMPLES.md` - Worked examples

## Limitations & Future Work

**Current limitations**:
- **Integer-only**: No support for custom algebraic datatypes (lists, trees, records)
- **Simple guards**: Conjunctions of inequalities; no disjunctions or complex formulas
- **No SMT synthesis**: Representatives are boundary values, not SMT witnesses
- **Finite token sets**: Manufacturing example has small token sets (not infinite domain yet)

**Future extensions**:
- Support algebraic datatypes with constructor-based partitioning
- Use Z3 to synthesize representatives (not just boundaries)
- Handle disjunctive guards (DNF partitioning)
- User-defined abstraction hints (annotations on places/transitions)

## Success Criteria

✅ **Minimal (MVP)**:
- Partition by guard conditions (inequalities, equalities)
- Select boundary representatives
- Integrate with state space explorer
- Document abstractions used
- No regression on manufacturing timings (<15s)

✅ **Ideal**:
- Demo showing distinct classes → distinct paths
- Verification script showing equivalence classes per transition
- Clear documentation of incompleteness for unbounded domains
