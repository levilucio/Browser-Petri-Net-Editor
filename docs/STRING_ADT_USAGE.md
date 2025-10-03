# String ADT Usage Guide

## Overview

The Petri Net Editor now supports the **String ADT** with full Z3-based constraint solving. String tokens can be used in algebraic Petri nets with concatenation, substring operations, and string comparison in guards.

## String ADT Operations

### Available Operations

1. **`concat(s1, s2)`** - Concatenates two strings
   - **Parameters:** `s1: String`, `s2: String`
   - **Returns:** `String`
   - **Example:** `concat('Hello', ' World')` → `'Hello World'`

2. **`substring(s, start, length)`** - Extracts a substring
   - **Parameters:** `s: String`, `start: Int`, `length: Int`
   - **Returns:** `String`
   - **Example:** `substring('Hello World', 0, 5)` → `'Hello'`

3. **`length(s)`** - Returns the length of a string
   - **Parameters:** `s: String`
   - **Returns:** `Int`
   - **Example:** `length('Hello')` → `5`

4. **String Equality:** `s1 == s2`, `s1 != s2`
   - **Example:** `'Hello' == 'Hello'` → `true`

## String Literal Syntax

Strings are enclosed in **single quotes** (`'`):

```
'Hello World'
'this is a string'
''  // empty string
```

### Escape Sequences

- `\'` - Single quote
- `\\` - Backslash
- `\n` - Newline
- `\t` - Tab
- `\r` - Carriage return

**Example:**
```
'It\'s working!'
'Line 1\nLine 2'
```

## Usage in Petri Nets

### 1. String Tokens in Places

Places can hold string tokens in algebraic mode:

```javascript
valueTokens: ['Hello', 'World', 'Test']
```

### 2. String Variables in Arc Bindings

Input arcs can bind string tokens to variables:

```
x:string
name:string
msg:string
```

**Example Arc Binding:**
```
Input Arc from P1 to T1: x:string
```

### 3. String Operations in Guards

Transition guards can use string comparisons and operations:

```
x:string == 'start'
length(msg:string) > 5
concat(x:string, y:string) == 'HelloWorld'
substring(text:string, 0, 3) == 'cat'
```

**Example Guard:**
```
Transition T1 Guard: x == 'Hello'
```

### 4. String Production in Output Arcs

Output arcs can produce string values using concatenation and substring:

```
concat('Hello, ', name:string)
substring(fullname:string, 0, 10)
'Welcome'
```

**Example Output Arc:**
```
Output Arc from T1 to P2: concat('Hello, ', x)
```

## Complete Example: String Processing Petri Net

### Net Structure

**Places:**
- `P1`: Input strings - `valueTokens: ['Alice', 'Bob']`
- `P2`: Greetings - `valueTokens: []`
- `P3`: Short names - `valueTokens: []`

**Transitions:**
- `T1`: Create greeting
  - **Guard:** `length(name:string) > 0`
  - **Input Arc from P1:** `name:string`
  - **Output Arc to P2:** `concat('Hello, ', name)`

- `T2`: Extract prefix
  - **Guard:** `length(name:string) >= 3`
  - **Input Arc from P1:** `name:string`
  - **Output Arc to P3:** `substring(name, 0, 3)`

### Execution Flow

1. **Initial State:**
   - P1: `['Alice', 'Bob']`
   - P2: `[]`
   - P3: `[]`

2. **Fire T1 with name='Alice':**
   - Consumes `'Alice'` from P1
   - Produces `'Hello, Alice'` in P2
   
3. **Fire T2 with name='Bob':**
   - Consumes `'Bob'` from P1
   - Produces `'Bob'` in P3 (length < 3, so full string)

4. **Final State:**
   - P1: `[]`
   - P2: `['Hello, Alice']`
   - P3: `['Bob']`

## Z3 Constraint Solving

The String ADT uses Z3's String theory for:

1. **String Concatenation:** Z3's `concat` operation
2. **Substring Extraction:** Z3's `substr` operation  
3. **String Length:** Z3's `length` operation
4. **String Equality:** Z3's equality constraints

All string operations in guards and bindings are evaluated using Z3, ensuring correct and consistent results.

## ADT Dialog

The String ADT is included in the base ADT registry and can be viewed in the ADT Dialog:

**Operations:**
- `concat(String, String) → String`
- `substring(String, Int, Int) → String`
- `length(String) → Int`
- `==(String, String) → Bool`
- `!=(String, String) → Bool`

**Axioms:**
- **Associativity:** `concat(concat(x, y), z) = concat(x, concat(y, z))`
- **Empty Left:** `concat('', x) = x`
- **Empty Right:** `concat(x, '') = x`
- **Substring Bounds:** `substring(x, 0, length(x)) = x`
- **Length Concat:** `length(concat(x, y)) = length(x) + length(y)`

## Type Inference

The editor automatically infers `String` type for:
- String literal values: `'hello'` → `String`
- Variables bound to string tokens
- Results of concat/substring operations

Variables can be explicitly typed:
```
x:string
name:string
message:string
```

## Testing

String ADT functionality is tested in:
- `src/__tests__/utils/string-adt.test.js` - Parser and stringify tests
- `src/__tests__/features/type-inference.test.js` - Type inference for strings

All tests pass, ensuring robust string support!

## Examples in Practice

### Example 1: Name Greeting

```
Place P1: ['Alice', 'Bob', 'Charlie']
Transition T1: Guard = length(name:string) > 3
  Input from P1: name:string
  Output to P2: concat('Hello, ', name)
```

Result: P2 gets `['Hello, Alice', 'Hello, Charlie']` (Bob is filtered out)

### Example 2: String Filtering

```
Place P1: ['apple', 'banana', 'apricot']
Transition T1: Guard = substring(fruit:string, 0, 2) == 'ap'
  Input from P1: fruit:string
  Output to P2: fruit
```

Result: P2 gets `['apple', 'apricot']`

### Example 3: Message Concatenation

```
Place P1: ['Error', 'Warning']
Place P2: [': File not found', ': Low disk space']
Transition T1: Guard = T
  Input from P1: level:string
  Input from P2: msg:string
  Output to P3: concat(level, msg)
```

Result: P3 gets combined messages like `'Error: File not found'`

## Limitations

- String operations are computed using Z3, which may have timeout constraints for very complex string constraints
- The `substring` function uses Z3's `substr(string, start, length)` semantics
- String comparison is case-sensitive

## Future Enhancements

Potential additions:
- String contains/indexOf operations
- Regular expression matching
- Case conversion operations
- String splitting/joining

---

**Implementation Date:** 2025-01-03
**Version:** 1.0

