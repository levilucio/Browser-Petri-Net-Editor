/**
 * Regression test for Manufacturing intentions
 * Ensures all 15 intentions generate at least 1 test case
 */

import { chromium } from 'playwright';

async function testIntentionsRegression() {
  const browser = await chromium.launch({ headless: true });
  
  try {
    const page = await browser.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    const result = await page.evaluate(async () => {
      const { generateTestSuite } = await import('./src/satel/index.js');
      const { AlgebraicSimulator } = await import('./src/features/simulation/algebraic-simulator.js');
      const { manufacturingNet } = await import('./src/satel/examples/manufacturing/net.js');
      const { manufacturingIntentions } = await import('./src/satel/examples/manufacturing/intentions.js');
      
      const petriNet = {
        places: manufacturingNet.places,
        transitions: manufacturingNet.transitions,
        arcs: manufacturingNet.arcs,
        mode: 'algebraic'
      };
      
      const simulator = new AlgebraicSimulator();
      
      const suite = await generateTestSuite(manufacturingIntentions, petriNet, simulator, {
        maxStates: 300,
        maxDepth: 25,
        maxPathsPerIntention: 15,
        applyReduction: true
      });
      
      const casesPerIntention = {};
      manufacturingIntentions.forEach(i => {
        casesPerIntention[i.id] = 0;
      });
      
      suite.testCases.forEach(tc => {
        if (casesPerIntention.hasOwnProperty(tc.intentionId)) {
          casesPerIntention[tc.intentionId]++;
        }
      });
      
      return {
        totalIntentions: manufacturingIntentions.length,
        totalTestCases: suite.testCases.length,
        statesExplored: suite.statistics.statesExplored,
        casesPerIntention,
        intentionIds: manufacturingIntentions.map(i => i.id)
      };
    });
    
    // Regression assertions
    const failures = [];
    
    // Assert: All intentions should generate at least 1 test case
    result.intentionIds.forEach(id => {
      const count = result.casesPerIntention[id] || 0;
      if (count < 1) {
        failures.push(`Intention '${id}' generated ${count} test cases (expected ≥ 1)`);
      }
    });
    
    // Assert: Total test cases should be ≥ total intentions
    if (result.totalTestCases < result.totalIntentions) {
      failures.push(`Total test cases ${result.totalTestCases} < intentions ${result.totalIntentions}`);
    }
    
    // Assert: States explored should be > 0
    if (result.statesExplored === 0) {
      failures.push('States explored is 0');
    }
    
    console.log('Manufacturing Intentions - Regression Test');
    console.log('===========================================');
    console.log();
    console.log(`Total Intentions: ${result.totalIntentions}`);
    console.log(`Total Test Cases: ${result.totalTestCases}`);
    console.log(`States Explored: ${result.statesExplored}`);
    console.log(`Average Cases Per Intention: ${(result.totalTestCases / result.totalIntentions).toFixed(1)}`);
    console.log();
    
    if (failures.length === 0) {
      console.log('✅ PASS: All assertions passed');
      console.log('   - All 15 intentions generate ≥ 1 test case');
      console.log('   - States explored > 0');
      console.log('   - Total test cases ≥ total intentions');
      return true;
    } else {
      console.log('❌ FAIL: Regression detected');
      failures.forEach(f => console.log(`   - ${f}`));
      return false;
    }
    
  } finally {
    await browser.close();
  }
}

testIntentionsRegression()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
