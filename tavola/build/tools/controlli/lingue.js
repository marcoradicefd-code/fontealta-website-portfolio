// controllo visivo delle lingue: tavola, reparto 4 in pausa, menu della lingua aperto, fiera, telefono verticale e orizzontale
// uso: node controlli/lingue.js <cartella-uscita> [url-base]
const { chromium } = require('@playwright/test');
const OUT = process.argv[2], BASE = process.argv[3] || 'http://127.0.0.1:8766/come-nasce-una-colonna.html';
(async () => {
  const b = await chromium.launch(); const errs = [];
  for (const l of ['it', 'en', 'de', 'fr', 'es']) {
    const shot = async (nome, q, vp, fn) => { const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage();
      p.on('pageerror', e => errs.push(`${l} ${nome}: ${e.message}`));
      await p.goto(BASE + q); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1500);
      if (fn) await fn(p); await p.screenshot({ path: `${OUT}/${l}-${nome}.png` }); await ctx.close() };
    const D = { width: 1440, height: 900 };
    await shot('tavola', `?lang=${l}`, D, async p => { await p.click('#langbtn'); await p.waitForTimeout(400) });
    await shot('reparto4', `?lang=${l}`, D, async p => { await p.locator('#idx button').nth(3).click(); await p.waitForTimeout(400);
      if ((await p.textContent('#play')).trim() !== (await p.evaluate(() => document.querySelector('#play').textContent))) {} await p.keyboard.press('Space'); await p.waitForTimeout(3000) });
    await shot('fiera', `?lang=${l}&kiosk=1`, { width: 1920, height: 1080 }, async p => p.waitForTimeout(2000));
    await shot('telefono', `?lang=${l}`, { width: 390, height: 844 });
    await shot('orizzontale', `?lang=${l}`, { width: 844, height: 390 });
  }
  console.log(errs.length ? errs.join('\n') : 'console: nessun errore'); await b.close();
})();
