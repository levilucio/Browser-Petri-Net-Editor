/**
 * Verification script for semantic subuniformity implementation
 * 
 * Tests:
 * 1. Guard analysis extracts conditions correctly
 * 2. Partition generation produces representatives
 * 3. Representatives satisfy/violate guards as expected
 * 4. Integration with state space exploration works
 * 5. No regression on manufacturing timings
 */

import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

console.log('Testing Semantic Subuniformity Implementation');
console.log('=' .repeat(70));

const results = await page.evaluate(async () => {
  const { analyzeGuard, extractConstants } = await import('./src/satel/core/GuardAnalyzer.js');
  const { generatePartitions, generateRepresentatives, areEquivalent } = 
    await import('./src/satel/core/PartitionGenerator.js');
  const { computeSubuniformTransitions } = await import('./src/satel/core/Subuniformity.js');
  const { generateTestSuite } = await import('./src/satel/index.js');
  const { AlgebraicSimulator } = await import('./src/features/simulation/algebraic-simulator.js');
  const { manufacturingNet } = await import('./src/satel/examples/manufacturing/net.js');
  const { manufacturingIntentions } = await import('./src/satel/examples/manufacturing/intentions.js');
  const { parseArithmetic, parseBooleanExpr, parsePredicate } = 
    await import('./src/utils/z3-arith.js');

  const tests = [];
  
  // ===== Test 1: Guard Analysis =====
  console.log('\n[Test 1] Guard Analysis');
  
  // Test simple inequality
  const guardAst1 = parseArithmetic('x > 0');
  const conditions1 = analyzeGuard(guardAst1, [], new Map());
  const test1Pass = conditions1.variables.has('x') && 
                    conditions1.variables.get('x').some(c => c.op === '>' && c.value === 0);
  
  tests.push({
    name: 'Guard Analysis: x > 0',
    pass: test1Pass,
    details: `Found ${conditions1.variables.size} variable(s), x constraints: ${conditions1.variables.get('x')?.length || 0}`
  });
  
  // Test conjunction
  const guardAst2 = parseBooleanExpr('x > 0 && x < 10');
  const conditions2 = analyzeGuard(guardAst2, [], new Map());
  const constants2 = extractConstants(conditions2);
  const test2Pass = constants2.includes(0) && constants2.includes(10);
  
  tests.push({
    name: 'Guard Analysis: x > 0 && x < 10',
    pass: test2Pass,
    details: `Extracted constants: [${constants2.join(', ')}]`
  });
  
  // ===== Test 2: Partition Generation =====
  console.log('\n[Test 2] Partition Generation');
  
  const partitions1 = generatePartitions(conditions2, { maxRepresentatives: 10 });
  const xReps = partitions1.get('x') || [];
  const test3Pass = xReps.length >= 3 && xReps.includes(0) && xReps.includes(10);
  
  tests.push({
    name: 'Partition Generation: Boundary values',
    pass: test3Pass,
    details: `Generated ${xReps.length} representatives: [${xReps.join(', ')}]`
  });
  
  // Test unbounded variable
  const conditions3 = { variables: new Map([['y', []]]), unbounded: ['y'] };
  const partitions3 = generatePartitions(conditions3);
  const yReps = partitions3.get('y') || [];
  const test4Pass = yReps.length >= 1;
  
  tests.push({
    name: 'Partition Generation: Unbounded variable',
    pass: test4Pass,
    details: `Generated ${yReps.length} representative(s): [${yReps.join(', ')}]`
  });
  
  // ===== Test 3: Equivalence Classes =====
  console.log('\n[Test 3] Equivalence Classes');
  
  const constraints = conditions2.variables.get('x') || [];
  const equiv1 = areEquivalent(5, 7, constraints); // Both in (0, 10)
  const equiv2 = areEquivalent(5, -1, constraints); // Different classes
  const test5Pass = equiv1 === true && equiv2 === false;
  
  tests.push({
    name: 'Equivalence: 5 ~ 7 in (0,10), 5 ≁ -1',
    pass: test5Pass,
    details: `5~7: ${equiv1}, 5~-1: ${equiv2}`
  });
  
  // ===== Test 4: Integration with State Space =====
  console.log('\n[Test 4] Integration Test');
  
  const petriNet = {
    places: manufacturingNet.places,
    transitions: manufacturingNet.transitions,
    arcs: manufacturingNet.arcs,
    mode: 'algebraic'
  };
  
  const simulator = new AlgebraicSimulator();
  await simulator.initialize(petriNet);
  
  // Test computeSubuniformTransitions for receiveOrder
  const transitionId = 'receiveOrder';
  const subuniform = await computeSubuniformTransitions({
    transitionId,
    petriNet,
    simulator,
    cache: simulator.cache,
    options: { enableSubuniformity: true }
  });
  
  const test6Pass = subuniform.length >= 1 && subuniform[0].binding;
  
  tests.push({
    name: 'Subuniformity: receiveOrder',
    pass: test6Pass,
    details: `Found ${subuniform.length} representative binding(s)`
  });
  
  // ===== Test 5: Full Generation Performance =====
  console.log('\n[Test 5] Performance Test');
  
  const startTime = Date.now();
  const suite = await generateTestSuite(
    manufacturingIntentions.slice(0, 5), // First 5 intentions
    petriNet,
    simulator,
    {
      maxStates: 300,
      maxDepth: 25,
      maxPathsPerIntention: 15,
      applyReduction: true,
      subuniformity: { enableSubuniformity: true }
    }
  );
  const elapsed = Date.now() - startTime;
  
  const test7Pass = elapsed < 20000 && suite.testCases.length >= 5;
  
  tests.push({
    name: 'Performance: 5 intentions < 20s',
    pass: test7Pass,
    details: `Generated ${suite.testCases.length} cases in ${elapsed}ms`
  });
  
  // ===== Test 6: Verify Test Cases Have Bindings =====
  console.log('\n[Test 6] Test Case Bindings');
  
  const hasBindings = suite.testCases.every(tc => tc.expectedTrace && tc.expectedTrace.length > 0);
  const test8Pass = hasBindings;
  
  tests.push({
    name: 'All test cases have non-empty traces',
    pass: test8Pass,
    details: `${suite.testCases.length} cases, all with traces: ${hasBindings}`
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
}

await browser.close();
