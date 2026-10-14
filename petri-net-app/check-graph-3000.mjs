import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

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
  
  const orderQueue = manufacturingNet.places.find(p => p.id === 'orderQueue');
  const simulator = new AlgebraicSimulator();
  const graph = await buildReachabilityGraph(petriNet, simulator, {
    maxStates: 50,
    maxDepth: 10
  });
  
  return {
    orderQueueTokens: orderQueue.tokens,
    orderQueueValues: orderQueue.valueTokens,
    graphStates: graph.states.length,
    graphTransitions: graph.transitions.length,
    uniqueTransitionIds: [...new Set(graph.transitions.map(t => t.transitionId))].sort(),
    sampleTransitions: graph.transitions.slice(0, 10).map(t => t.transitionId)
  };
});

console.log('Initial marking:');
console.log(`  orderQueue tokens: ${result.orderQueueTokens}`);
console.log(`  orderQueue values:`, result.orderQueueValues);
console.log();
console.log('Reachability graph:');
console.log(`  States: ${result.graphStates}`);
console.log(`  Transition firings: ${result.graphTransitions}`);
console.log();
console.log('Unique transition IDs fired:');
console.log(`  ${result.uniqueTransitionIds.join(', ')}`);
console.log();
console.log('Sample transitions fired:');
console.log(`  ${result.sampleTransitions.join(', ')}`);

await browser.close();
