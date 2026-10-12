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
  
  const simulator = new AlgebraicSimulator();
  const graph = await buildReachabilityGraph(petriNet, simulator, {
    maxStates: 300,
    maxDepth: 25
  });
  
  const transitionIds = [...new Set(graph.transitions.map(t => t.transitionId))];
  const transitionCounts = {};
  graph.transitions.forEach(t => {
    transitionCounts[t.transitionId] = (transitionCounts[t.transitionId] || 0) + 1;
  });
  
  return {
    stateCount: graph.states.length,
    transitionCount: graph.transitions.length,
    uniqueTransitions: transitionIds.sort(),
    transitionCounts,
    allNetTransitions: petriNet.transitions.map(t => t.id).sort()
  };
});

console.log('Reachability Analysis:');
console.log(`States: ${result.stateCount}`);
console.log(`Transition firings: ${result.transitionCount}`);
console.log();
console.log('Transitions that fire in graph:');
result.uniqueTransitions.forEach(t => {
  console.log(`  ${t} (${result.transitionCounts[t]} times)`);
});
console.log();
console.log('Transitions in net but never fire:');
const neverFire = result.allNetTransitions.filter(t => !result.uniqueTransitions.includes(t));
neverFire.forEach(t => console.log(`  ${t}`));

await browser.close();
