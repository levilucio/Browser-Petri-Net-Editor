# SATEL Demo Video Scripts

**Note**: Actual video recordings cannot be created in the cloud agent environment due to lack of GUI/browser recording capabilities. These scripts describe exactly what would be shown in professional demo videos. Levi can record these himself or use these as documentation.

---

## Video 1: SATEL Overview & Live Demo (2-3 minutes)

### Script

**[0:00-0:15] Opening**
- Screen shows: https://levilucio.github.io/Browser-Petri-Net-Editor/satel-demo.html
- Title card appears: "SATEL for Algebraic Petri Nets"
- Subtitle: "Semi-Automatic Testing Language - Based on Levi Lucio's PhD Thesis (2009)"

**[0:15-0:45] What is SATEL?**
- Scroll to "What is SATEL?" section
- Highlight the 4 feature boxes:
  - Test Intentions
  - Test Generation
  - Oracles
  - Reduction
- Voice-over: "SATEL allows you to specify test intentions - high-level descriptions of behavior to test - and automatically generates concrete test cases with oracles."

**[0:45-1:30] Drink Vending Machine Example**
- Scroll to example section
- Show system description:
  - "Accepts coins (input)"
  - "Dispenses drinks (output)"
  - "Returns change or shows errors (output)"
- Highlight the test intention JSON:
  ```javascript
  {
    "id": "buy-water-exact",
    "pathPattern": { "type": "sequence", "events": [...] },
    "reductionHypothesis": { "type": "uniformity", ... }
  }
  ```
- Show generated HML formula:
  `<insertCoin(2)><selectDrink(water)><dispenseWater> => true`

**[1:30-2:15] Reduction Hypotheses**
- Scroll to "Reduction Hypotheses" section
- Show three examples:
  1. **Uniformity**: "All drinks behave identically → test only 'water'"
  2. **Regularity**: "Test loop boundaries: 0, 1, 2, many iterations"
  3. **Axiom-Based**: "Same structure → test one per equivalence class"

**[2:15-2:45] Implementation & Testing**
- Scroll to implementation section
- Highlight: "34 tests passing ✅"
- Show components list
- Show links to:
  - 📂 View Source Code
  - 📖 Read Documentation  
  - 🔀 View Pull Request

**[2:45-3:00] Closing**
- Scroll to thesis reference
- Show: "Levi Pedro Silva Lucio (2009) - University of Geneva"
- Final screen: Links to GitHub repo and documentation
- Fade out

---

## Video 2: I/O Marking for APNs (1-2 minutes)

### Script

**[0:00-0:15] Setup**
- Open Node.js REPL or browser console
- Import SATEL modules:
  ```javascript
  import { markIOType, extractInterface } from './satel';
  import { drinkVendingNet } from './satel/examples/drinkVending/net';
  ```

**[0:15-0:45] Show Example Net**
- Display drinkVendingNet structure:
  ```javascript
  console.log(drinkVendingNet.places.map(p => ({
    id: p.id,
    label: p.label,
    io_type: p.io_type
  })));
  ```
- Highlight input places:
  - `coinSlot` (io_type: 'input')
  - `selection` (io_type: 'input')
- Highlight output places:
  - `dispensed` (io_type: 'output')
  - `change` (io_type: 'output')
  - `errorMsg` (io_type: 'output')

**[0:45-1:15] Programmatic Marking**
- Create a new place and mark it:
  ```javascript
  let newPlace = { id: 'p1', label: 'User Input' };
  newPlace = markIOType(newPlace, 'input', 'Accepts user commands');
  console.log(newPlace);
  // Output: { id: 'p1', label: 'User Input', io_type: 'input', io_description: '...' }
  ```

**[1:15-1:45] Interface Extraction**
- Extract and validate interface:
  ```javascript
  const iface = extractInterface(drinkVendingNet);
  console.log('Input places:', iface.inputPlaces.length);
  console.log('Output places:', iface.outputPlaces.length);
  console.log('Input transitions:', iface.inputTransitions.length);
  console.log('Output transitions:', iface.outputTransitions.length);
  
  const validation = validateInterface(drinkVendingNet);
  console.log('Valid:', validation.valid);
  console.log('Warnings:', validation.warnings);
  ```

**[1:45-2:00] Closing**
- Summarize:
  - "I/O marking separates stimulations (inputs) from observations (outputs)"
  - "Essential for reactive system testing"
- Show documentation link

---

## Video 3: Test Generation & Execution (2-3 minutes)

### Script

**[0:00-0:20] Setup**
- Open Node.js REPL or browser console
- Import modules:
  ```javascript
  import { AlgebraicSimulator } from './features/simulation/algebraic-simulator';
  import { generateTestSuite, executeTestSuite } from './satel';
  import { drinkVendingNet } from './satel/examples/drinkVending/net';
  import { drinkVendingIntentions } from './satel/examples/drinkVending/intentions';
  ```

**[0:20-0:50] Show Test Intentions**
- Display intentions:
  ```javascript
  console.log('Test Intentions:', drinkVendingIntentions.length);
  
  // Show one intention in detail
  const intention = drinkVendingIntentions[0];
  console.log(JSON.stringify(intention, null, 2));
  ```
- Highlight key parts:
  - `pathPattern`: Event sequence
  - `inputConstraints`: Initial inputs
  - `outputExpectations`: Expected results
  - `reductionHypothesis`: Reduction strategy
  - `oracleType`: 'positive' or 'negative'

**[0:50-1:30] Generate Test Suite**
- Run test generation:
  ```javascript
  const simulator = new AlgebraicSimulator();
  
  const testSuite = await generateTestSuite(
    drinkVendingIntentions,
    drinkVendingNet,
    simulator,
    {
      maxStates: 100,
      maxDepth: 20,
      applyReduction: true
    }
  );
  
  console.log('Generated test cases:', testSuite.testCases.length);
  console.log('Statistics:', testSuite.statistics);
  ```
- Show output:
  ```
  Generated test cases: 6
  Statistics: {
    intentionsProcessed: 6,
    casesGenerated: 12,
    casesAfterReduction: 6,
    generationTime: 450
  }
  ```

**[1:30-2:00] Inspect Test Cases**
- Show a generated test case:
  ```javascript
  const testCase = testSuite.testCases[0];
  console.log('Test ID:', testCase.id);
  console.log('Intention:', testCase.intentionId);
  console.log('Initial marking:', testCase.initialMarking);
  console.log('Expected trace:', testCase.expectedTrace);
  console.log('Oracle:', testCase.oracle);
  ```
- Highlight HML formula:
  ```javascript
  import { generateHMLFormula } from './satel';
  const formula = generateHMLFormula(intention.pathPattern);
  console.log('HML:', formula);
  // Output: <insertCoin(2)><selectDrink(water)><dispenseWater> => true
  ```

**[2:00-2:40] Execute Tests**
- Run test execution:
  ```javascript
  const results = await executeTestSuite(testSuite, drinkVendingNet, simulator);
  
  console.log('Total tests:', results.totalTests);
  console.log('Passed:', results.passed);
  console.log('Failed:', results.failed);
  console.log('Errors:', results.errors);
  console.log('Execution time:', results.executionTime + 'ms');
  ```
- Show a passing test:
  ```javascript
  const passedTest = results.testResults.find(r => r.passed);
  console.log('Passed test:', passedTest.testCaseName);
  console.log('Actual trace:', passedTest.actualTrace);
  console.log('Actual outputs:', passedTest.actualOutputs);
  ```

**[2:40-3:00] Generate Report**
- Generate human-readable report:
  ```javascript
  import { generateExecutionReport } from './satel';
  const report = generateExecutionReport(results);
  console.log(report);
  ```
- Show report output:
  ```
  ============================================================
  Test Suite: Generated Test Suite
  ============================================================
  
  Total Tests: 6
  Passed: 5 (83%)
  Failed: 1
  Errors: 0
  Execution Time: 523ms
  
  ...
  ```

**[3:00] Closing**
- Summarize workflow:
  1. Define test intentions
  2. Generate test cases (with reduction)
  3. Execute tests
  4. Validate oracles
- Show documentation link

---

## Alternative: Recording Instructions for Levi

If Levi wants to record these videos himself:

### Equipment Needed
- Screen recording software (OBS Studio, ScreenFlow, Loom, etc.)
- Microphone (optional, for voice-over)
- Browser with demo page open
- Node.js REPL or browser console for code demonstrations

### Steps
1. **Video 1**: Navigate through https://levilucio.github.io/Browser-Petri-Net-Editor/satel-demo.html and highlight sections as described
2. **Video 2**: Use browser console with SATEL module imports (may need to build/serve locally or use browser-compatible bundle)
3. **Video 3**: Same as Video 2, demonstrating full workflow

### Tips
- Keep videos short (1-3 minutes each)
- Use cursor highlighting to draw attention
- Add text overlays for key points
- Export at 1080p minimum
- Host on YouTube (unlisted) or GitHub Releases

---

## Static Alternative: Animated GIFs

If videos are not feasible, create animated GIFs showing:
1. Scrolling through demo page
2. Console commands running
3. Test results appearing

Tools: LICEcap, GIPHY Capture, or convert videos to GIF.
