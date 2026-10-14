# Option Request Handler - Custom ADT Example

## Overview

Demonstrates **general constructor partitioning** with user-defined **Option** ADT.

## Option ADT Definition

```xml
<type name="Option">
  <constructor name="None" arity="0" result="Option"/>
  <constructor name="Some" arity="1" result="Option">
    <param index="0" type="Any"/>
  </constructor>
</type>
```

**Conceptual type:**
```
Option<T> = None | Some(value: T)
```

## Petri Net Structure

### Places
1. **requests** (Input, sort: Option)
   - Tokens: `Some(42)`, `None`
   - Contains option values (some with data, some empty)

2. **processed** (Output, sort: Int)
   - Successfully unwrapped values from Some

3. **rejected** (Output, sort: Option)
   - None requests that were rejected

### Transitions
1. **processRequest**
   - Guard: `isSome(req)`
   - Action: `value = unwrap(req)`
   - Processes Some requests, extracts value

2. **rejectNone**
   - Guard: `isNone(req)`
   - Rejects None requests

## Constructor Partitioning

### Without Subuniformity
```
Available tokens: Some(42), None

Try firing processRequest:
- Some(42) → isSome(Some(42)) = true ✓
- None → isSome(None) = false ✗

Try firing rejectNone:
- Some(42) → isNone(Some(42)) = false ✗
- None → isNone(None) = true ✓

Result: 2 firings total
```

### With Subuniformity (Constructor Partitioning)
```
Detect sort: Option
Walk ADT constructors:
  - None (arity 0)
  - Some (arity 1, param: Any)

Generate witnesses:
  - None → { __adt__: true, constructor: 'None', args: [] }
  - Some(0) → { __adt__: true, constructor: 'Some', args: [0] }

Representatives: [None, Some(0)]

Equivalence Classes:
  - Class 1: None (all None values)
  - Class 2: Some(_) (all Some values, regardless of argument)

Try firing processRequest with representatives:
  - None → guard fails
  - Some(0) → guard passes ✓

Result: 1 firing per constructor class
```

## Key Insight

**All Some values are equivalent under constructor partitioning:**
- `Some(42)` ~ `Some(100)` ~ `Some(x)`
- All satisfy `isSome` guard
- All enable `processRequest` transition

**Subuniformity recognizes this:** Test `Some(0)` (default argument) as representative for entire `Some` class.

## Test Intentions

### Intention 1: Process Some Request
- **Pattern:** `processRequest`
- **Oracle:** Some constructor satisfies `isSome` guard
- **Expected:** Test case with `Some(0)` representative

### Intention 2: Reject None Request
- **Pattern:** `rejectNone`
- **Oracle:** None constructor satisfies `isNone` guard
- **Expected:** Test case with `None` representative

## Expected Output

```
Subuniformity Statistics:
========================
Transition: processRequest
  Variable: req
  Sort: Option
  Constructors: 2
  Representatives: [
    { __adt__: true, constructor: 'None', args: [] },
    { __adt__: true, constructor: 'Some', args: [0] }
  ]
  
  Documentation:
    variable: req
    sort: Option
    representatives: [None, Some(0)]
    note: "ADT constructor partitioning for Option"
    incompleteness: "One representative per constructor; Some argument uses default value (0)"
    
Test Cases: 2
  1. process-some: [processRequest] with Some(0)
  2. reject-none: [rejectNone] with None
```

## Comparison

| Approach | Tokens | Test Cases | Coverage |
|----------|--------|------------|----------|
| **Enumeration** | `Some(42), None` | 2 (one per token) | Both constructors |
| **Subuniformity** | `Some(0), None` | 2 (one per constructor) | Both constructors |

**Note:** In this small example, reduction is minimal. Real benefit appears with multiple `Some` values: `Some(1)`, `Some(2)`, ..., `Some(100)` → all represented by `Some(0)`.

---

**Demonstrates:** General constructor partitioning from user-defined ADT signature.
