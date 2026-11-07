// misura come la misurerebbe uno sviluppatore: primo disegno, compiti lunghi (>50 ms), tempo per fotogramma, CPU, memoria
// uso: node controlli/prestazioni.js [url]   (server su 8765)
const { chromium } = require('@playwright/test');
const URL = process.argv[2] || 'http://localhost:8765/come-nasce-una-colonna.html';
(async () => {
  const b = await chromium.launch({ args: (process.env.GPU ? ['--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--use-angle=metal'] : []) });
  for (const [nome, vp, cpu] of [['computer', { width: 1440, height: 900 }, 1], ['telefono simulato (CPU 4× più lenta)', { width: 390, height: 844 }, 4]]) {
    const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); const s = await ctx.newCDPSession(p);
    await s.send('Emulation.setCPUThrottlingRate', { rate: cpu }); await s.send('Performance.enable');
    await p.addInitScript(() => { window.__lt = []; new PerformanceObserver(l => l.getEntries().forEach(e => window.__lt.push(e.duration))).observe({ type: 'longtask', buffered: true });
      window.__ft = []; let last = 0; const f = t => { if (last) window.__ft.push(t - last); last = t; requestAnimationFrame(f) }; requestAnimationFrame(f) });
    const t0 = Date.now(); await p.goto(URL, { waitUntil: 'load' }); const load = Date.now() - t0;
    const fcp = await p.evaluate(() => (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0);
    await p.waitForTimeout(1000);
    const cpu0 = (await s.send('Performance.getMetrics')).metrics.reduce((o, m) => (o[m.name] = m.value, o), {});
    await p.evaluate(() => { window.__lt = []; window.__ft = [] }); await p.click('#play'); await p.waitForTimeout(10000);
    const cpu1 = (await s.send('Performance.getMetrics')).metrics.reduce((o, m) => (o[m.name] = m.value, o), {});
    const r = await p.evaluate(() => { const ft = window.__ft.slice().sort((a, b) => a - b); const med = ft[Math.floor(ft.length / 2)], p95 = ft[Math.floor(ft.length * .95)];
      return { fps: +(1000 / med).toFixed(0), p95ms: +p95.toFixed(1), lunghi: window.__lt.length, lungoMax: Math.round(Math.max(0, ...window.__lt)), heapMB: +(performance.memory ? performance.memory.usedJSHeapSize / 1048576 : 0).toFixed(1) } });
    const cpuPct = Math.round(100 * (cpu1.TaskDuration - cpu0.TaskDuration) / 10);
    console.log(`${nome}: caricamento ${load} ms · primo disegno ${Math.round(fcp)} ms · durante il giro ${r.fps} fps (95° perc. ${r.p95ms} ms/fotogramma) · compiti >50 ms: ${r.lunghi} (max ${r.lungoMax} ms) · CPU ~${cpuPct}% di un core · memoria JS ${r.heapMB} MB`);
    await ctx.close();
  }
  await b.close();
})();
