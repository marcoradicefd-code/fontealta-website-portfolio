// screenshot di controllo a 1920×1080: stile matita, 3D, fiera, telefono
const { chromium } = require('@playwright/test');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const shot = async (name, url, style, vp = { width: 1920, height: 1080 }, keys = [], wait = 2500) => {
    const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1 });
    await ctx.addInitScript(s => { try { localStorage.setItem('fa-stile', s) } catch (e) {} }, style);
    const p = await ctx.newPage();
    await p.goto(url); await p.evaluate(() => document.fonts.ready);
    for (const k of keys) { await p.keyboard.press(k); await p.waitForTimeout(300); }
    await p.waitForTimeout(wait);
    await p.screenshot({ path: `${OUT}/${name}.png` });
    await ctx.close();
  };
  const U = 'http://localhost:8765/come-nasce-una-colonna.html';
  await shot('1-matita-tavola', U, 'matita');
  await shot('2-3d-tavola', U, '3d');
  await shot('3-matita-reparto6', U, 'matita', undefined, ['6', 'Space'], 3500);
  await shot('4-3d-reparto3', U, '3d', undefined, ['3', 'Space'], 3500);
  await shot('5-fiera', U + '?kiosk=1', 'matita', undefined, [], 3000);
  await shot('6-telefono', U, 'matita', { width: 390, height: 844 }, [], 2500);
  await b.close();
})();
