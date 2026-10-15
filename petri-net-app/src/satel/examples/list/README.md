# List Processing Example - ADT Constructor Partitioning

> Historical example notes. V1 intention fixtures have been removed. See `docs/satel/increment-02-gui-v2.md` for the supported GUI workflow and current limitations.

## Overview

This example demonstrates **ADT constructor partitioning** in SATEL's semantic subuniformity system.

## List ADT Structure

**Conceptual constructors:**
```
List = Nil | Cons(head: Any, tail: List)
```

**Literal syntax (as used in editor):**
- `[]` — Empty list (Nil)
- `[1]`, `[1,2,3]` — Non-empty lists (Cons)

## Petri Net

### Places
1. **inputQueue** (Input)
   - Contains 3 lists: `[]`, `[1]`, `[1,2,3]`
   - Sort: `List`

2. **processed** (Output)
   - Non-empty lists

3. **rejected** (Output)
   - Empty lists

### Transitions
1. **processNonEmpty**
   - Guard: `length(lst) > 0`
   - Processes non-empty lists

2. **rejectEmpty**
   - Guard: `length(lst) == 0`
   - Rejects empty lists

## Subuniformity Partitioning

### Without Subuniformity (Enumeration)
```
Available tokens: [], [1], [1,2,3]

Try firing processNonEmpty with each:
- [] → Guard fails (length = 0)
- [1] → Guard passes ✓
- [1,2,3] → Guard passes ✓

Result: 2 firings (but [1] and [1,2,3] are equivalent!)
```

### With Subuniformity (Constructor Partitioning)
```
Detect sort: List
Partition by constructors:
- Class 1: [] (empty/Nil)
- Class 2: [_|_] (non-empty/Cons)

Representatives:
- [] (empty)
- [0] (non-empty with default element)

Try firing processNonEmpty:
- [] → Guard fails
- [0] → Guard passes ✓

Result: 1 firing per constructor class
Reduction: 50% (2 → 1 for non-empty)
```

## Test Intentions

### Intention 1: Process Non-Empty List
- **Pattern:** `processNonEmpty`
- **Oracle:** Non-empty lists (Cons) satisfy `length > 0`
- **Expected:** Test case with `[0]` representative

### Intention 2: Reject Empty List
- **Pattern:** `rejectEmpty`
- **Oracle:** Empty list (Nil) satisfies `length == 0`
- **Expected:** Test case with `[]` representative

## Equivalence Classes

### Class 1: Empty (Nil)
- **Representative:** `[]`
- **Guard behavior:** `length([]) == 0` → `rejectEmpty` fires
- **Members:** All empty lists (only one: `[]`)

### Class 2: Non-Empty (Cons)
- **Representative:** `[0]`
- **Guard behavior:** `length([0]) > 0` → `processNonEmpty` fires
- **Members:** `[1]`, `[1,2,3]`, `[x]`, `[x,y,z]`, ... (infinite!)

## Key Insight

**Subuniformity recognizes that `[1]` and `[1,2,3]` are semantically equivalent:**
- Both are non-empty (Cons)
- Both satisfy `length > 0`
- Both enable the same transition

**No need to test both!** One representative (`[0]`) suffices.

## Documentation Example

```javascript
Subuniformity Statistics:
========================
Transition: processNonEmpty
  Variable: lst
  Sort: List
  Classes: 2
  Representatives: [[], [0]]
  
  Documentation:
    - variable: lst
      sort: List
      representatives: [[], [0]]
      note: "ADT constructor partitioning for List"
      incompleteness: "One representative per constructor shape; arguments use default values"
      
  Summary: "1 ADT variable(s)"
```

## Expected Test Suite

**2 test cases:**
1. `process-non-empty` → `[processNonEmpty]` with binding `lst = [0]`
2. `reject-empty` → `[rejectEmpty]` with binding `lst = []`

**Without subuniformity:** Would generate 3+ cases (one per token)  
**With subuniformity:** 2 cases (one per constructor class)

---

**Demonstrates:** Sound symbolic partitioning by ADT constructors without enumeration.
