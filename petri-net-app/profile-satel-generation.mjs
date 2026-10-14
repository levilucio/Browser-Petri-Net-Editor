/**
 * Profile SATEL test generation to identify bottlenecks
 * Run with: node profile-satel-generation.mjs
 */

import { generateTestSuite } from './src/satel/index.js';
import { AlgebraicSimulator } from './src/features/simulation/algebraic-simulator.js';
import { manufacturingNet } from './src/satel/examples/manufacturing/net.js';
import { manufacturingIntentions } from './src/satel/examples/manufacturing/intentions.js';

// Simple performance timing utility
class Timer {
  constructor(name) {
    this.name = name;
    this.start = performance.now();
  }
  
  end() {
    const elapsed = performance.now() - this.start;
    console.log(`[PROFILE] ${this.name}: ${elapsed.toFixed(2)}ms`);
    return elapsed;
  }
}

async function profileGeneration() {
  console.log('='.repeat(60));
  console.log('SATEL Test Generation Profiling');
  console.log('='.repeat(60));
  console.log(`Manufacturing Net: ${manufacturingNet.places.length} places, ${manufacturingNet.transitions.length} transitions`);
  console.log(`Test Intentions: ${manufacturingIntentions.length}`);
  console.log('='.repeat(60));
  console.log();
  
  const petriNet = {
    places: manufacturingNet.places,
    transitions: manufacturingNet.transitions,
    arcs: manufacturingNet.arcs,
    mode: 'algebraic'
  };
  
  const simulator = new AlgebraicSimulator();
  
  // Test with current reduced limits
  console.log('Testing with CURRENT reduced limits:');
  console.log('  maxStates: 200, maxDepth: 20, maxPathsPerIntention: 10');
  console.log();
  
  const currentTimer = new Timer('Total (Current Limits)');
  
  try {
    const suite = await generateTestSuite(
      manufacturingIntentions,
      petriNet,
      simulator,
      {
        maxStates: 200,
        maxDepth: 20,
        maxPathsPerIntention: 10,
        applyReduction: true,
        profileMode: true
      }
    );
    
    const currentTime = currentTimer.end();
    
    console.log();
    console.log('Results:');
    console.log(`  Test cases generated: ${suite.testCases?.length || 0}`);
    console.log(`  Intentions processed: ${suite.statistics?.intentionsProcessed || 0}`);
    console.log(`  Total time: ${(currentTime / 1000).toFixed(2)}s`);
    console.log(`  Time per intention: ${(currentTime / manufacturingIntentions.length).toFixed(0)}ms`);
    
  } catch (error) {
    console.error('Error during profiling:', error);
  }
  
  console.log();
  console.log('='.repeat(60));
  console.log('Profiling complete. Check timing breakdown above.');
  console.log('='.repeat(60));
}

// Run profiling
profileGeneration().catch(console.error);
