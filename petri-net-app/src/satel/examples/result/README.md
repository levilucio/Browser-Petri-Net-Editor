# Result Validation Pipeline - Custom ADT Example

## Overview

Demonstrates **general constructor partitioning** with user-defined **Result** ADT.

## Result ADT Definition

```xml
<type name="Result">
  <constructor name="Ok" arity="1" result="Result">
    <param index="0" type="Any"/>
  </constructor>
  <constructor name="Err" arity="1" result="Result">
    <param index="0" type="String"/>
  </constructor>
</type>
```

**Conceptual type:**
```
Result<T, E> = Ok(value: T) | Err(error: E)
```

## Petri Net Structure

### Places
1. **inputs** (Input, sort: Result)
   - Tokens: `Ok(100)`, `Ok(200)`, `Err("Invalid input")`
   - Validation results

2. **validated** (Output, sort: Int)
   - Successfully validated values

3. **errors** (Output, sort: String)
   - Error messages

### Transitions
1. **acceptValid**
   - Guard: `isOk(result)`
   - Action: `value = unwrap(result)`
   - Accepts Ok results

2. **rejectInvalid**
   - Guard: `isErr(result)`
   - Action: `error = unwrapErr(result)`
   - Rejects Err results

## Constructor Partitioning

### Without Subuniformity
```
Available tokens: Ok(100), Ok(200), Err("Invalid input")

Try firing acceptValid:
- Ok(100) → isOk(Ok(100)) = true ✓
- Ok(200) → isOk(Ok(200)) = true ✓
- Err("Invalid input") → isOk(Err(...)) = false ✗

Result: 2 firings for acceptValid
Problem: Ok(100) and Ok(200) are equivalent!
```

### With Subuniformity (Constructor Partitioning)
```
Detect sort: Result
Walk ADT constructors:
  - Ok (arity 1, param: Any)
  - Err (arity 1, param: String)

Generate witnesses (maxDepth=2):
  - Ok(0) → { __adt__: true, constructor: 'Ok', args: [0] }
    (default value for Any → Int → 0)
  - Err("") → { __adt__: true, constructor: 'Err', args: [""] }
    (default value for String → "")

Representatives: [Ok(0), Err("")]

Equivalence Classes:
  - Class 1: Ok(_) — All Ok values, regardless of payload
  - Class 2: Err(_) — All Err values, regardless of error message

Try firing acceptValid with representatives:
  - Ok(0) → guard passes ✓
  - Err("") → guard fails

Result: 1 firing per constructor class
Reduction: 50% (2 Ok firings → 1 representative)
```

## Key Insight

**All Ok values are equivalent under constructor partitioning:**
- `Ok(100)` ~ `Ok(200)` ~ `Ok(x)`
- All satisfy `isOk` guard
- Constructor determines behavior, not payload

**All Err values are equivalent:**
- `Err("Invalid")` ~ `Err("Error")` ~ `Err(msg)`
- All satisfy `isErr` guard
- Constructor determines behavior, not error message

## Test Intentions

### Intention 1: Accept Ok Result
- **Pattern:** `acceptValid`
- **Oracle:** Ok constructor satisfies `isOk` guard
- **Expected:** Test case with `Ok(0)` representative

### Intention 2: Reject Err Result
- **Pattern:** `rejectInvalid`
- **Oracle:** Err constructor satisfies `isErr` guard
- **Expected:** Test case with `Err("")` representative

## Expected Output

```
Subuniformity Statistics:
========================
Transition: acceptValid
  Variable: result
  Sort: Result
  Constructors: 2
  Representatives: [
    { __adt__: true, constructor: 'Ok', args: [0] },
    { __adt__: true, constructor: 'Err', args: [""] }
  ]
  
  Documentation:
    variable: result
    sort: Result
    representatives: [Ok(0), Err("")]
    note: "ADT constructor partitioning for Result"
    incompleteness: "One representative per constructor; arguments use default values"
    
Test Cases: 2
  1. accept-ok: [acceptValid] with Ok(0)
  2. reject-err: [rejectInvalid] with Err("")
```

## Comparison

| Tokens | Without Subuniformity | With Subuniformity | Reduction |
|--------|----------------------|-------------------|-----------|
| `Ok(100), Ok(200), Err(...)` | 3 firings (2 Ok, 1 Err) | 2 firings (1 per constructor) | 33% |
| `Ok(1..100), Err(...)` | 101 firings | 2 firings | 98% |

**Real-world scenario:** With 100 Ok values and various Err messages, subuniformity reduces from 100+ firings to 2 constructor classes.

---

**Demonstrates:** General constructor partitioning with multiple constructors, each having arguments with default value generation.
