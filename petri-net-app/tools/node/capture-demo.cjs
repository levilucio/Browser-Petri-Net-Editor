const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outDir = path.resolve(process.cwd(), 'artifacts');
fs.mkdirSync(outDir, { recursive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    recordVideo: { dir: outDir, size: { width: 1600, height: 1000 } }
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(1000);

  await page.screenshot({ path: path.join(outDir, '01-homepage.png'), fullPage: true });

  await page.getByTestId('toolbar-place').click();
  await sleep(300);
  await page.mouse.click(220, 220);
  await sleep(500);
  await page.screenshot({ path: path.join(outDir, '02-place.png'), fullPage: true });

  await page.getByTestId('toolbar-transition').click();
  await sleep(300);
  await page.mouse.click(360, 220);
  await sleep(500);

  await page.getByTestId('toolbar-arc').click();
  await sleep(300);
  await page.mouse.click(220, 220);
  await sleep(300);
  await page.mouse.click(360, 220);
  await sleep(800);
  await page.screenshot({ path: path.join(outDir, '03-simple-net.png'), fullPage: true });

  await page.getByRole('button', { name: 'Run' }).click();
  await sleep(1200);
  await page.screenshot({ path: path.join(outDir, '04-run-ui.png'), fullPage: true });

  const video = page.video();
  await context.close();
  if (video) {
    const finalPath = path.join(outDir, 'demo.webm');
    await video.saveAs(finalPath);
  }
  await browser.close();
})();
