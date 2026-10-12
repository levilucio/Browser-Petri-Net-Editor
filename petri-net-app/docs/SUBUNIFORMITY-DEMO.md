# Subuniformity Demo Example

## Simple Quality Control Example

This example demonstrates semantic subuniformity with a simple quality control process.

### Petri Net Structure

```
Places:
- inputQueue: Contains items with quality scores (integers)
- passed: Passed items
- failed: Failed items

Transitions:
- checkQuality: Guard `score >= 90`
  - Fires when score ≥ 90 → passed
  - Blocked when score < 90
```

### Tokens Available

```javascript
inputQueue: [
  { value: 85 },  // Will fail
  { value: 90 },  // Will pass (boundary)
  { value: 95 },  // Will pass
  { value: 89 },  // Will fail (boundary)
  { value: 100 }  // Will pass
]
```

### Without Subuniformity (Enumeration)

Traditional approach: Try all 5 tokens:
1. Fire with score=85 (fails guard, blocked)
2. Fire with score=90 (passes, transition fires)
3. Fire with score=95 (passes, transition fires)
4. Fire with score=89 (fails guard, blocked)
5. Fire with score=100 (passes, transition fires)

**Result:** 3 transitions generated (one per passing token), but 95 and 100 are equivalent!

### With Subuniformity (Partitioning)

#### Phase 1: Guard Analysis

**Guard:** `score >= 90`

**Extracted conditions:**
```javascript
{
  variables: Map {
    'score' => [{ type: 'comparison', op: '>=', value: 90 }]
  },
  unbounded: []
}
```

#### Phase 2: Partition Generation

**Constants:** `[90]`

**Intervals:**
- `(-∞, 90)`: score < 90 → guard **false**
- `[90, ∞)`: score >= 90 → guard **true**

**Boundary representatives:**
```javascript
{
  score: [89, 90, 91]  // Below, at, above boundary
}
```

#### Phase 3: Representative Finding

Try to find tokens matching each representative:

1. **Representative: 89**
   - Available token: 89 ✅
   - Guard: `89 >= 90` → **false** ❌
   - **Result:** Transition NOT fired (guard blocks)

2. **Representative: 90**
   - Available token: 90 ✅
   - Guard: `90 >= 90` → **true** ✅
   - **Result:** Transition fired → passed

3. **Representative: 91**
   - No token with value 91 ❌
   - Try equivalents: 95 ✅ or 100 ✅
   - Guard: `95 >= 90` → **true** ✅
   - **Result:** Transition fired → passed (using 95 as representative)

#### Result

**2 equivalence classes explored:**
- Class 1: `score < 90` (guard false) — tested with 89, blocked
- Class 2: `score >= 90` (guard true) — tested with 90 and 95

**Reduction:** 3 semantically equivalent firings (90, 95, 100) reduced to 2 (90 as boundary, 95 as representative)

## Manufacturing Example Analysis

### Current State

**Tokens:** Most places have 1 scalar token (`{value: 1}`)

**Guards:**
- `receiveOrder`: No guard
- `passQualityCheck`: `stage == 3 && qualityScore >= 90` (but only 1 token per place)
- `failQualityCheck`: `stage == 3 && qualityScore < 90`

**Subuniformity result:**
- 1 representative per transition (only one token available)
- No reduction YET, but infrastructure in place

### Future: Multiple Orders

When we have multiple orders in queue:

```javascript
orderQueue: [
  { value: 1 },   // Small order
  { value: 50 },  // Medium order
  { value: 100 }  // Large order
]
```

**With guard:** `quantity > 0 && materials >= quantity * 2`

**Partitioning:**
- Materials constraint creates intervals
- Test boundary values instead of all 1..100

## Verification Output

Running `node verify-subuniformity.mjs`:

```
Testing Semantic Subuniformity Implementation
======================================================================

[Test 1] Guard Analysis

✅ PASS: Guard Analysis: x > 0
  Found 1 variable(s), x constraints: 1

✅ PASS: Guard Analysis: x > 0 && x < 10
  Extracted constants: [0, 10]

[Test 2] Partition Generation

✅ PASS: Partition Generation: Boundary values
  Generated 6 representatives: [-1, 0, 1, 9, 10, 11]

✅ PASS: Partition Generation: Unbounded variable
  Generated 1 representative(s): [1]

[Test 3] Equivalence Classes

✅ PASS: Equivalence: 5 ~ 7 in (0,10), 5 ≁ -1
  5~7: true, 5~-1: false

[Test 4] Integration Test

✅ PASS: Subuniformity: receiveOrder
  Found 1 representative binding(s)

[Test 5] Performance Test

✅ PASS: Performance: 5 intentions < 20s
  Generated 5 cases in 8245ms

[Test 6] Test Case Bindings

✅ PASS: All test cases have non-empty traces
  15 cases, all with traces: true

======================================================================
Summary: 6 passed, 0 failed
======================================================================

✅ All tests passed!
```

## Key Insights

### What Works

1. **Guard analysis:** Extracts conditions from ASTs
2. **Partition generation:** Computes boundary representatives
3. **Equivalence checking:** Verifies values satisfy same constraints
4. **Integration:** Wired into state space explorer
5. **Performance:** No regression on manufacturing example

### What's Incomplete (Documented)

1. **Single tokens:** Manufacturing example has 1 token/place (no reduction yet)
2. **Relational guards:** `x >= y * 2` not partitioned (treats as unbounded)
3. **Disjunctive guards:** `x < 0 || x > 10` not supported
4. **Custom ADTs:** No constructor-based partitioning yet

### Soundness Guarantee

**Claim:** "We explore representatives from each equivalence class defined by guard constants."

**NOT claimed:** "We explore ALL possible values" (unsound for infinite domains)

**Documentation:** Every partition includes abstraction note explaining what was tested

## Example Console Output

When generating tests with subuniformity enabled:

```javascript
Subuniformity Statistics:
========================
Transition: passQualityCheck
  Classes: 3
  Representatives: [{qualityScore: 89}, {qualityScore: 90}, {qualityScore: 91}]
  Bounded: 1 variable(s)
  Unbounded: 0 variable(s)
  Summary: "Boundary values around >= 90"
  
Transition: receiveOrder
  Classes: 1
  Representatives: [{x: 1}]
  Bounded: 0 variable(s)
  Unbounded: 1 variable(s)
  Summary: "No guard constraints - single representative"
```

## Comparison Table

| Approach | Manufacturing Example | Quality Control Example |
|----------|----------------------|------------------------|
| **Enumeration** | 4 firings (one/token) | 5 firings (try all tokens) |
| **Subuniformity** | 4 firings (1 repr/trans) | 2-3 firings (boundary classes) |
| **Reduction** | 0% (single tokens) | 40-60% (multiple equiv tokens) |
| **Soundness** | ✅ Complete for finite | ✅ Sound, documents abstraction |

## Next Steps

1. **Add multiple tokens:** Modify manufacturing example to have multiple orders/items per place
2. **Relational guards:** Implement partitioning for `x >= y * c` constraints
3. **ADT partitioning:** Add constructor-based classes for algebraic types
4. **Z3 synthesis:** Generate SMT witnesses instead of just boundaries

---

**Status:** ✅ Subuniformity infrastructure complete and verified. Ready for rich multi-token examples.
