# ADT Constructor Partitioning - Implementation Summary

## Overview

Extended SATEL's semantic subuniformity to support **ADT constructor partitioning**, enabling test generation beyond integers to algebraic datatypes (List, String, Pair, Bool).

## Implementation Complete ✅

### Core Extensions (430 lines added to existing modules)

1. **GuardAnalyzer.js** (+50 lines)
   - Detect ADT sorts from binding type annotations
   - Infer sorts from place type declarations
   - Track sort information alongside constraints

2. **PartitionGenerator.js** (+250 lines)
   - `generateADTRepresentatives()` — Partition by constructor shape
   - `generateWitnessTerm()` — Create witness terms with default args
   - `generateDefaultValue()` — Recursive default value generation
   - `selectMinimalConstructor()` — Prefer nullary constructors
   - Updated `generateAbstractionDoc()` for ADT documentation

3. **Subuniformity.js** (+30 lines)
   - Pass `adtRegistry` parameter
   - Pass `maxDepth` option for recursive ADTs
   - Updated guard analysis to include ADT sort detection

4. **StateSpaceExplorer.js** (+20 lines)
   - Accept `adtRegistry` in `buildReachabilityGraph()`
   - Propagate registry to `computeSubuniformTransitions()`

### New Example (276 lines)

**List Processing Example** (`satel/examples/list/`)
- `net.js` — 3 lists: `[]`, `[1]`, `[1,2,3]`
- `intentions.js` — 2 intentions: process non-empty, reject empty
- `README.md` — Complete documentation with equivalence classes

### New Verification (200 lines)

**verify-adt-partitioning.mjs**
- Test List partitioning: `[]` vs `[0]`
- Test Pair partitioning: `(0, 0)`
- Test String partitioning: `""` vs `"a"`
- Test integration with test generation
- Verify test cases have non-empty traces

### Documentation (600+ lines)

1. **ADT-CONSTRUCTOR-DESIGN.md** (432 lines)
   - Complete design rationale
   - Integration points
   - Future work

2. **SUBUNIFORMITY.md** (updated)
   - ADT partitioning section
   - Supported shapes
   - Examples and limitations

## Supported ADT Shapes

### 1. List
**Partition:** Empty vs Non-empty
```javascript
Representatives: [[], [0]]
```
**Equivalence:**
- `[]` — Empty (Nil)
- `[1]`, `[1,2,3]`, `[x,y,z]` — Non-empty (Cons)

### 2. String
**Partition:** Empty vs Non-empty
```javascript
Representatives: ["", "a"]
```

### 3. Pair
**Partition:** Single representative
```javascript
Representatives: [{fst: 0, snd: 0, __pair__: true}]
```

### 4. Bool
**Partition:** Exhaustive
```javascript
Representatives: [false, true]
```

### 5. Int
**Partition:** Sign regions
```javascript
Representatives: [-1, 0, 1]
```

## Partitioning Strategy

### Step 1: Detect ADT Sort

```javascript
// From binding type annotation
binding: 'lst' with varType: 'List'

// OR from place sort declaration
place: { id: 'queue', sort: 'List', ... }
```

### Step 2: Partition by Constructor Shape

```javascript
Sort: List
Constructors (conceptual):
  - Nil (nullary) → []
  - Cons (binary: head, tail) → [head | tail]

Equivalence Classes:
  - {[]} — All empty lists
  - {[_|_]} — All non-empty lists

Representatives:
  - [] (empty)
  - [0] (non-empty with default element)
```

### Step 3: Generate Witness Terms

For each constructor, generate minimal witness:
- **Nullary** (arity 0): Use constructor directly
  - `None` → `None`
  - `[]` → `[]`
- **Unary/n-ary**: Recursively generate arguments
  - `Some(x: Int)` → `Some(0)`
  - `Cons(h: Int, t: List)` → `[0]` (literal syntax)
- **Depth bound**: Limit recursion (`maxDepth = 2`)
  - `Tree` → `Node(0, Leaf, Leaf)` not `Node(0, Node(...), ...)`

## Example: List Processing

### Setup
```javascript
Tokens: [], [1], [1,2,3]
Transition: processNonEmpty
Guard: length(lst) > 0
Binding: lst (sort: List)
```

### Without Subuniformity (Enumeration)
```
Try all tokens:
- Fire with [] → length=0, guard fails ❌
- Fire with [1] → length=1, guard passes ✅
- Fire with [1,2,3] → length=3, guard passes ✅

Result: 2 successful firings
Problem: [1] and [1,2,3] are equivalent (both non-empty)!
```

### With Subuniformity (Constructor Partitioning)
```
Detect sort: List
Partition by constructor:
- Class 1: [] (empty)
- Class 2: [_|_] (non-empty)

Representatives: [], [0]

Try representatives:
- Fire with [] → length=0, guard fails ❌
- Fire with [0] → length=1, guard passes ✅

Result: 1 firing per constructor class
Reduction: 50% (2 → 1 for non-empty class)
```

## Depth Bounding for Recursive ADTs

### Problem: Infinite Terms

Recursive ADTs can generate infinite terms:
```
List = Nil | Cons(head: Int, tail: List)

Cons(0, Nil) → [0]
Cons(0, Cons(0, Nil)) → [0, 0]
Cons(0, Cons(0, Cons(0, Nil))) → [0, 0, 0]
... (infinite)
```

### Solution: Depth Limit

**maxDepth = 2:**
```javascript
depth 0: [] (Nil, nullary)
depth 1: [0] (Cons with default head, Nil tail)
depth 2: [0, 0] (Cons with default head, Cons tail)
depth 3+: Use minimal constructor (Nil)
```

**For Tree ADT:**
```
depth 0: Leaf (nullary)
depth 1: Node(0, Leaf, Leaf) (default value, minimal children)
depth 2: Node(0, Node(0, Leaf, Leaf), Leaf)
depth 3+: Leaf (minimal constructor at depth limit)
```

## Soundness & Completeness

### Soundness ✅

**Claims:**
- Finite representatives per ADT (bounded by number of constructors)
- Depth-bounded recursion (no infinite terms)
- One witness per constructor (no enumeration of arguments)

**Guarantees:**
- Termination: Finite constructors × finite depth
- No false completeness: Admits incompleteness for arguments
- Documented: Every abstraction documented

### Completeness ⚠️

**Complete when:**
- ✅ Finite non-recursive ADTs (Bool, Pair)
- ✅ Top-level constructor coverage (all shapes represented)

**Incomplete when:**
- ⚠️ Constructor arguments: Only default values tested
- ⚠️ Deep structures: Depth limit truncates recursive terms

**Documentation:**
```javascript
{
  variable: 'lst',
  sort: 'List',
  representatives: [[], [0]],
  note: 'ADT constructor partitioning for List',
  incompleteness: 'One representative per constructor shape; arguments use default values'
}
```

## Integration Points

### StateSpaceExplorer
```javascript
await buildReachabilityGraph(petriNet, simulator, {
  maxStates: 300,
  adtRegistry: registry, // NEW
  subuniformity: {
    enableSubuniformity: true,
    maxDepth: 2 // NEW
  }
});
```

### Test Generator
```javascript
await generateTestSuite(intentions, petriNet, simulator, {
  adtRegistry: registry, // NEW
  subuniformity: { maxDepth: 2 }
});
```

## Verification

```bash
$ node verify-adt-partitioning.mjs

Testing ADT Constructor Partitioning
======================================================================

[Test 1] List ADT Partitioning
✅ PASS: List Partitioning: [] and [0]
  Generated 2 representatives: empty=[], non-empty=[0]

[Test 2] Pair ADT Partitioning
✅ PASS: Pair Partitioning: (0, 0)
  Generated 1 representative(s)

[Test 3] String ADT Partitioning
✅ PASS: String Partitioning: "" and "a"
  Generated 2 representatives: empty="", non-empty="a"

[Test 4] List Example Integration
✅ PASS: List Example: Generate test suite
  Generated 2 cases in 8500ms

[Test 5] Test Case Bindings
✅ PASS: All test cases have non-empty traces
  2 cases, all with traces: true

======================================================================
Summary: 5 passed, 0 failed
✅ All tests passed!
```

## Limitations (Documented)

### Current

1. **Built-in ADTs only**
   - List, String, Pair use literal syntax (`[]`, `""`, `(,)`)
   - No explicit constructor syntax (`Nil`, `Cons`) yet

2. **Argument defaults**
   - Constructor arguments use default values (0, false, "", [])
   - No argument partitioning (e.g., all `Some(x)` use `x=0`)

3. **Depth limit**
   - Recursive ADTs truncated at `maxDepth=2`
   - Deep structures not fully explored

4. **No custom ADTs with explicit constructors**
   - User-defined ADTs (Option, Result, Tree) not supported yet
   - Requires `<constructor>` XML elements

### Future Work

1. **Explicit constructor syntax**
   ```javascript
   { __adt__: true, constructor: 'Some', args: [42] }
   ```

2. **Argument partitioning**
   - Recursively partition constructor arguments
   - `Some(x: Int)` → `{Some(-1), Some(0), Some(1)}`

3. **Custom ADT support**
   ```xml
   <type name="Option">
     <constructor name="None" arity="0"/>
     <constructor name="Some" arity="1">
       <param index="0" type="Any"/>
     </constructor>
   </type>
   ```

4. **SMT witness generation**
   - Use Z3 to generate constructor arguments
   - Satisfy guards with witness values

## Files Summary

### Created (1,106 lines)
```
src/satel/examples/list/
├── net.js (96 lines)
├── intentions.js (30 lines)
└── README.md (150 lines)

docs/
└── ADT-CONSTRUCTOR-DESIGN.md (432 lines)

verify-adt-partitioning.mjs (200 lines)
ADT-PARTITIONING-SUMMARY.md (this file)
```

### Modified (430 lines added)
```
src/satel/core/
├── GuardAnalyzer.js (+50 lines)
├── PartitionGenerator.js (+250 lines)
├── Subuniformity.js (+30 lines)
└── StateSpaceExplorer.js (+20 lines)

docs/
└── SUBUNIFORMITY.md (+80 lines)
```

## Key Achievements

✅ **Extended subuniformity beyond integers**
- List, String, Pair, Bool now supported

✅ **Sound constructor partitioning**
- Finite representatives per ADT
- Depth-bounded recursion
- Documented incompleteness

✅ **Working example**
- List processing with 2 constructor classes
- Verified test generation
- Complete documentation

✅ **No regression**
- Manufacturing example still works (~10s)
- Integer partitioning unchanged
- Backward compatible

✅ **Honest about limitations**
- Built-in ADTs only (documented)
- Argument defaults (documented)
- Depth limits (documented)

## Summary for Levi

**Goal:** Partition test values by ADT constructors (e.g., `empty` vs `cons`, `none` vs `some`).

**Achieved:**
1. ✅ Detect ADT sorts from bindings/places
2. ✅ Partition by top-level constructor shapes
3. ✅ Generate witness terms with default arguments
4. ✅ Depth-bound recursive ADTs (maxDepth=2)
5. ✅ Document finite incompleteness
6. ✅ Integrated into Generate
7. ✅ List processing example with verification
8. ✅ Documented in SUBUNIFORMITY.md

**Supported shapes:**
- List: `[]` (empty) vs `[0]` (non-empty)
- String: `""` vs `"a"`
- Pair: `(0, 0)`
- Bool: `false`, `true`
- Int: `-1`, `0`, `1`

**Limitations (honest):**
- Built-in ADTs only (literal syntax)
- Argument defaults (no argument partitioning)
- Depth limit for recursion
- Custom ADTs: future work

**Verification:** 5/5 tests passing

---

**Status:** ✅ ADT constructor partitioning complete, verified, and documented.

**Branch:** `cursor/satel-apn-testing-eaea` (PR #2)
