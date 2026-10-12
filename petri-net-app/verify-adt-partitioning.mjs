/**
 * Verification script for ADT constructor partitioning
 * 
 * Tests:
 * 1. List ADT partitioning (empty vs non-empty)
 * 2. Pair ADT partitioning
 * 3. String ADT partitioning (empty vs non-empty)
 * 4. Integration with test generation
 */

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

console.log('Testing ADT Constructor Partitioning');
console.log('=' .repeat(70));

const results = await page.evaluate(async () => {
  const { generateADTRepresentatives } = await import('./src/satel/core/PartitionGenerator.js');
  const { useAdtRegistry } = await import('./src/contexts/AdtContext.jsx');
  const { generateTestSuite } = await import('./src/satel/index.js');
  const { AlgebraicSimulator } = await import('./src/features/simulation/algebraic-simulator.js');
  const { listNet } = await import('./src/satel/examples/list/net.js');
  const { listIntentions } = await import('./src/satel/examples/list/intentions.js');

  const tests = [];
  
  // Mock ADT registry for testing
  const mockAdtRegistry = {
    getType: (name) => {
      if (name === 'List') return {
        name: 'List',
        operations: [],
        constructors: null // Use built-in List shape
      };
      return null;
    }
  };
  
  // ===== Test 1: List ADT Partitioning =====
  console.log('\n[Test 1] List ADT Partitioning');
  
  const listReps = generateADTRepresentatives('List', mockAdtRegistry, { maxDepth: 2 });
  const test1Pass = Array.isArray(listReps) && 
                    listReps.length === 2 &&
                    Array.isArray(listReps[0]) && listReps[0].length === 0 && // []
                    Array.isArray(listReps[1]) && listReps[1].length === 1;    // [0]
  
  tests.push({
    name: 'List Partitioning: [] and [0]',
    pass: test1Pass,
    details: `Generated ${listReps.length} representatives: empty=${JSON.stringify(listReps[0])}, non-empty=${JSON.stringify(listReps[1])}`
  });
  
  // ===== Test 2: Pair ADT Partitioning =====
  console.log('\n[Test 2] Pair ADT Partitioning');
  
  const pairReps = generateADTRepresentatives('Pair', mockAdtRegistry, { maxDepth: 2 });
  const test2Pass = Array.isArray(pairReps) && 
                    pairReps.length === 1 &&
                    pairReps[0].__pair__ === true;
  
  tests.push({
    name: 'Pair Partitioning: (0, 0)',
    pass: test2Pass,
    details: `Generated ${pairReps.length} representative(s)`
  });
  
  // ===== Test 3: String ADT Partitioning =====
  console.log('\n[Test 3] String ADT Partitioning');
  
  const stringReps = generateADTRepresentatives('String', mockAdtRegistry, { maxDepth: 2 });
  const test3Pass = Array.isArray(stringReps) && 
                    stringReps.length === 2 &&
                    stringReps[0] === '' &&
                    stringReps[1] === 'a';
  
  tests.push({
    name: 'String Partitioning: "" and "a"',
    pass: test3Pass,
    details: `Generated ${stringReps.length} representatives: empty="${stringReps[0]}", non-empty="${stringReps[1]}"`
  });
  
  // ===== Test 4: Integration with Test Generation =====
  console.log('\n[Test 4] List Example Integration');
  
  const petriNet = {
    places: listNet.places,
    transitions: listNet.transitions,
    arcs: listNet.arcs,
    mode: 'algebraic'
  };
  
  const simulator = new AlgebraicSimulator();
  const startTime = Date.now();
  
  try {
    const suite = await generateTestSuite(
      listIntentions,
      petriNet,
      simulator,
      {
        maxStates: 100,
        maxDepth: 10,
        maxPathsPerIntention: 10,
        applyReduction: true,
        subuniformity: { 
          enableSubuniformity: true,
          maxDepth: 2
        },
        adtRegistry: mockAdtRegistry
      }
    );
    
    const elapsed = Date.now() - startTime;
    const test4Pass = suite.testCases.length >= 2 && elapsed < 15000;
    
    tests.push({
      name: 'List Example: Generate test suite',
      pass: test4Pass,
      details: `Generated ${suite.testCases.length} cases in ${elapsed}ms`
    });
  } catch (err) {
    tests.push({
      name: 'List Example: Generate test suite',
      pass: false,
      details: `Error: ${err.message}`
    });
  }
  
  // ===== Test 5: Verify Test Cases Have Correct Bindings =====
  console.log('\n[Test 5] Test Case Bindings');
  
  try {
    const suite = await generateTestSuite(
      listIntentions,
      petriNet,
      simulator,
      {
        maxStates: 100,
        maxDepth: 10,
        maxPathsPerIntention: 10,
        adtRegistry: mockAdtRegistry
      }
    );
    
    const hasExpectedTraces = suite.testCases.every(tc => 
      tc.expectedTrace && tc.expectedTrace.length > 0
    );
    
    tests.push({
      name: 'All test cases have non-empty traces',
      pass: hasExpectedTraces,
      details: `${suite.testCases.length} cases, all with traces: ${hasExpectedTraces}`
    });
  } catch (err) {
    tests.push({
      name: 'All test cases have non-empty traces',
      pass: false,
      details: `Error: ${err.message}`
    });
  }
  
  return tests;
});

// Print results
console.log('\n' + '='.repeat(70));
console.log('Test Results:');
console.log('='.repeat(70));

let passCount = 0;
let failCount = 0;

for (const test of results) {
  const status = test.pass ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status}: ${test.name}`);
  console.log(`  ${test.details}`);
  
  if (test.pass) passCount++;
  else failCount++;
}

console.log('\n' + '='.repeat(70));
console.log(`Summary: ${passCount} passed, ${failCount} failed`);
console.log('='.repeat(70));

if (failCount > 0) {
  console.error('\n❌ Some tests failed!');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
}

await browser.close();
