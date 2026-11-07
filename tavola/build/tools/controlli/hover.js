const { chromium } = require('@playwright/test');
(async () => { const b = await chromium.launch();
  for (const style of ['3d','matita']) {
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
  await ctx.addInitScript(s => { try { localStorage.setItem('fa-stile', s) } catch (e) {} }, style);
  const p = await ctx.newPage(); await p.goto('http://localhost:8765/come-nasce-una-colonna.html'); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
  await p.mouse.move(1000, 540); for (let k = 0; k < 6; k++) { await p.mouse.wheel(0, -300); await p.waitForTimeout(250); }
  await p.waitForTimeout(1500); await p.mouse.move(1005, 545); await p.waitForTimeout(600);
  await p.screenshot({ path: process.argv[2] + '/hover-' + style + '.png' }); await ctx.close(); }
  await b.close(); })();
