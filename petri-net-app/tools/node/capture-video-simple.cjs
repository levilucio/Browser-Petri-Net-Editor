const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const outDir = path.resolve(process.cwd(), 'artifacts', 'video-run');
fs.mkdirSync(outDir, { recursive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: EDGE });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    recordVideo: { dir: outDir, size: { width: 1280, height: 800 } }
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3000/', { waitUntil: 'networkidle', timeout: 60000 });
  await sleep(1200);
  await page.getByTestId('toolbar-place').click();
  await sleep(250);
  await page.mouse.click(220, 220);
  await sleep(500);
  await page.getByTestId('toolbar-transition').click();
  await sleep(250);
  await page.mouse.click(360, 220);
  await sleep(500);
  await page.getByTestId('toolbar-arc').click();
  await sleep(250);
  await page.mouse.click(220, 220);
  await sleep(250);
  await page.mouse.click(360, 220);
  await sleep(1500);
  await context.close();
  await browser.close();
})();
