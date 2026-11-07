const { chromium } = require('@playwright/test');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await p.goto('http://localhost:8765/come-nasce-una-colonna.html?video=1'); await p.evaluate(() => document.fonts.ready); await p.waitForFunction(() => window.__video);
  for (let i = 0; i < 180 * 30; i++) await p.evaluate(() => window.__video.step(1 / 30));
  await p.screenshot({ path: process.argv[2] }); await b.close(); })();
