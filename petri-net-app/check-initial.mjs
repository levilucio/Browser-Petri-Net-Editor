import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3002', { waitUntil: 'networkidle' });

const result = await page.evaluate(async () => {
  const { manufacturingNet } = await import('./src/satel/examples/manufacturing/net.js');
  const orderQueue = manufacturingNet.places.find(p => p.id === 'orderQueue');
  return {
    orderQueueTokens: orderQueue?.tokens || 0,
    orderQueueValue: orderQueue?.valueTokens || [],
    allPlaces: manufacturingNet.places.map(p => ({ 
      id: p.id, 
      tokens: p.tokens,
      values: p.valueTokens?.length || 0
    }))
  };
});

console.log('Initial marking:');
console.log('orderQueue:', result.orderQueueTokens, 'tokens', result.orderQueueValue);
console.log('\nAll places:');
result.allPlaces.forEach(p => {
  if (p.tokens > 0 || p.values > 0) {
    console.log(`  ${p.id}: ${p.tokens} tokens, ${p.values} values`);
  }
});

await browser.close();
