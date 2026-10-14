import { generateTestSuite } from './src/satel/core/TestGenerator.js';
import { AlgebraicSimulator } from './src/features/simulation/algebraic-simulator.js';
import { manufacturingNet } from './src/satel/examples/manufacturing/net.js';
import { manufacturingIntentionsV2 } from './src/satel/examples/manufacturing/intentions-v2.js';

const simulator = new AlgebraicSimulator();
const petriNet = {
  places: manufacturingNet.places,
  transitions: manufacturingNet.transitions,
  arcs: manufacturingNet.arcs,
  mode: 'algebraic',
  adtDefinitions: manufacturingNet.adtDefinitions
};

console.log('Measuring Manufacturing V2 intentions...\n');
const result = await generateTestSuite(
  manufacturingIntentionsV2,
  petriNet,
  simulator,
  { disableGraphCaching: true, applyReduction: false, variableDepth: 2 }
);

console.log(`Total test cases: ${result.testCases.length}`);
console.log(`States explored: ${result.statistics.statesExplored}\n`);

const pathLengths = result.testCases.map(tc => tc.expectedTrace?.length || 0);
console.log(`Path lengths: [${pathLengths.join(', ')}]`);
console.log(`Average: ${(pathLengths.reduce((a,b)=>a+b,0)/pathLengths.length).toFixed(2)}`);
console.log(`Tests with >= 3 transitions: ${pathLengths.filter(l=>l>=3).length}/${pathLengths.length}`);

console.log('\nPer-test details:');
result.testCases.forEach((tc, i) => {
  const path = tc.expectedTrace?.length || 0;
  const vars = Object.keys(tc.instantiation || {}).length > 0 
    ? JSON.stringify(tc.instantiation) : '';
  console.log(`${i+1}. Path: ${path} transitions ${vars}`);
});
