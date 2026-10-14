/**
 * Performance measurement harness for SATEL test generation
 * Loads Manufacturing net + default intentions, runs generation, reports timing
 */

import { generateTestSuite } from './src/satel/index.js';
import { AlgebraicSimulator } from './src/features/simulation/algebraic-simulator.js';
import { manufacturingNet } from './src/satel/examples/manufacturing/net.js';
import { manufacturingIntentions } from './src/satel/examples/manufacturing/intentions.js';

async function measureGeneration() {
  console.log('='.repeat(70));
  console.log('SATEL Manufacturing Test Generation - Performance Measurement');
  console.log('='.repeat(70));
  console.log();
  
  // Prepare net and simulator (same as SatelPanel)
  const petriNet = {
    places: manufacturingNet.places,
    transitions: manufacturingNet.transitions,
    arcs: manufacturingNet.arcs,
    mode: 'algebraic'
  };
  
  const simulator = new AlgebraicSimulator();
  
  // Use same limits as SatelPanel (from optimized version)
  const limits = {
    maxStates: 300,
    maxDepth: 25,
    maxPathsPerIntention: 15,
    applyReduction: true,
    timeout: 90000
  };
  
  console.log('Configuration:');
  console.log(`  Petri Net: ${petriNet.places.length} places, ${petriNet.transitions.length} transitions`);
  console.log(`  Test Intentions: ${manufacturingIntentions.length}`);
  console.log(`  Limits: maxStates=${limits.maxStates}, maxDepth=${limits.maxDepth}, maxPaths=${limits.maxPathsPerIntention}`);
  console.log();
  
  // Progress tracking
  let lastProgress = '';
  const progressCallback = (progress) => {
    const msg = `  [${progress.current}/${progress.total}] ${progress.message}`;
    if (msg !== lastProgress) {
      process.stdout.write('\r' + ' '.repeat(100) + '\r'); // Clear line
      process.stdout.write(msg);
      lastProgress = msg;
    }
  };
  
  console.log('Running test generation...');
  console.log();
  
  // Measure wall-clock time
  const startTime = performance.now();
  const startDate = new Date();
  
  let suite;
  let completed = false;
  let error = null;
  
  try {
    suite = await generateTestSuite(
      manufacturingIntentions,
      petriNet,
      simulator,
      {
        ...limits,
        onProgress: progressCallback
      }
    );
    completed = true;
  } catch (err) {
    error = err;
    console.error('\nError during generation:', err.message);
  }
  
  const endTime = performance.now();
  const endDate = new Date();
  const durationMs = Math.round(endTime - startTime);
  
  // Clear progress line
  process.stdout.write('\r' + ' '.repeat(100) + '\r');
  
  console.log();
  console.log('='.repeat(70));
  console.log('RESULTS');
  console.log('='.repeat(70));
  console.log();
  
  if (completed) {
    console.log('✅ Generation completed successfully');
    console.log();
    console.log('Performance:');
    console.log(`  Wall-clock duration: ${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)`);
    console.log(`  Start: ${startDate.toISOString()}`);
    console.log(`  End:   ${endDate.toISOString()}`);
    console.log();
    console.log('Output:');
    console.log(`  Test intentions processed: ${suite.statistics?.intentionsProcessed || 0}/${manufacturingIntentions.length}`);
    console.log(`  Test cases generated: ${suite.testCases?.length || 0}`);
    console.log(`  Cases after reduction: ${suite.statistics?.casesAfterReduction || 0}`);
    console.log();
    
    // Per-intention average
    const avgPerIntention = durationMs / (suite.statistics?.intentionsProcessed || 1);
    console.log(`  Average per intention: ${Math.round(avgPerIntention)}ms`);
    console.log();
    
    // Interactive usability assessment
    console.log('Interactive Usability:');
    if (durationMs < 3000) {
      console.log('  ⭐ EXCELLENT - Feels instant (<3s)');
    } else if (durationMs < 7000) {
      console.log('  ✅ GOOD - Acceptable for interactive use (<7s)');
    } else if (durationMs < 15000) {
      console.log('  ⚠️  ACCEPTABLE - Noticeable wait but tolerable (<15s)');
    } else if (durationMs < 30000) {
      console.log('  ⚠️  SLOW - Long wait, needs progress indication (<30s)');
    } else {
      console.log('  ❌ TOO SLOW - Unacceptable for interactive use (>30s)');
    }
    
  } else {
    console.log('❌ Generation failed or timed out');
    if (error) {
      console.log(`  Error: ${error.message}`);
    }
  }
  
  console.log();
  console.log('='.repeat(70));
  
  return {
    completed,
    durationMs,
    intentions: manufacturingIntentions.length,
    testCases: suite?.testCases?.length || 0,
    error: error?.message
  };
}

// Run measurement
console.log('Starting measurement at', new Date().toISOString());
console.log();

measureGeneration()
  .then(result => {
    console.log();
    console.log('Measurement complete.');
    if (!result.completed) {
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
