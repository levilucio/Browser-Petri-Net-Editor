# SATEL V2 Status - Current Implementation

**Branch**: `cursor/satel-apn-testing-eaea`  
**Latest Commits**: `2aa622b` → `d592d7a` → `b8aacb0`  
**Date**: 2026-10-12  

---

## ✅ What Works Now

### 1. Parser Support for ADT Operations
**Commit**: `2aa622b`

- `booleanParser.js` now parses function calls: `name(arg1, ..., argN)`
- Handles nullary constructors: `High()`, `Pass()`
- Supports nesting: `priority(order(j))`
- **Tests**: 5/5 ADT operations tests pass
- **Tests**: 562/564 total tests pass

### 2. ADT Operation Evaluation
**Commits**: `525d6ce`, `8736b96`

- Field accessors work: `quantity(mat)`, `priority(ord)`, `order(j)`, `id(ord)`
- Constructor calls work: `High()`, `Normal()`, `Job(ord, mat)`, `Product(...)`
- Deep equality for ADT comparisons: `priority(ord) == High()`

### 3. Guards Evaluate Correctly
**Commit**: `d592d7a`

- `quantity(mat) >= 50`: Enables scheduleJob with Material(100), disables with Material(30)
- `priority(order(j)) == High()`: Enables qualityCheckPass for High priority
- `priority(order(j)) == Normal()`: Enables qualityCheckFail for Normal priority
- **Test results**: Transitions enable/disable based on ADT guards

### 4. Unbound Variable Check Fixed
**Commit**: `d592d7a`

- Action-defined variables (e.g., `job` from `job = Job(ord, mat)`) no longer flagged as unbound
- Output arcs can reference action variables
- Guard evaluation happens with proper bindings

### 5. Token Production (Partial)
**Commit**: `b8aacb0`

- Action evaluation before token production
- ADT tokens handled in `produceTokens` (`__adt__` flag check)
- Simple assignments work: `outJob = j` produces Job token
- **Test**: qualityCheckFail fires and produces rework token ✓

---

## ❌ What Doesn't Work Yet

### 1. Constructor Calls in Actions
**Current blocker**

Actions with constructor calls don't evaluate:
- `job = Job(ord, mat)` - scheduleJob produces no token
- `prod = Product(id(order(j)), Pass())` - qualityCheckPass produces no token

**Why**: `parseArithmetic` used by `evaluateAction` may not parse ADT constructor syntax correctly.

**Test status**: 2/4 transition firing tests pass
- ✓ Guards work (insufficient material disables)
- ✓ Simple assignment (j → reworkJob)
- ✗ Job constructor in action
- ✗ Product constructor in action

### 2. Observations Still Trivial
Manufacturing V2 intentions still check only markings, not produced output tokens.

**Example** (intentions-v2.js line 47):
```javascript
observation: {
  outputs: {},  // ← Should check produced Job token
  markings: { orderQueue: { length: 0 } }
}
```

### 3. Complete Workflow Doesn't Chain
`completeWorkflowIntention` re-injects tokens at each stage instead of using produced tokens from previous transitions.

### 4. No Mutation Tests
Can't verify observations actually check outputs without:
- Wrong expected output → verdict change
- Wrong-sort token → verdict change
- Sufficient material in negative test → verdict change

### 5. No Subuniformity Cases
All intentions use `uniformity` → 1 case each. Need at least one with `subuniformity` → multiple cases.

### 6. _enabledCache Hack Remains
`ObservationChecker.js` line 178 still uses `simulator._enabledCache.clear()` instead of public API.

### 7. Many Missing .js Extensions
~50+ imports in `src/utils/z3/*.js` still lack `.js` extensions for plain Node compatibility.

---

## Test Results Summary

### ADT Operations (100% pass)
```
✓ field accessor: quantity(Material(100))
✓ guard: quantity(mat) >= 50
✓ constructor comparison: priority(ord) == High()
✓ nested accessor: priority(order(Job(...)))
✓ insufficient material guard fails
```

### Manufacturing Transition Firing (50% pass)
```
✗ scheduleJob: sufficient material enables (guard ✓, output ✗)
✓ scheduleJob: insufficient material disables
✗ qualityCheckPass: High priority enables (guard ✓, output ✗)
✓ qualityCheckFail: Normal priority enables (guard ✓, output ✓)
```

**Guards work**: Transitions enable/disable correctly based on ADT token content  
**Output issue**: Constructor calls in actions don't produce tokens

### Manufacturing V2 (vacuous passes)
```
✓ 7/7 tests pass (but observations only check markings)
```

---

## Next Steps to Complete

### Priority 1: Fix Action Constructor Evaluation
**Estimated**: 1-2 hours

Update `parseArithmetic` or `evaluateAction` to handle ADT constructor syntax:
- Parse `Job(ord, mat)` as funcall with 2 args
- Evaluate to `{__adt__: true, constructor: 'Job', args: [ord_value, mat_value]}`
- Same for nested calls: `Product(id(order(j)), Pass())`

### Priority 2: Update Observations
**Estimated**: 1 hour

Rewrite intention observations to check actual produced tokens:
```javascript
observation: {
  outputs: {
    scheduledJobs: [{ 
      __adt__: true, 
      constructor: 'Job', 
      args: ['$order', '$material'] 
    }]
  }
}
```

### Priority 3: Mutation Tests
**Estimated**: 30min

Add tests that verify observations actually matter:
- Change expected output → verdict changes
- Wrong-sort token → error/fail
- Sufficient material in negative → fail

### Priority 4: Public Cache API
**Estimated**: 30min

Add `simulator.invalidateEnabledCache()` or `simulator.setMarking()` method.

### Priority 5: Subuniformity Example
**Estimated**: 30min

Add Priority variable with subuniformity over High|Normal constructors → 2 cases.

**Total realistic**: ~3-4 hours additional work

---

## Commands for Verification

```bash
# ADT operations (all pass)
npm test -- adt-operations.test.js

# Transition firing (2/4 pass)
npm test -- manufacturing-transition-firing.test.js

# Check guard enablement
grep "Enabled" test output
# With Material(100): scheduleJob enabled ✓
# With Material(30): scheduleJob disabled ✓
# With High priority: qualityCheckPass enabled ✓
# With Normal priority: qualityCheckFail enabled ✓

# Check token production
grep "Produced" test output
# scheduleJob: [] (action constructor issue)
# qualityCheckPass: [] (action constructor issue)
# qualityCheckFail: [Job(...)] ✓ works (simple assignment)
```

---

## Honest Assessment

**Genuine progress**: 
- Parser extended ✓
- Guards evaluate with ADT ops ✓
- Simple token flow works ✓

**Still broken**:
- Constructor syntax in actions
- Observations don't check outputs
- No mutation coverage
- No subuniformity examples

**Core issue**: `evaluateAction` uses `parseArithmetic` which may not support ADT constructor calls. Simple variable assignments work, but `Job(x, y)` syntax doesn't parse/evaluate to ADT structure.

**Est. completion**: ~3-4 hours from current state for minimal viable system.
