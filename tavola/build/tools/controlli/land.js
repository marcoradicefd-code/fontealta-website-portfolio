const { chromium } = require('@playwright/test');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 844, height: 390 } });
  await p.goto('http://localhost:8765/come-nasce-una-colonna.html'); await p.waitForTimeout(2500);
  const r = await p.evaluate(() => { const ol = document.getElementById('idx'), f = ol.querySelector('button').getBoundingClientRect(), o = ol.getBoundingClientRect(); return { primo: Math.round(f.left), lista: Math.round(o.left), scorre: ol.scrollWidth > ol.clientWidth } });
  console.log(JSON.stringify(r)); await p.screenshot({ path: process.argv[2] }); await b.close(); })();
