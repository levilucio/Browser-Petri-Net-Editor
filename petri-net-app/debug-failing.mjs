import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => {
  if (msg.text().includes('No matching paths') || msg.text().includes('Extended Workflow') || msg.text().includes('Multiple Orders')) {
    console.log('Browser:', msg.text());
  }
});

await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

await page.evaluate(async () => {
  const { buildReachabilityGraph, findMatchingPaths } = await import('./src/satel/core/StateSpaceExplorer.js');
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
  const graph = await buildReachabilityGraph(petriNet, simulator, { maxStates: 300, maxDepth: 25 });
  
  // Test Multiple Orders intention
  const multipleOrders = manufacturingIntentions.find(i => i.id === 'multiple-orders');
  console.log('Testing Multiple Orders:', multipleOrders.name);
  console.log('  Pattern:', JSON.stringify(multipleOrders.pathPattern.events.map(e => e.transition)));
  const paths1 = findMatchingPaths(graph, multipleOrders.pathPattern, { maxPaths: 15 });
  console.log('  Matching paths:', paths1.length);
  
  // Test Extended Workflow
  const extended = manufacturingIntentions.find(i => i.id === 'long-workflow');
  console.log('Testing Extended Workflow:', extended.name);
  console.log('  Pattern:', JSON.stringify(extended.pathPattern.events.map(e => e.transition)));
  console.log('  Pattern length:', extended.pathPattern.events.length);
  const paths2 = findMatchingPaths(graph, extended.pathPattern, { maxPaths: 15 });
  console.log('  Matching paths:', paths2.length);
});

await browser.close();
