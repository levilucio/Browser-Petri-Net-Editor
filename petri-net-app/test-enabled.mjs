import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

const result = await page.evaluate(async () => {
  const { AlgebraicSimulator } = await import('./src/features/simulation/algebraic-simulator.js');
  const { manufacturingNet } = await import('./src/satel/examples/manufacturing/net.js');
  
  const petriNet = {
    places: manufacturingNet.places,
    transitions: manufacturingNet.transitions,
    arcs: manufacturingNet.arcs,
    mode: 'algebraic'
  };
  
  const simulator = new AlgebraicSimulator();
  await simulator.initialize(petriNet);
  
  const enabled = await simulator.getEnabledTransitions();
  const receiveOrderTrans = petriNet.transitions.find(t => t.id === 'receiveOrder');
  
  return {
    enabledTransitions: enabled,
    receiveOrderExists: !!receiveOrderTrans,
    receiveOrderGuard: receiveOrderTrans?.guard || 'none',
    allTransitionIds: petriNet.transitions.map(t => t.id)
  };
});

console.log('Enabled transitions at initial marking:');
console.log(`  ${result.enabledTransitions.join(', ')}`);
console.log();
console.log('receiveOrder exists:', result.receiveOrderExists);
console.log('receiveOrder guard:', result.receiveOrderGuard);
console.log();
console.log('All transitions in net:');
console.log(`  ${result.allTransitionIds.join(', ')}`);

await browser.close();
