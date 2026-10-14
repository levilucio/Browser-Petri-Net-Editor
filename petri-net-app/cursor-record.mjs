import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

async function recordWithCursor() {
  console.log('=== SLOW SMOOTH RECORDING WITH VISIBLE CURSOR ===\n');
  
  // Start X11 recording with cursor
  const ffmpegArgs = [
    '-f', 'x11grab',
    '-draw_mouse', '1',
    '-framerate', '25',
    '-video_size', '1920x1080',
    '-i', ':1',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-pix_fmt', 'yuv420p',
    '-y',
    '/workspace/docs/assets/satel-recording.mp4'
  ];
  
  console.log('Starting ffmpeg X11 capture with cursor...');
  const ffmpeg = spawn('ffmpeg', ffmpegArgs);
  await sleep(2000); // Let ffmpeg start
  console.log('✓ Recording started\n');
  
  const browser = await chromium.launch({
    headless: false,
    slowMo: 600, // Very slow for smooth viewing
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1920,1080',
      '--window-position=0,0'
    ]
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  
  const page = await context.newPage();
  
  // Smooth cursor movement helper
  const smoothMove = async (x, y) => {
    await page.mouse.move(x, y, { steps: 20 });
    await sleep(400);
  };
  
  const smoothClick = async (selector, description) => {
    const element = page.locator(selector).first();
    await element.waitFor({ state: 'visible', timeout: 10000 });
    const box = await element.boundingBox();
    if (box) {
      const targetX = box.x + box.width / 2;
      const targetY = box.y + box.height / 2;
      await page.mouse.move(targetX, targetY, { steps: 30 });
      await sleep(600);
      await page.mouse.click(targetX, targetY);
      console.log(`  ✓ Clicked: ${description}`);
      await sleep(800);
    }
  };
  
  try {
    console.log('Loading app...');
    await page.goto('http://localhost:3000?satel-demo=true', { waitUntil: 'networkidle', timeout: 60000 });
    await sleep(2000);
    await smoothMove(960, 540);
    await sleep(1500);
    console.log('✓ App loaded\n');
    
    console.log('Opening Examples...');
    await smoothClick('button:has-text("Examples")', 'Examples menu');
    await sleep(1500);
    
    console.log('Selecting Manufacturing Workflow...');
    await smoothClick('button:has-text("Manufacturing Workflow")', 'Manufacturing Workflow');
    await sleep(3000);
    console.log('✓ Manufacturing loaded\n');
    
    const closeBtn = page.locator('button:has-text("Close")').first();
    if (await closeBtn.isVisible({ timeout: 500 })) {
      await smoothClick('button:has-text("Close")', 'Close dialog');
      await sleep(1000);
    }
    
    console.log('Opening SATEL panel...');
    await smoothClick('[data-testid="toolbar-satel"]', 'SATEL button');
    await sleep(2500);
    console.log('✓ SATEL opened\n');
    
    console.log('Viewing Test Intentions...');
    await smoothClick('button:has-text("Test Intentions")', 'Test Intentions tab');
    await sleep(1500);
    
    // Linger on intentions list to show contents
    console.log('Showing intentions list...');
    await smoothMove(1600, 350);
    await sleep(2000);
    await smoothMove(1600, 450);
    await sleep(2500);
    console.log('✓ Intentions visible (15 loaded)\n');
    
    console.log('Generating test suite...');
    await smoothClick('button:has-text("Generate Test Suite")', 'Generate button');
    await sleep(1500);
    
    console.log('Waiting for generation...');
    await smoothMove(1600, 500);
    await sleep(6000);
    console.log('✓ Generation completed\n');
    
    await sleep(1500);
    
    console.log('Switching to Intentions...');
    await smoothClick('button:has-text("Test Intentions")', 'Intentions tab');
    await sleep(1800);
    
    console.log('Executing tests...');
    await smoothClick('button:has-text("Execute Tests")', 'Execute button');
    await sleep(1500);
    
    console.log('Waiting for execution...');
    await smoothMove(1600, 600);
    await sleep(5000);
    console.log('✓ Tests executed\n');
    
    await sleep(1500);
    
    console.log('Viewing Results...');
    await smoothClick('button:has-text("Results")', 'Results tab');
    await sleep(2000);
    
    // Show results clearly
    console.log('Displaying test results...');
    await smoothMove(1600, 400);
    await sleep(2000);
    console.log('✓ Results visible\n');
    
    console.log('Checking I/O Interface...');
    await smoothClick('button:has-text("I/O Interface")', 'I/O Interface tab');
    await sleep(2000);
    
    console.log('Back to Results...');
    await smoothClick('button:has-text("Results")', 'Results tab');
    await sleep(1800);
    
    console.log('Back to Intentions...');
    await smoothClick('button:has-text("Test Intentions")', 'Intentions tab');
    await sleep(1500);
    
    await smoothMove(960, 540);
    await sleep(1500);
    
    console.log('\n✓✓✓ RECORDING COMPLETE ✓✓✓\n');
    
  } catch (error) {
    console.error('\nERROR:', error.message);
    throw error;
  } finally {
    await context.close();
    await browser.close();
    
    // Stop ffmpeg
    console.log('Stopping recording...');
    ffmpeg.kill('SIGINT');
    await sleep(3000);
    console.log('✓ Recording saved\n');
  }
}

recordWithCursor().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
