# SATEL for Algebraic Petri Nets

**Semi-Automatic Testing Language adapted for Algebraic Petri Nets**

Based on Levi Pedro Silva Lucio's PhD thesis: "SATEL — A Test Intention Language for Object-Oriented Specifications of Reactive Systems" (University of Geneva, 2009)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-34%20passing-brightgreen)](https://github.com/levilucio/satel-apn)

## 🌐 Live Demo

**[View Interactive Demo](https://levilucio.github.io/Browser-Petri-Net-Editor/satel-demo.html)**

Comprehensive walkthrough with examples, reduction hypotheses, and thesis mapping.

## 📺 Video & Media

### Available Media
- **[Demo Video](docs/media/demo.mp4)** (~6 seconds) - Quick demo of Petri net editor
- **[Demo GIF](docs/media/demo.gif)** - Animated preview
- **[Live Interactive Demo](https://levilucio.github.io/Browser-Petri-Net-Editor/satel-demo.html)** - Full SATEL walkthrough

### Video Scripts (for extended recordings)
1. **[SATEL Overview](docs/videos/VIDEO_SCRIPTS.md#video-1)** (2-3 min) - Introduction to test intentions and live demo walkthrough
2. **[I/O Marking](docs/videos/VIDEO_SCRIPTS.md#video-2)** (1-2 min) - Marking places/transitions as stimulations and observations
3. **[Test Generation & Execution](docs/videos/VIDEO_SCRIPTS.md#video-3)** (2-3 min) - Writing intentions, generating tests, viewing oracles

*Short demo video included; comprehensive video scripts available for extended recordings*

## Overview

SATEL enables **automatic test generation** for algebraic Petri nets through high-level **test intentions**:

- **Specify what to test** (path patterns, inputs, expected outputs)
- **Generate test cases** automatically via reachability graph exploration
- **Create oracles** (HML-style event sequences with positive/negative results)
- **Reduce test sets** using uniformity, regularity, and axiom-based hypotheses

## Demo Preview

<p align="center">
  <img src="docs/media/demo.gif" alt="SATEL Demo" width="800">
</p>

*Quick demo of the Petri net editor. See [live demo](https://levilucio.github.io/Browser-Petri-Net-Editor/satel-demo.html) for full SATEL walkthrough.*

## Quick Start

```javascript
import { AlgebraicSimulator } from 'path-to-simulator';
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

## Features

✅ **I/O Interface**: Mark places/transitions as stimulations (inputs) or observations (outputs)  
✅ **Test Intentions**: High-level behavior specifications with constraints and reduction hypotheses  
✅ **Test Generation**: Automatic generation via reachability graph exploration  
✅ **Oracle Generation**: HML-style formulas with positive/negative expected results  
✅ **Test Reduction**: Uniformity, regularity, and axiom-based equivalence  
✅ **Test Execution**: Running and validating tests against APN simulator  

## Example: Drink Vending Machine

### System Description
- Accepts coins (input)
- Allows drink selection: water ($2), beer ($3) (input)
- Dispenses drinks if payment sufficient (output)
- Returns change or shows error messages (output)

### Test Intention

```javascript
{
  id: "buy-water-exact",
  name: "Buy water with exact payment",
  pathPattern: {
    type: "sequence",
    events: [
      { transition: "insertCoin", binding: { c: 2 } },
      { transition: "selectDrink", binding: { d: "water" } },
      { transition: "dispenseWater" }
    ]
  },
  inputConstraints: [
    { place: "coinSlot", pattern: "2" },
    { place: "selection", pattern: '"water"' }
  ],
  outputExpectations: [
    { place: "dispensed", pattern: '"water"' },
    { place: "change", pattern: "0" }
  ],
  reductionHypothesis: {
    type: "uniformity",
    domain: "drinks",
    representative: "water",
    reason: "All drinks behave identically if payment >= price"
  },
  oracleType: "positive"
}
```

### Generated HML Formula

```
<insertCoin(2)><selectDrink(water)><dispenseWater> => true
```

### Result

Test suite generated with **6 test cases** (reduced from ~12 via uniformity/regularity hypotheses).  
All tests pass ✅

## Reduction Hypotheses

### Uniformity
"All drinks behave identically" → test only one representative (e.g., "water")

### Regularity
"Loop behavior is regular" → test boundary cases (0, 1, 2, many iterations)

### Axiom-Based
"Transitions with same structure are equivalent" → test one per equivalence class

## Project Structure

```
satel/
├── core/
│   ├── StateSpaceExplorer.js    # Reachability graph construction
│   ├── TestGenerator.js          # Test case generation from intentions
│   ├── OracleGenerator.js        # Oracle creation (HML formulas)
│   └── ReductionEngine.js        # Test set reduction
├── io/
│   ├── IOInterface.js            # I/O marking (stimulations/observations)
│   └── TestExecutor.js           # Test execution and validation
├── language/
│   └── types.js                  # Type definitions (JSDoc)
├── examples/
│   ├── drinkVending/             # Drink vending machine
│   │   ├── net.js                # APN model with I/O markings
│   │   ├── intentions.js         # 6 test intentions
│   │   └── README.md             # Example documentation
│   └── banking/                  # Banking server operations
└── index.js                      # Main exports
```

## Testing

```bash
npm test
# 34 tests pass ✅ (27 unit + 7 integration)
```

### Test Coverage
- **IOInterface**: I/O marking, interface extraction, validation
- **OracleGenerator**: Oracle generation/validation, HML formulas
- **ReductionEngine**: Uniformity, regularity, axiom-based reduction
- **Integration**: Full workflow with drink vending machine

## API Reference

### I/O Interface

```javascript
import { markIOType, extractInterface, validateInterface } from './satel';

// Mark element as input/output
const place = markIOType({ id: 'p1' }, 'input', 'User input');

// Extract I/O interface
const iface = extractInterface(petriNet);
console.log(iface.inputPlaces, iface.outputPlaces);

// Validate interface
const validation = validateInterface(petriNet);
console.log(validation.valid, validation.warnings);
```

### Test Generation

```javascript
import { generateTestSuite } from './satel';

const testSuite = await generateTestSuite(
  testIntentions,
  petriNet,
  simulator,
  {
    maxStates: 1000,           // Max states in reachability graph
    maxDepth: 50,              // Max depth for exploration
    maxPathsPerIntention: 100, // Max paths per intention
    applyReduction: true       // Apply reduction hypotheses
  }
);
```

### Test Execution

```javascript
import { executeTestSuite, generateExecutionReport } from './satel';

const results = await executeTestSuite(testSuite, petriNet, simulator);
console.log(results.passed, results.failed);

// Human-readable report
const report = generateExecutionReport(results);
console.log(report);
```

### Oracle Validation

```javascript
import { generateOracle, validateOracle, generateHMLFormula } from './satel';

// Generate oracle
const oracle = generateOracle(testIntention, trace, finalMarking, petriNet);

// Validate
const validation = validateOracle(actualMarking, oracle, petriNet);
console.log(validation.passed, validation.errors);

// Generate HML formula
const formula = generateHMLFormula(pathPattern, true);
console.log(formula);  // "<insertCoin(2)><selectDrink(water)> => true"
```

## Thesis Mapping

| Thesis Concept (CO-OPN) | APN Implementation |
|---|---|
| Methods (inputs) | Input places + transitions |
| Gates (outputs) | Output places + transitions |
| Classes/Objects | Flattened to single APN |
| Synchronization (`//`) | Arc dependencies |
| BGM exhaustive test set | Reachability graph |
| Test intentions | Path patterns + constraints |
| HML formulas | Event sequences + oracles |
| Uniformity hypothesis | Domain representatives |
| Regularity hypothesis | Boundary cases |
| Axiom-based equivalence | Structural equivalence |

## Examples Included

### 1. Drink Vending Machine (Thesis Chapter 1)
- **8 places**, **7 transitions**, **26 arcs**
- **6 test intentions** (positive, negative, errors)
- Demonstrates uniformity and regularity reduction

### 2. Banking Server
- **7 places**, **8 transitions**, **~25 arcs**
- **5 test intentions** (login, deposit, withdraw, complete session)
- Demonstrates axiom-based reduction

## What's NOT Implemented

- ❌ Full CO-OPN class/context hierarchy (adapted to flat APNs)
- ❌ CoopnBuilder integration (original thesis tool)
- ❌ BGM decomposition in full generality (thesis notes unfinished)
- ⏸️ Advanced path patterns (choice/parallel/loop have basic structure)

## Requirements

- Node.js 18+ (ES modules)
- Algebraic Petri Net simulator (compatible with interface)
- Z3 solver (optional, for complex guards)

## Installation

```bash
npm install satel-apn
# or
git clone https://github.com/levilucio/satel-apn.git
cd satel-apn
npm install
npm test
```

## Related Resources

- **Live Demo**: https://levilucio.github.io/Browser-Petri-Net-Editor/satel-demo.html
- **Source Repository**: https://github.com/levilucio/Browser-Petri-Net-Editor (see `petri-net-app/src/satel/`)
- **Pull Request**: https://github.com/levilucio/Browser-Petri-Net-Editor/pull/2
- **Design Document**: [SATEL_DESIGN.md](https://github.com/levilucio/Browser-Petri-Net-Editor/blob/cursor/satel-apn-testing-eaea/SATEL_DESIGN.md)

## References

1. **Levi Pedro Silva Lucio (2009)**. "SATEL — A Test Intention Language for Object-Oriented Specifications of Reactive Systems". PhD Thesis, University of Geneva. [DOI: 10.13097/archive-ouverte/unige:2498](https://archive-ouverte.unige.ch/unige:2498)

2. **Bernot, Gaudel, Marre (1991)**. "Software Testing Based on Formal Specifications". BGM Theory.

3. **Hennessy, Milner (1985)**. "Algebraic laws for nondeterminism and concurrency". HML Logic.

## Citation

```bibtex
@phdthesis{lucio2009satel,
  title={SATEL—A Test Intention Language for Object-Oriented Specifications of Reactive Systems},
  author={Silva L{\'u}cio, Levi Pedro},
  year={2009},
  school={Universit{\'e} de Gen{\`e}ve}
}
```

## License

MIT License - see [LICENSE](LICENSE) file

## Author

**Original Thesis**: Levi Pedro Silva Lucio (2009)  
**APN Implementation**: Adapted from thesis concepts (2026)

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

- Issues: https://github.com/levilucio/satel-apn/issues
- Documentation: See `docs/` directory
- Examples: See `satel/examples/`

---

**Note**: This is a research prototype implementing PhD thesis concepts. The implementation is solid and fully tested (34 tests passing), but focused on algebraic Petri nets rather than full CO-OPN object-oriented specifications.
