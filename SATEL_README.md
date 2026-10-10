# SATEL for Algebraic Petri Nets

Implementation of SATEL (Semi-Automatic Testing Language) concepts for algebraic Petri nets, based on Levi Lucio's PhD thesis (Geneva, 2009).

## 🌐 Live Demo

**[View SATEL Demo Page](https://levilucio.github.io/Browser-Petri-Net-Editor/satel-demo.html)** (GitHub Pages)

> Interactive documentation with examples, reduction hypotheses explanation, and thesis mapping.

## 📺 Media & Videos

<p align="center">
  <img src="docs/media/demo.gif" alt="SATEL Demo" width="800">
</p>

*Quick demo of the Petri net editor (6 seconds). See the [live demo](https://levilucio.github.io/Browser-Petri-Net-Editor/satel-demo.html) for complete SATEL walkthrough.*

**Available Media**:
- **[Demo Video](docs/media/demo.mp4)** - MP4 format (186KB)
- **[Demo GIF](docs/media/demo.gif)** - Animated preview (415KB)
- **[Video Scripts](docs/videos/VIDEO_SCRIPTS.md)** - 3 detailed scripts for extended recordings (2-3 minutes each)

## Overview

This implementation adapts the thesis's test intention concepts from CO-OPN object-oriented specifications to flat **Algebraic Petri Nets (APNs)**. It provides:

- **Test intentions**: High-level specifications of behavior to test
- **I/O interface**: Marking places/transitions as stimulations (inputs) or observations (outputs)
- **Test generation**: Automatic generation of concrete test cases from intentions
- **Oracles**: HML-style event sequences with positive/negative expected results
- **Test reduction**: Uniformity, regularity, and axiom-based reduction hypotheses
- **Test execution**: Running generated tests against the APN simulator

## Quick Start

```javascript
import { AlgebraicSimulator } from './features/simulation/algebraic-simulator';
import { generateTestSuite, executeTestSuite } from './satel';
import { drinkVendingNet } from './satel/examples/drinkVending/net';
import { drinkVendingIntentions } from './satel/examples/drinkVending/intentions';

const simulator = new AlgebraicSimulator();

// Generate test suite from intentions
const testSuite = await generateTestSuite(
  drinkVendingIntentions,
  drinkVendingNet,
  simulator
);

console.log(`Generated ${testSuite.testCases.length} test cases`);

// Execute tests
const results = await executeTestSuite(testSuite, drinkVendingNet, simulator);
console.log(`Passed: ${results.passed}/${results.totalTests}`);
```

## Project Structure

```
satel/
├── core/
│   ├── StateSpaceExplorer.js    # Reachability graph construction
│   ├── TestGenerator.js          # Test case generation from intentions
│   ├── OracleGenerator.js        # Oracle generation (HML formulas)
│   └── ReductionEngine.js        # Test set reduction
├── io/
│   ├── IOInterface.js            # I/O marking (stimulations/observations)
│   └── TestExecutor.js           # Test execution and validation
├── language/
│   └── types.js                  # Type definitions (JSDoc)
├── ui/
│   └── (UI components for future integration)
└── examples/
    ├── drinkVending/             # Drink vending machine (thesis Ch. 1)
    ├── banking/                  # Banking server operations
    └── (more examples TBD)
```

## Examples

### 1. Drink Vending Machine

Classic example from thesis Chapter 1. System accepts coins, allows drink selection, dispenses drinks with change or error messages.

**I/O Interface:**
- **Inputs**: coinSlot (place), selection (place), insertCoin (transition), selectDrink (transition)
- **Outputs**: dispensed (place), change (place), errorMsg (place), dispenseWater/Beer (transitions)

**Test Intentions:**
- Buy water with exact payment (uniformity hypothesis)
- Buy water with overpayment (regularity hypothesis)
- Buy beer with exact payment
- Error: insufficient funds (uniformity)
- Error: out of stock
- Negative: cannot dispense without payment

See `satel/examples/drinkVending/README.md` for details.

### 2. Banking Server

Simplified banking with login, deposit, withdraw, logout operations.

**Test Intentions:**
- Successful login and deposit (uniformity over users)
- Successful withdrawal
- Failed withdrawal: insufficient funds (axiom-based)
- Multiple deposits (regularity for loops)
- Complete session (end-to-end)

See `satel/examples/banking/` for details.

## Test Intentions

A test intention specifies:

```javascript
{
  id: "buy-water-exact",
  name: "Buy water with exact payment",
  
  // 1. Path pattern (event sequence)
  pathPattern: {
    type: "sequence",  // or "choice", "parallel", "loop"
    events: [
      { transition: "insertCoin", binding: { c: 2 } },
      { transition: "selectDrink", binding: { d: "water" } },
      { transition: "dispenseWater" }
    ]
  },
  
  // 2. Input constraints
  inputConstraints: [
    { place: "coinSlot", pattern: "2" },
    { place: "selection", pattern: '"water"' }
  ],
  
  // 3. Output expectations (oracle)
  outputExpectations: [
    { place: "dispensed", pattern: '"water"' },
    { place: "change", pattern: "0" }
  ],
  
  // 4. Reduction hypothesis
  reductionHypothesis: {
    type: "uniformity",
    domain: "drinks",
    representative: "water",
    reason: "All drinks behave identically if payment >= price"
  },
  
  // 5. Oracle type
  oracleType: "positive"  // or "negative"
}
```

## Reduction Hypotheses

### Uniformity
"If behavior is uniform over domain D, test one representative"

Example: All drinks (water, beer, soda) behave the same → test only "water"

### Regularity
"If behavior is regular (loops), test boundary cases"

Example: For loops, test 0, 1, 2, many iterations

### Axiom-Based
"Two transitions are equivalent if they use the same guard/action structure"

Example: dispenseWater and dispenseBeer have same structure (only differ in constants)

## HML-Style Event Sequences

Test intentions are expressed as Hennessy-Milner Logic formulas:

```
# Positive oracle (expected behavior)
<insertCoin(2)><selectDrink(water)><dispenseWater> => true

# Negative oracle (forbidden behavior)
<selectDrink(water)><dispenseWater> => false

# Parallel inputs
<insertCoin> AND <insertCoin> => "concurrent coin insertions"

# Choice
<selectDrink(water) OR selectDrink(beer)>

# Loop
<insertCoin>*
```

## API Reference

### I/O Interface

```javascript
import { markIOType, extractInterface, validateInterface } from './satel';

// Mark place as input
const place = markIOType({ id: 'p1', label: 'Input' }, 'input', 'User input');

// Extract interface
const iface = extractInterface(petriNet);
console.log(iface.inputPlaces, iface.outputPlaces);

// Validate interface
const validation = validateInterface(petriNet);
console.log(validation.valid, validation.errors, validation.warnings);
```

### Test Generation

```javascript
import { generateTestSuite } from './satel';

const testSuite = await generateTestSuite(
  testIntentions,    // Array of test intentions
  petriNet,          // Petri net specification
  simulator,         // Algebraic simulator instance
  {
    maxStates: 1000,           // Max states in reachability graph
    maxDepth: 50,              // Max depth for exploration
    maxPathsPerIntention: 100, // Max paths per intention
    applyReduction: true       // Apply reduction hypotheses
  }
);

console.log(testSuite.testCases);
console.log(testSuite.statistics);
```

### Test Execution

```javascript
import { executeTestSuite, generateExecutionReport } from './satel';

const results = await executeTestSuite(testSuite, petriNet, simulator);

console.log(results.passed, results.failed, results.errors);
console.log(results.testResults);

// Human-readable report
const report = generateExecutionReport(results);
console.log(report);
```

### Oracles

```javascript
import { generateOracle, validateOracle, generateHMLFormula } from './satel';

// Generate oracle from intention and trace
const oracle = generateOracle(testIntention, trace, finalMarking, petriNet);

// Validate actual result against oracle
const validation = validateOracle(actualMarking, oracle, petriNet);
console.log(validation.passed, validation.errors);

// Generate HML formula for display
const formula = generateHMLFormula(pathPattern, includeResult=true);
console.log(formula);  // "<insertCoin(2)><selectDrink(water)> => true"
```

### Reduction

```javascript
import { applyReduction, computeTransitionEquivalenceClasses } from './satel';

// Apply reduction hypotheses
const reduced = applyReduction(testCases, testIntentions, petriNet);

// Compute equivalence classes
const classes = computeTransitionEquivalenceClasses(petriNet);
console.log(classes);  // Map<signature, transitionIds[]>
```

## Testing

```bash
cd petri-net-app

# Run all SATEL tests
npm test -- --testPathPattern=satel

# Run unit tests only
npm test -- --testPathPattern=satel --testPathIgnorePatterns=integration

# Run integration test
npm test -- --testPathPattern=satel/integration

# All tests (34 total: 27 unit + 7 integration)
npm test
```

## Thesis Mapping

This implementation adapts the following thesis concepts to APNs:

| Thesis (CO-OPN) | APN Implementation |
|---|---|
| Methods (inputs) | Input places + input transitions |
| Gates (outputs) | Output places + output transitions |
| Classes/Objects | Flattened into single APN |
| Context modules | Not implemented (out of scope) |
| Synchronization (`//`) | Arc dependencies |
| BGM exhaustive test set | Reachability graph exploration |
| Uniformity hypothesis | Reduction by domain representatives |
| Regularity hypothesis | Boundary case reduction |
| Axiom-based equivalence | Structural transition equivalence |
| HML formulas | Path patterns + oracles |

## What's Implemented vs. Deferred

### ✅ Implemented
- I/O interface for APNs (stimulations/observations)
- Test intention language (syntax + semantics)
- Test generation from intentions
- Reachability graph exploration (state space)
- Oracle generation (positive/negative)
- HML-style event sequences
- Reduction hypotheses (uniformity, regularity, axiom-based)
- Test execution and validation
- Drink vending machine example (thesis Ch. 1)
- Banking server example
- Automated tests (34 tests, all passing)
- Complete API documentation

### ⏸️ Deferred
- Full CO-OPN class/context hierarchy (out of scope)
- CoopnBuilder integration (out of scope)
- BGM decomposition in full generality (thesis notes it's unfinished)
- UI integration (basic implementation, not full editor integration)
- More complex reactive workflow examples
- Parallel/choice/loop path pattern evaluation (basic structure in place)
- Constraint solver integration for complex guards

## Future Work

1. **UI Integration**: Properties panel for I/O marking, test intention editor, results viewer
2. **More Examples**: Complex workflows (task management, RTaxPM-style processes)
3. **Advanced Path Patterns**: Full choice/parallel/loop support with backtracking
4. **Constraint Solving**: Integrate Z3 for generating input values from guard constraints
5. **Coverage Metrics**: Transition coverage, state coverage, path coverage
6. **Mutation Testing**: Generate mutants and measure test suite effectiveness
7. **Interactive Test Debugging**: Step through test execution with visualization

## References

- Levi Lucio (2009). "SATEL — A Test Intention Language for Object-Oriented Specifications of Reactive Systems". PhD Thesis, University of Geneva.
- Bernot, Gaudel, Marre (1991). "Software Testing Based on Formal Specifications". BGM Theory.
- Hennessy, Milner (1985). "Algebraic laws for nondeterminism and concurrency". HML Logic.

## License

MIT (same as parent project)

## Authors

- **Original Thesis**: Levi Pedro Silva Lucio (2009)
- **APN Implementation**: Cursor Cloud Agent (2026)
- **Supervision**: Based on thesis advisor Didier Buchs and committee

---

**Note**: This is a research prototype implementing PhD thesis concepts for algebraic Petri nets. It demonstrates feasibility and core algorithms but is not production-ready. For production use, consider additional validation, performance optimization, and comprehensive error handling.
