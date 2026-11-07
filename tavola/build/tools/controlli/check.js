// controllo completo: 12 reparti × 2 stili a 1920×1080, mouse su un reparto vicino, errori della console
const { chromium } = require('@playwright/test');
const OUT = process.argv[2], U = 'http://localhost:8765/come-nasce-una-colonna.html';
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const style of ['matita', '3d']) {
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 } });
    await ctx.addInitScript(s => { try { localStorage.setItem('fa-stile', s) } catch (e) {} }, style);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(style + ': ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(style + ' console: ' + m.text()) });
    await p.goto(U); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${style}-00-tavola.png` });
    for (let i = 0; i < 12; i++) {
      await p.locator('#idx button').nth(i).click(); await p.waitForTimeout(500);
      if ((await p.textContent('#play')).trim() === 'Pausa') await p.click('#play');
      await p.mouse.move(1650, 330); await p.waitForTimeout(3200);
      await p.screenshot({ path: `${OUT}/${style}-${String(i + 1).padStart(2, '0')}.png` });
    }
    await ctx.close();
  }
  for (const [n, vp, q] of [['fiera', { width: 1920, height: 1080 }, '?kiosk=1'], ['telefono', { width: 390, height: 844 }, ''], ['telefono-orizz', { width: 844, height: 390 }, '']]) {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); p.on('pageerror', e => errs.push(n + ': ' + e.message));
    await p.goto(U + q); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(3000); await p.screenshot({ path: `${OUT}/${n}.png` }); await ctx.close();
  }
  console.log(errs.length ? errs.join('\n') : 'console: nessun errore'); await b.close();
})();
