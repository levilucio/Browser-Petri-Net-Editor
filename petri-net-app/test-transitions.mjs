import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });

const result = await page.evaluate(async () => {
  const { buildReachabilityGraph } = await import('./src/satel/core/StateSpaceExplorer.js');
  const { AlgebraicSimulator } = await import('./src/features/simulation/algebraic-simulator.js');
  const { manufacturingNet } = await import('./src/satel/examples/manufacturing/net.js');
  
  const petriNet = {
    places: manufacturingNet.places,
    transitions: manufacturingNet.transitions,
    arcs: manufacturingNet.arcs,
    mode: 'algebraic'
  };
  
  const simulator = new AlgebraicSimulator();
  const graph = await buildReachabilityGraph(petriNet, simulator, {
    maxStates: 50,
    maxDepth: 10
  });
  
  return {
    stateCount: graph.states.length,
    transitionCount: graph.transitions.length,
    sampleTransitions: graph.transitions.slice(0, 10).map(t => ({
      id: t.transitionId,
      source: t.sourceStateId.substring(0, 20) + '...',
      target: t.targetStateId.substring(0, 20) + '...'
    })),
    netTransitionIds: petriNet.transitions.map(t => t.id)
  };
});

console.log('Graph exploration:');
console.log(`  States: ${result.stateCount}`);
console.log(`  Transitions fired: ${result.transitionCount}`);
console.log('\nSample graph transitions:');
result.sampleTransitions.forEach(t => {
  console.log(`  ${t.id}: ${t.source} -> ${t.target}`);
});
console.log('\nNet transition IDs:');
console.log(`  ${result.netTransitionIds.join(', ')}`);

await browser.close();
