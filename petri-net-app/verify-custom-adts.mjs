/**
 * Verification script for custom user-defined ADT constructor partitioning
 * 
 * Tests:
 * 1. ADT parser supports constructor elements
 * 2. Option ADT partitioning (None, Some)
 * 3. Result ADT partitioning (Ok, Err)
 * 4. Integration with test generation for Option example
 * 5. Integration with test generation for Result example
 * 6. Verify expected constructor classes and representatives
 */

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

console.log('Testing Custom User-Defined ADT Constructor Partitioning');
console.log('=' .repeat(70));

const results = await page.evaluate(async () => {
  const { parseADT } = await import('./src/utils/adt-parser.js');
  const { generateADTRepresentatives } = await import('./src/satel/core/PartitionGenerator.js');
  const { generateTestSuite } = await import('./src/satel/index.js');
  const { AlgebraicSimulator } = await import('./src/features/simulation/algebraic-simulator.js');
  const { optionADT } = await import('./src/satel/examples/option/adt.js');
  const { optionNet } = await import('./src/satel/examples/option/net.js');
  const { optionIntentions } = await import('./src/satel/examples/option/intentions.js');
  const { resultADT } = await import('./src/satel/examples/result/adt.js');
  const { resultNet } = await import('./src/satel/examples/result/net.js');
  const { resultIntentions } = await import('./src/satel/examples/result/intentions.js');

  const tests = [];
  
  // ===== Test 1: ADT Parser Supports Constructors =====
  console.log('\n[Test 1] ADT Parser Supports Constructors');
  
  const optionParsed = parseADT(optionADT);
  const optionType = optionParsed.types.find(t => t.name === 'Option');
  const test1Pass = optionType && 
                    optionType.constructors && 
                    optionType.constructors.length === 2 &&
                    optionType.constructors[0].name === 'None' &&
                    optionType.constructors[1].name === 'Some';
  
  tests.push({
    name: 'ADT Parser: Option constructors parsed',
    pass: test1Pass,
    details: `Found ${optionType?.constructors?.length || 0} constructors: ${optionType?.constructors?.map(c => c.name).join(', ') || 'none'}`
  });
  
  // ===== Test 2: Option ADT Partitioning =====
  console.log('\n[Test 2] Option ADT Partitioning');
  
  const mockOptionRegistry = {
    getType: (name) => name === 'Option' ? optionType : null
  };
  
  const optionReps = generateADTRepresentatives('Option', mockOptionRegistry, { maxDepth: 2 });
  const test2Pass = Array.isArray(optionReps) && 
                    optionReps.length === 2 &&
                    optionReps[0].__adt__ === true &&
                    optionReps[0].constructor === 'None' &&
                    optionReps[1].__adt__ === true &&
                    optionReps[1].constructor === 'Some';
  
  tests.push({
    name: 'Option Partitioning: None and Some(0)',
    pass: test2Pass,
    details: `Generated ${optionReps.length} representatives: ${optionReps.map(r => r.constructor).join(', ')}`
  });
  
  // ===== Test 3: Result ADT Partitioning =====
  console.log('\n[Test 3] Result ADT Partitioning');
  
  const resultParsed = parseADT(resultADT);
  const resultType = resultParsed.types.find(t => t.name === 'Result');
  
  const mockResultRegistry = {
    getType: (name) => name === 'Result' ? resultType : null
  };
  
  const resultReps = generateADTRepresentatives('Result', mockResultRegistry, { maxDepth: 2 });
  const test3Pass = Array.isArray(resultReps) && 
                    resultReps.length === 2 &&
                    resultReps[0].__adt__ === true &&
                    resultReps[0].constructor === 'Ok' &&
                    resultReps[1].__adt__ === true &&
                    resultReps[1].constructor === 'Err';
  
  tests.push({
    name: 'Result Partitioning: Ok(0) and Err("")',
    pass: test3Pass,
    details: `Generated ${resultReps.length} representatives: ${resultReps.map(r => `${r.constructor}(${JSON.stringify(r.args[0] || '')})`).join(', ')}`
  });
  
  // ===== Test 4: Option Example Integration =====
  console.log('\n[Test 4] Option Example Integration');
  
  const optionPetriNet = {
    places: optionNet.places,
    transitions: optionNet.transitions,
    arcs: optionNet.arcs,
    mode: 'algebraic'
  };
  
  const optionSimulator = new AlgebraicSimulator();
  const optionStartTime = Date.now();
  
  try {
    const optionSuite = await generateTestSuite(
      optionIntentions,
      optionPetriNet,
      optionSimulator,
      {
        maxStates: 100,
        maxDepth: 10,
        maxPathsPerIntention: 10,
        applyReduction: true,
        subuniformity: { 
          enableSubuniformity: true,
          maxDepth: 2
        },
        adtRegistry: mockOptionRegistry
      }
    );
    
    const optionElapsed = Date.now() - optionStartTime;
    const test4Pass = optionSuite.testCases.length === 2 && optionElapsed < 15000;
    
    tests.push({
      name: 'Option Example: Generate test suite',
      pass: test4Pass,
      details: `Generated ${optionSuite.testCases.length} cases in ${optionElapsed}ms (expected 2 cases, one per constructor)`
    });
  } catch (err) {
    tests.push({
      name: 'Option Example: Generate test suite',
      pass: false,
      details: `Error: ${err.message}`
    });
  }
  
  // ===== Test 5: Result Example Integration =====
  console.log('\n[Test 5] Result Example Integration');
  
  const resultPetriNet = {
    places: resultNet.places,
    transitions: resultNet.transitions,
    arcs: resultNet.arcs,
    mode: 'algebraic'
  };
  
  const resultSimulator = new AlgebraicSimulator();
  const resultStartTime = Date.now();
  
  try {
    const resultSuite = await generateTestSuite(
      resultIntentions,
      resultPetriNet,
      resultSimulator,
      {
        maxStates: 100,
        maxDepth: 10,
        maxPathsPerIntention: 10,
        applyReduction: true,
        subuniformity: { 
          enableSubuniformity: true,
          maxDepth: 2
        },
        adtRegistry: mockResultRegistry
      }
    );
    
    const resultElapsed = Date.now() - resultStartTime;
    const test5Pass = resultSuite.testCases.length === 2 && resultElapsed < 15000;
    
    tests.push({
      name: 'Result Example: Generate test suite',
      pass: test5Pass,
      details: `Generated ${resultSuite.testCases.length} cases in ${resultElapsed}ms (expected 2 cases, one per constructor)`
    });
  } catch (err) {
    tests.push({
      name: 'Result Example: Generate test suite',
      pass: false,
      details: `Error: ${err.message}`
    });
  }
  
  // ===== Test 6: Verify Constructor Classes =====
  console.log('\n[Test 6] Verify Constructor Classes');
  
  const optionNoneRep = optionReps.find(r => r.constructor === 'None');
  const optionSomeRep = optionReps.find(r => r.constructor === 'Some');
  
  const test6Pass = optionNoneRep && 
                    optionNoneRep.args.length === 0 &&
                    optionSomeRep &&
                    optionSomeRep.args.length === 1 &&
                    optionSomeRep.args[0] === 0; // Default value
  
  tests.push({
    name: 'Option Constructor Classes: None (arity 0), Some (arity 1, arg=0)',
    pass: test6Pass,
    details: `None args: ${optionNoneRep?.args?.length || 'N/A'}, Some args: [${optionSomeRep?.args?.join(', ') || 'N/A'}]`
  });
  
  // ===== Test 7: Verify Result Constructor Args =====
  console.log('\n[Test 7] Verify Result Constructor Args');
  
  const resultOkRep = resultReps.find(r => r.constructor === 'Ok');
  const resultErrRep = resultReps.find(r => r.constructor === 'Err');
  
  const test7Pass = resultOkRep &&
                    resultOkRep.args.length === 1 &&
                    resultOkRep.args[0] === 0 && // Default for Any → Int
                    resultErrRep &&
                    resultErrRep.args.length === 1 &&
                    resultErrRep.args[0] === ''; // Default for String
  
  tests.push({
    name: 'Result Constructor Args: Ok(0), Err("")',
    pass: test7Pass,
    details: `Ok args: [${resultOkRep?.args?.join(', ') || 'N/A'}], Err args: ["${resultErrRep?.args?.[0] || 'N/A'}"]`
  });
  
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
  console.log('\n🎉 Custom user-defined ADT constructor partitioning verified!');
}

await browser.close();
