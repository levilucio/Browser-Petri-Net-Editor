# ADT Constructor Partitioning Design

## Current ADT System

### Existing Types (Base ADTs)
- **Int**: Arithmetic operations (+, -, *, ==, !=, <, <=, >, >=)
- **Bool**: Logical operations (and, or, not, ==, !=)
- **Pair**: Tuple operations (fst, snd, ==, !=)
- **String**: String operations (concat, substring, length, ==, !=)
- **List**: List operations (length, concat, head, tail, append, ==, !=)

### Current Representation
**Operations, not constructors:**
```xml
<type name="List">
  <operation name="head" arity="1" result="Any"/>
  <operation name="tail" arity="1" result="List"/>
  <operation name="concat" arity="2" result="List"/>
</type>
```

**Literal syntax:**
- Lists: `[]`, `[1, 2, 3]`
- Pairs: `(x, y)`
- Strings: `"hello"`
- Integers: `42`
- Booleans: `true`, `false`

### What's Missing
**Constructor-based ADTs:**
```
List = Nil | Cons(head: Any, tail: List)
Option = None | Some(value: Any)
Result = Ok(value: Any) | Err(error: String)
Tree = Leaf | Node(value: Any, left: Tree, right: Tree)
```

## Goal: Constructor Partitioning

### Target ADT Format

Need to distinguish **constructors** (create values) from **operations** (transform values):

```xml
<type name="Option">
  <constructor name="None" arity="0"/>
  <constructor name="Some" arity="1">
    <param index="0" type="Any"/>
  </constructor>
  <operation name="isNone" arity="1" result="Bool">
    <param index="0" type="Option"/>
  </operation>
  <operation name="isSome" arity="1" result="Bool">
    <param index="0" type="Option"/>
  </operation>
</type>
```

### Partitioning Strategy

**Phase 1: Detect ADT Sort**
1. Check if type name is a registered ADT (not Int/Bool/String)
2. Extract constructor list from ADT definition

**Phase 2: Partition by Constructor**
For ADT type `Option`:
- **Equivalence classes:** `{None}`, `{Some(_)}`
- **Representatives:** `None`, `Some(defaultValue)`

For ADT type `List`:
- **Equivalence classes:** `{[]}` (empty), `{[_|_]}` (non-empty)
- **Representatives:** `[]`, `[defaultValue]`

For ADT type `Tree`:
- **Equivalence classes:** `{Leaf}`, `{Node(_, _, _)}`
- **Representatives:** `Leaf`, `Node(0, Leaf, Leaf)`

**Phase 3: Witness Generation**
For each constructor, generate a minimal witness term:
1. **Nullary constructor** (arity 0): Use constructor directly
   - `None` → `None`
   - `Nil` → `[]`
2. **Unary/n-ary constructor**: Recursively generate arguments
   - `Some(x: Int)` → `Some(0)` (default Int)
   - `Cons(h: Int, t: List)` → `Cons(0, [])` (default Int, default List)
3. **Depth bound**: Limit recursion to prevent infinite terms
   - `maxDepth = 2`: `Node(0, Leaf, Leaf)` not `Node(0, Node(0, Leaf, Leaf), ...)`

## Implementation Plan

### Step 1: Extend ADT Parser
**File:** `utils/adt-parser.js`

Add constructor parsing:
```javascript
function parseConstructors(typeEl) {
  const constructors = [];
  for (const ctorEl of typeEl.querySelectorAll('constructor')) {
    const name = ctorEl.getAttribute('name');
    const arity = Number(ctorEl.getAttribute('arity'));
    const params = [];
    for (const paramEl of ctorEl.querySelectorAll('param')) {
      params.push({
        index: Number(paramEl.getAttribute('index')),
        type: paramEl.getAttribute('type')
      });
    }
    constructors.push({ name, arity, params });
  }
  return constructors;
}
```

### Step 2: Extend GuardAnalyzer
**File:** `satel/core/GuardAnalyzer.js`

Detect ADT sorts in bindings:
```javascript
function analyzeBindingSort(binding, adtRegistry) {
  // Check if binding variable has ADT type annotation
  // Extract sort name (e.g., "Option", "List", "Tree")
  return sortName || null;
}
```

### Step 3: Extend PartitionGenerator
**File:** `satel/core/PartitionGenerator.js`

Add constructor partitioning:
```javascript
function generateADTRepresentatives(sortName, adtRegistry, options = {}) {
  const adt = adtRegistry.getType(sortName);
  if (!adt || !adt.constructors) return [];
  
  const representatives = [];
  for (const ctor of adt.constructors) {
    const witness = generateWitnessTerm(ctor, adtRegistry, 0, options.maxDepth || 2);
    representatives.push(witness);
  }
  return representatives;
}

function generateWitnessTerm(ctor, adtRegistry, depth, maxDepth) {
  if (depth >= maxDepth) {
    // Return minimal constructor if recursive
    return selectMinimalConstructor(ctor.result, adtRegistry);
  }
  
  if (ctor.arity === 0) {
    return { constructor: ctor.name, args: [] };
  }
  
  const args = [];
  for (const param of ctor.params) {
    const argValue = generateDefaultValue(param.type, adtRegistry, depth + 1, maxDepth);
    args.push(argValue);
  }
  return { constructor: ctor.name, args };
}

function generateDefaultValue(sortName, adtRegistry, depth, maxDepth) {
  if (sortName === 'Int') return 0;
  if (sortName === 'Bool') return false;
  if (sortName === 'String') return '';
  if (sortName === 'Any') return 0; // Default to Int
  
  // Recursive ADT
  const adt = adtRegistry.getType(sortName);
  if (adt && adt.constructors) {
    const minimalCtor = selectMinimalConstructor(sortName, adtRegistry);
    return generateWitnessTerm(minimalCtor, adtRegistry, depth, maxDepth);
  }
  
  return 0; // Fallback
}

function selectMinimalConstructor(sortName, adtRegistry) {
  const adt = adtRegistry.getType(sortName);
  if (!adt || !adt.constructors) return null;
  
  // Prefer nullary constructors (arity 0)
  for (const ctor of adt.constructors) {
    if (ctor.arity === 0) return ctor;
  }
  
  // Otherwise, pick first constructor
  return adt.constructors[0];
}
```

### Step 4: Update Subuniformity
**File:** `satel/core/Subuniformity.js`

Integrate ADT partitioning:
```javascript
import { useAdtRegistry } from '../../contexts/AdtContext.js';

export async function computeSubuniformTransitions({
  transitionId,
  petriNet,
  simulator,
  cache,
  adtRegistry, // NEW: Pass ADT registry
  options = {}
}) {
  // ... existing guard analysis ...
  
  // NEW: Check for ADT sorts in bindings
  for (const [varName, constraints] of conditions.variables.entries()) {
    const sortName = detectSort(varName, inputArcs, bindingAstsByArc);
    if (sortName && adtRegistry.getType(sortName)) {
      // Partition by constructors instead of numeric intervals
      const adtReprs = generateADTRepresentatives(sortName, adtRegistry, options);
      partitions.set(varName, adtReprs);
    }
  }
  
  // ... rest of existing logic ...
}
```

### Step 5: Create ADT Example
**File:** `satel/examples/option/net.js`

```javascript
export const optionNet = {
  mode: 'algebraic',
  places: [
    {
      id: 'requests',
      label: 'Requests',
      tokens: 2,
      valueTokens: [
        { constructor: 'Some', args: [42] },
        { constructor: 'None', args: [] }
      ]
    },
    {
      id: 'processed',
      label: 'Processed',
      tokens: 0,
      valueTokens: []
    }
  ],
  transitions: [
    {
      id: 'processRequest',
      label: 'Process Request',
      guard: 'isSome(req)', // Guard checks for Some constructor
      action: ''
    }
  ],
  arcs: [
    {
      id: 'arc1',
      source: 'requests',
      target: 'processRequest',
      binding: 'req'
    },
    {
      id: 'arc2',
      source: 'processRequest',
      target: 'processed',
      binding: 'req'
    }
  ]
};
```

**File:** `satel/examples/option/intentions.js`

```javascript
export const optionIntentions = [
  {
    id: 'handle-some',
    name: 'Handle Some Value',
    description: 'Process requests with Some values',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'processRequest', binding: { req: { constructor: 'Some' } } }
      ]
    },
    oracle: {
      type: 'constructor',
      constructor: 'Some',
      reason: 'Some values should be processed'
    },
    oracleType: 'positive'
  },
  {
    id: 'handle-none',
    name: 'Handle None Value',
    description: 'Requests with None should be blocked',
    pathPattern: {
      type: 'sequence',
      events: [
        { transition: 'processRequest', binding: { req: { constructor: 'None' } } }
      ]
    },
    oracle: {
      type: 'constructor',
      constructor: 'None',
      reason: 'None values should be rejected by guard'
    },
    oracleType: 'negative'
  }
];
```

## Soundness & Completeness

### Soundness ✅
- **Finite constructors:** Each ADT has finite constructors
- **Depth-bounded:** Recursive terms limited by maxDepth
- **One witness per constructor:** No enumeration of all possible values

### Completeness ⚠️
- **Complete for finite ADTs:** All constructor equivalence classes covered
- **Incomplete for arguments:** Only tests default/minimal argument values
- **Depth limit:** Recursive structures truncated

**Documentation:**
```javascript
{
  variable: 'req',
  sort: 'Option',
  representatives: [
    { constructor: 'None', args: [] },
    { constructor: 'Some', args: [0] }
  ],
  note: 'One representative per constructor; Some uses default Int argument (0)',
  incompleteness: 'Does not test all possible Some values (only default)'
}
```

## Limitations

### Current Limitations
1. **No constructor syntax yet:** System uses literals (`[]`) not constructors (`Nil`, `Cons`)
2. **Operations not constructors:** ADTs defined as operations, need constructor support
3. **No type annotations on bindings:** Need to detect ADT sorts from context
4. **Argument defaults:** Only uses default values for constructor arguments

### Future Work
1. **Constructor syntax:** Add support for `Cons(1, Nil)` in bindings
2. **ADT parser extension:** Support `<constructor>` elements in XML
3. **Type inference:** Infer ADT sorts from place types
4. **Argument partitioning:** Recursively partition constructor arguments

## Example Output

### Option Example

**ADT Definition:**
```xml
<type name="Option">
  <constructor name="None" arity="0"/>
  <constructor name="Some" arity="1">
    <param index="0" type="Any"/>
  </constructor>
</type>
```

**Partitioning:**
```javascript
Transition: processRequest
Guard: isSome(req)
Binding: req (sort: Option)

Equivalence Classes:
- Class 1: None (guard false)
- Class 2: Some(_) (guard true)

Representatives:
- None
- Some(0) // Default Int argument

Subuniformity Result:
- 2 firings (one per constructor class)
- Reduction: N/A (only 2 constructors)
```

### List Example

**ADT Definition:**
```xml
<type name="List">
  <constructor name="Nil" arity="0"/>
  <constructor name="Cons" arity="2">
    <param index="0" type="Any"/>
    <param index="1" type="List"/>
  </constructor>
</type>
```

**Partitioning:**
```javascript
Transition: processList
Guard: !isEmpty(lst)
Binding: lst (sort: List)

Equivalence Classes:
- Class 1: Nil / [] (guard true for isEmpty)
- Class 2: Cons(_, _) / [_|_] (guard false for isEmpty)

Representatives:
- [] (empty)
- [0] (single element, default Int)

Subuniformity Result:
- 2 firings (empty vs non-empty)
- Reduction: 50% (if had [1], [2], [3], ..., [100] → now just [] and [0])
```

## Integration Points

### StateSpaceExplorer
- Pass `adtRegistry` to `computeSubuniformTransitions()`
- No other changes needed

### RepresentativeFinder
- Match constructor-based representatives to tokens
- Support `{ constructor: 'Some', args: [42] }` token format

### Test Generator
- Store constructor info in `expectedTrace`
- Display constructor names in UI

---

**Status:** Design complete. Ready for implementation.
