# SATEL V2 Progress Report - Honest Assessment

**Branch**: `cursor/satel-apn-testing-eaea`  
**Commits**: `525d6ce` → `8736b96` → `b59d7d6`  
**Date**: 2026-10-12  
**Status**: ⚠️ **PARTIAL PROGRESS - Core Issues Remain**

---

## What Was Fixed

### 1. ✅ Infrastructure Improvements
- **buildAdtRegistry**: Regex-based XML parsing, works in Node and browser without DOMParser
- **filterByGuards**: Correct import of `evaluateBooleanWithBindings` from `z3-arith.js`
- **enumerateTermsToDepth**: Generates distinct terms at each depth level (not identical copies)
- **maxStates**: Uses `??` operator so `maxStates: 0` stays 0 instead of becoming 1000
- **ADT helpers**: `createOrder` and `createProduct` ensure Priority/Quality are always constructors
- **.js extensions**: Added to imports in `parse/types.js`, `parse/arithmetic.js`, `parse/pattern.js`, `z3-arith.js`

### 2. ✅ ADT Operation Evaluation Support
- **Field accessors** in `eval-arith.js`: `quantity(mat)`, `order(j)`, `priority(ord)`, `id(ord)`, etc.
- **Constructor calls** in `eval-arith.js`: `High()`, `Normal()`, `Job(ord, mat)`, `Product(id, quality)`, etc.
- **ADT comparison** in `booleanEvaluator.js`: Deep equality for ADT terms in `==` and `!=` operations

### 3. ✅ Manufacturing Net Structure
- **Real guards**: `quantity(mat) >= 50`, `priority(order(j)) == High()`, `priority(order(j)) == Normal()`
- **Real actions**: `job = Job(ord, mat)`, `outJob = j`, `prod = Product(id(order(j)), Pass())`
- **Output arcs**: Reference action variables to produce tokens (`binding: 'job'`, `binding: 'prod'`, etc.)

---

## What Doesn't Work Yet

### 1. ❌ **Parser Doesn't Support Function Calls in Guard Strings**

**The Critical Blocker**: The boolean parser (`booleanParser.js`) rejects syntax like `quantity(mat)` before it reaches the evaluator.

```
Error: Unrecognized term 'quantity(mat)'
  at parseAnyTermString (src/utils/z3/booleanParser.js:130:19)
```

**What this means**:
- Guards like `quantity(mat) >= 50` **cannot be parsed** from strings
- The evaluation logic works (tested with pre-built AST objects)
- But guards in the Manufacturing net are **strings** that need parsing first
- **Impact**: All Manufacturing transitions with ADT guards remain disabled

**What's needed**:
- Update `booleanParser.js` `parseAnyTermString` to recognize funcall syntax
- Add funcall node creation in parser
- Handle nested calls like `priority(order(j))`

### 2. ❌ **Output Token Production Not Tested**

The simulator's action evaluation may not actually produce ADT tokens:
- Actions like `job = Job(ord, mat)` parse and evaluate
- But whether `fireTransition` actually **creates tokens** on output arcs is unverified
- The simulator may lack action-to-output wiring

**What's needed**:
- Test that firing `scheduleJob` with `Order(1, Normal())` and `Material(100)` produces `Job(...)` in `scheduledJobs`
- Verify output arc binding resolution works with action variables

### 3. ❌ **Observations Still Trivial**

Current intentions check only:
- Input places emptied (markings)
- No actual output token verification

**Example** (from `intentions-v2.js`):
```javascript
observation: {
  outputs: {},  // ← Empty!
  markings: {
    orderQueue: { length: 0 }
  }
}
```

**What's needed**:
- Observations must check produced ADT tokens
- Example: `outputs: { scheduledJobs: [Job(Order(1, Normal()), Material(100))] }`

### 4. ❌ **_enabledCache Hack Still Used**

`ObservationChecker.js` line 178:
```javascript
if (simulator._enabledCache) {
  simulator._enabledCache.clear();  // ← Private API abuse
}
```

**What's needed**:
- Public `simulator.invalidateCache()` method
- Or `simulator.setMarking(marking)` that auto-invalidates

### 5. ❌ **No Mutation Tests**

Can't verify tests are genuine without:
- Wrong expected output → verdict changes to `fail`
- Wrong sort token → verdict changes to `error`
- Sufficient material in negative test → verdict changes to `fail`

### 6. ❌ **Subuniformity Not Producing Multiple Cases**

Current Manufacturing intentions use only `uniformity` → 1 case each.

**What's needed**:
- At least one intention with `subuniformity` over guards
- Example: Priority variable with `Normal | High` constructors → 2 test cases

### 7. ❌ **Complete Workflow Re-Injects Tokens**

The `completeWorkflowIntention` manually re-injects Job tokens at each stage instead of using produced tokens from previous transitions.

**What's needed**:
- Generate initial marking once
- Fire `scheduleJob` → produces Job in `scheduledJobs`
- Fire `startStage1` consuming from `scheduledJobs` → produces to `stage1InProgress`
- Chain continues without manual injection

### 8. ❌ **Many .js Extensions Still Missing**

Running plain Node scripts fails due to missing `.js` extensions in z3 directory imports.

**What's needed**:
- Add `.js` to all imports in `src/utils/z3/*.js` files
- Estimated ~50+ import statements to fix

### 9. ❌ **Toolbar Loader & ADT Definitions**

Per user: "toolbar loader drops adtDefinitions and loads V1 intentions"

**Not investigated** - out of scope for core testing focus.

---

## Test Results

### ADT Operations Test (Jest)
```
npm test -- adt-operations.test.js
Tests:       5 failed (parser rejects funcall syntax)
```

### Manufacturing V2 Tests
```
npm test -- manufacturing-v2.test.js
Tests:       7 passed
```

**But**: Tests pass **vacuously** because:
1. Observations check only markings (trivial)
2. Guards never parse (parser rejection)
3. Transitions don't fire (no token flow)
4. No mutation tests to verify

---

## Actual Current State

**Positive test verdicts**: `'pass'` ← **vacuous** (only checking input places emptied)  
**Negative test verdict**: `'pass'` ← **vacuous** (checking wrong marking expectation, not guard failure)  
**Real token flow**: ❌ **Not working** (parser blocks guard evaluation)  
**ADT operations in guards**: ❌ **Not usable** (syntax not parseable)  
**Output token production**: ❓ **Unknown** (not tested)

---

## What Would Make It Work

### Minimal viable path (estimated effort):

1. **Fix booleanParser** (~2-4 hours)
   - Add funcall recognition in `parseAnyTermString`
   - Handle `name(arg1, arg2, ...)` syntax
   - Support nested calls

2. **Test token production** (~1 hour)
   - Fire `scheduleJob` manually with proper bindings
   - Verify Job ADT appears in output place
   - Debug if action→output wiring broken

3. **Update observations** (~1 hour)
   - Rewrite intention observations to check actual output tokens
   - Include expected ADT structure

4. **Add mutation tests** (~1 hour)
   - Modify expected outputs → verify verdict changes
   - Test with wrong token sorts
   - Test negative case with sufficient material

5. **Public API for cache** (~30 min)
   - Add `simulator.invalidateEnabledCache()` or similar

6. **Subuniformity case** (~30 min)
   - Add Priority variable to one intention
   - Verify 2 cases generated (High, Normal)

**Total realistic estimate**: ~5-7 hours of focused work

---

## Commands Run

```bash
# Infrastructure fixes
git commit -m "Fix infrastructure: buildAdtRegistry Node compat..." 
# Commit 525d6ce

# ADT operations
git commit -m "Add ADT operation support: field accessors..."
# Commit 8736b96

# .js extensions
git commit -m "WIP: Add .js extensions to imports..."  
# Commit b59d7d6

git push origin cursor/satel-apn-testing-eaea
```

---

## Honest Limits

1. **Parser integration incomplete**: Guard strings with ADT ops don't parse
2. **No end-to-end verification**: Token production/observation untested
3. **Observations remain trivial**: Only marking checks, no output verification
4. **No mutation coverage**: Tests could pass even if broken
5. **Subuniformity unused**: All intentions generate 1 case
6. **Private API abuse**: `_enabledCache` hack instead of proper API

The fundamental issue is **guard parsing**, not evaluation. The evaluation logic works but is unreachable because the parser rejects the guard syntax before it gets there.

---

## Next Steps

To make SATEL V2 genuinely work:

1. Fix `booleanParser.js` to parse funcall syntax
2. Test full transition firing with ADT tokens
3. Rewrite observations to check real outputs
4. Add mutation tests
5. Document per-case: injected tokens, fired binding, produced tokens, observation, verdict
6. Remove `_enabledCache` hack
7. Add subuniformity example

**Without parser fix**: System cannot evaluate ADT guards, net doesn't work.
