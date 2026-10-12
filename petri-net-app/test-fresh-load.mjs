import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ 
  ignoreHTTPSErrors: true
});
const page = await context.newPage();

// Add timestamp to force fresh module load
const url = `http://localhost:3000?t=${Date.now()}`;
console.log(`Loading ${url}...`);
await page.goto(url, { waitUntil: 'networkidle' });

// Force reload modules
await page.reload({ waitUntil: 'networkidle' });

const result = await page.evaluate(async () => {
  // Force module reload
  const timestamp = Date.now();
  const { AlgebraicSimulator } = await import(`./src/features/simulation/algebraic-simulator.js?t=${timestamp}`);
  const { manufacturingNet } = await import(`./src/satel/examples/manufacturing/net.js?t=${timestamp}`);
  
  const petriNet = {
    places: manufacturingNet.places,
    transitions: manufacturingNet.transitions,
    arcs: manufacturingNet.arcs,
    mode: 'algebraic'
  };
  
  const simulator = new AlgebraicSimulator();
  await simulator.initialize(petriNet);
  
  const enabled = await simulator.getEnabledTransitions();
  const receiveOrder = petriNet.transitions.find(t => t.id === 'receiveOrder');
  
  return {
    enabled,
    receiveOrderGuard: receiveOrder?.guard || 'none',
    orderQueueTokens: petriNet.places.find(p => p.id === 'orderQueue')?.tokens || 0
  };
});

console.log('Results:');
console.log(`  orderQueue tokens: ${result.orderQueueTokens}`);
console.log(`  receiveOrder guard: ${result.receiveOrderGuard}`);
console.log(`  Enabled: ${result.enabled.join(', ')}`);

await browser.close();
